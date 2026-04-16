/**
 * Audit Chain Server — TDD Test Suite
 * Tests written BEFORE implementation.
 */

import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { computeEntryHash, verifyChain, hashAgentDid, ChainEntry } from '../src/chain/integrity';

// ─── Mock DB ─────────────────────────────────────────────────────────────────
// Factory must be self-contained — jest.mock is hoisted before variable declarations.

jest.mock('../src/db/client', () => {
  const store: any[] = [];
  let seq = 1;

  const db = {
    _store: store,
    _resetSeq: () => { seq = 1; },
    query: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('ORDER BY id DESC LIMIT 1')) {
        const last = store[store.length - 1];
        return { rows: last ? [last] : [] };
      }
      if (sql.includes('INSERT INTO audit_public')) {
        const [chain_id, entry_hash, prev_hash, agent_did_hash, action_type, outcome, timestamp, content_hash] = params!;
        const entry = { id: seq++, chain_id, entry_hash, prev_hash, agent_did_hash, action_type, outcome, timestamp, content_hash };
        store.push(entry);
        return { rows: [entry] };
      }
      if (sql.includes('ORDER BY id ASC') && !sql.includes('agent_did_hash')) {
        return { rows: [...store] };
      }
      if (sql.includes('WHERE id = $1')) {
        return { rows: store.filter(e => e.id === parseInt(params![0])) };
      }
      if (sql.includes('agent_did_hash = $1')) {
        return { rows: store.filter(e => e.agent_did_hash === params![0]) };
      }
      if (sql.includes('LIMIT') && sql.includes('OFFSET')) {
        const limit = params![0] ?? 50;
        const offset = params![1] ?? 0;
        return { rows: store.slice(offset, offset + limit) };
      }
      return { rows: [] };
    }),
  };
  return { db };
});

import { db as mockDb } from '../src/db/client';

// Convenience references for tests that directly manipulate the store
const chainStore: ChainEntry[] = (mockDb as any)._store;
let idSeq = 1;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Audit Chain Integrity Logic', () => {
  beforeEach(() => {
    chainStore.length = 0;
    if ((mockDb as any)._resetSeq) (mockDb as any)._resetSeq();
    ((mockDb as any).query as jest.Mock).mockClear();
  });

  test('computeEntryHash is deterministic', () => {
    const h1 = computeEntryHash('prev', 'agent', 'PING', 'success', 123456, 'content');
    const h2 = computeEntryHash('prev', 'agent', 'PING', 'success', 123456, 'content');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  test('computeEntryHash changes when any input changes', () => {
    const base = computeEntryHash('prev', 'agent', 'PING', 'success', 123456, 'content');
    expect(computeEntryHash('XXXX', 'agent', 'PING', 'success', 123456, 'content')).not.toBe(base);
    expect(computeEntryHash('prev', 'XXXX', 'PING', 'success', 123456, 'content')).not.toBe(base);
    expect(computeEntryHash('prev', 'agent', 'PONG', 'success', 123456, 'content')).not.toBe(base);
  });

  test('verifyChain returns valid for empty chain', () => {
    const result = verifyChain([]);
    expect(result).toMatchObject({ valid: true, length: 0 });
  });

  test('verifyChain validates a correctly built chain of 5 entries', () => {
    const GENESIS = '0'.repeat(64);
    const entries: ChainEntry[] = [];

    let prevHash = GENESIS;
    for (let i = 0; i < 5; i++) {
      const entry_hash = computeEntryHash(prevHash, `agent${i}`, 'PING', 'success', 1000 + i, `content${i}`);
      entries.push({
        id: i + 1, chain_id: 1,
        entry_hash, prev_hash: prevHash,
        agent_did_hash: `agent${i}`, action_type: 'PING',
        outcome: 'success', timestamp: 1000 + i, content_hash: `content${i}`,
      });
      prevHash = entry_hash;
    }

    expect(verifyChain(entries)).toMatchObject({ valid: true, length: 5 });
  });

  test('verifyChain detects tampered entry_hash', () => {
    const GENESIS = '0'.repeat(64);
    const entry_hash = computeEntryHash(GENESIS, 'agent', 'PING', 'success', 1000, 'content');
    const entries: ChainEntry[] = [{
      id: 1, chain_id: 1,
      entry_hash: 'tampered_hash_' + 'x'.repeat(50), // wrong hash
      prev_hash: GENESIS,
      agent_did_hash: 'agent', action_type: 'PING',
      outcome: 'success', timestamp: 1000, content_hash: 'content',
    }];

    const result = verifyChain(entries);
    expect(result.valid).toBe(false);
    expect(result.broken_at).toBe(1);
  });

  test('verifyChain detects broken prev_hash linkage', () => {
    const GENESIS = '0'.repeat(64);
    const e1_hash = computeEntryHash(GENESIS, 'agent', 'PING', 'success', 1000, 'c1');
    const e2_hash = computeEntryHash(e1_hash, 'agent', 'PONG', 'success', 1001, 'c2');

    const entries: ChainEntry[] = [
      { id: 1, chain_id: 1, entry_hash: e1_hash, prev_hash: GENESIS, agent_did_hash: 'agent', action_type: 'PING', outcome: 'success', timestamp: 1000, content_hash: 'c1' },
      { id: 2, chain_id: 1, entry_hash: e2_hash, prev_hash: 'WRONG_PREV', agent_did_hash: 'agent', action_type: 'PONG', outcome: 'success', timestamp: 1001, content_hash: 'c2' },
    ];

    const result = verifyChain(entries);
    expect(result.valid).toBe(false);
    expect(result.broken_at).toBe(2);
  });

  test('hashAgentDid produces SHA-256 hex', () => {
    const h = hashAgentDid('did:aap:test');
    expect(h).toHaveLength(64);
    expect(hashAgentDid('did:aap:test')).toBe(h); // deterministic
    expect(hashAgentDid('did:aap:other')).not.toBe(h);
  });
});

describe('Audit REST API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    chainStore.length = 0;
    idSeq = 1;
    ((mockDb as any).query as jest.Mock).mockClear();
    app = await buildApp({ testMode: true });
  });

  afterEach(async () => { await app.close(); });

  test('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'aap-audit' });
  });

  test('POST /v1/audit/append returns entry with valid entry_hash', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/audit/append',
      payload: {
        agent_did: 'did:aap:alice',
        action_type: 'PING',
        outcome: 'success',
        content_hash: 'a'.repeat(64),
        timestamp: Date.now(),
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('entry_hash');
    expect(body.entry_hash).toHaveLength(64);
    expect(body.action_type).toBe('PING');
    // agent_did_hash should be SHA256, not the raw DID
    expect(body.agent_did_hash).not.toBe('did:aap:alice');
    expect(body.agent_did_hash).toHaveLength(64);
  });

  test('POST /v1/audit/append rejects missing fields', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/audit/append',
      payload: { agent_did: 'did:aap:alice' }, // missing fields
    });
    expect(res.statusCode).toBe(400);
  });

  test('chain entries are properly linked', async () => {
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST', url: '/v1/audit/append',
        payload: { agent_did: 'did:aap:alice', action_type: 'PING', outcome: 'success', content_hash: 'a'.repeat(64), timestamp: Date.now() + i },
      });
    }

    expect(chainStore).toHaveLength(3);
    // Each entry's prev_hash should equal the previous entry's entry_hash
    expect(chainStore[1].prev_hash).toBe(chainStore[0].entry_hash);
    expect(chainStore[2].prev_hash).toBe(chainStore[1].entry_hash);
  });

  test('GET /v1/audit/verify returns valid for correct chain', async () => {
    // Append a valid entry first
    await app.inject({
      method: 'POST', url: '/v1/audit/append',
      payload: { agent_did: 'did:aap:alice', action_type: 'PING', outcome: 'success', content_hash: 'a'.repeat(64), timestamp: 1000 },
    });

    const res = await app.inject({ method: 'GET', url: '/v1/audit/verify' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ valid: true, length: 1 });
  });

  test('GET /v1/audit/chain supports pagination', async () => {
    const res = await app.inject({
      method: 'GET', url: '/v1/audit/chain?limit=10&offset=0',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('entries');
  });

  test('GET /v1/audit/agent/:did_hash returns entries for that agent', async () => {
    const agentHash = hashAgentDid('did:aap:alice');
    const res = await app.inject({
      method: 'GET', url: `/v1/audit/agent/${agentHash}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('entries');
  });
});
