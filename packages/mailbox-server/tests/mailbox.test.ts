/**
 * Mailbox Server — TDD Test Suite
 * Tests written BEFORE implementation. All must pass.
 */

import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';

// ─── Mock DB ─────────────────────────────────────────────────────────────────
// jest.mock is hoisted before variable declarations, so the factory must be self-contained.

const mockMessages: Record<string, any> = {};
let idCounter = 1;

jest.mock('../src/db/client', () => {
  const messages: Record<string, any> = {};
  let counter = 1;

  const db = {
    _messages: messages,
    _resetCounter: () => { counter = 1; },
    query: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO mailbox_messages')) {
        const id = `msg-${counter++}`;
        const [to_did, from_did, message_id, outer_envelope, expires_at] = params!;
        messages[message_id] = {
          id, to_did, from_did, message_id,
          outer_envelope: Buffer.from(outer_envelope),
          status: 'pending',
          created_at: new Date(),
          expires_at: expires_at || new Date(Date.now() + 7 * 86400_000),
          delivered_at: null,
        };
        return { rows: [messages[message_id]] };
      }
      if (sql.includes('SELECT') && sql.includes('to_did') && sql.includes("status = 'pending'")) {
        const to_did = params![0];
        const rows = Object.values(messages).filter(
          (m: any) => m.to_did === to_did && m.status === 'pending' && m.expires_at > new Date()
        );
        return { rows };
      }
      if (sql.includes('SELECT') && sql.includes('message_id = $1')) {
        const message_id = params![0];
        return { rows: messages[message_id] ? [messages[message_id]] : [] };
      }
      if (sql.includes("SET status = 'delivered'")) {
        const message_id = params![0];
        if (messages[message_id]) {
          messages[message_id].status = 'delivered';
          messages[message_id].delivered_at = new Date();
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM mailbox_messages')) {
        const message_id = params![0];
        const msg = messages[message_id];
        if (msg && msg.status === 'pending') {
          delete messages[message_id];
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('COUNT') && sql.includes('from_did')) {
        return { rows: [{ count: '0' }] };
      }
      return { rows: [] };
    }),
  };
  return { db };
});

// Get a reference to the mock db after jest.mock is set up
import { db as mockDb } from '../src/db/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAuthHeader(did: string) {
  // Format: "DID <did> <signature>"  (space-separated)
  return `DID ${did} test-signature-${Date.now()}`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Mailbox Server', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Clear messages between tests using internal store on mock
    const internalMessages = (mockDb as any)._messages;
    if (internalMessages) Object.keys(internalMessages).forEach(k => delete internalMessages[k]);
    if ((mockDb as any)._resetCounter) (mockDb as any)._resetCounter();
    (mockDb.query as jest.Mock).mockClear();
    app = await buildApp({ testMode: true });
  });

  afterEach(async () => {
    await app.close();
  });

  // ── Health ────────────────────────────────────────────────────────────────

  test('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'aap-mailbox' });
  });

  // ── Send ─────────────────────────────────────────────────────────────────

  test('POST /v1/messages/send returns 201 with message_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messages/send',
      headers: { authorization: makeAuthHeader('did:aap:alice') },
      payload: {
        to_did:         'did:aap:bob',
        from_did:       'did:aap:alice',
        message_id:     'test-msg-001',
        outer_envelope: Buffer.from('encrypted-payload').toString('base64'),
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ message_id: 'test-msg-001', status: 'queued' });
  });

  test('POST /v1/messages/send rejects missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messages/send',
      headers: { authorization: makeAuthHeader('did:aap:alice') },
      payload: { to_did: 'did:aap:bob' }, // missing fields
    });
    expect(res.statusCode).toBe(400);
  });

  test('POST /v1/messages/send rejects unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messages/send',
      payload: {
        to_did: 'did:aap:bob', from_did: 'did:aap:alice',
        message_id: 'x', outer_envelope: 'y',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  // ── Inbox ─────────────────────────────────────────────────────────────────

  test('GET /v1/messages/inbox returns pending messages for authenticated DID', async () => {
    // Seed a message directly into the mock's internal store
    const store = (mockDb as any)._messages;
    store['inbox-msg-1'] = {
      id: 'msg-1', to_did: 'did:aap:bob', from_did: 'did:aap:alice',
      message_id: 'inbox-msg-1',
      outer_envelope: Buffer.from('encrypted'),
      status: 'pending',
      created_at: new Date(),
      expires_at: new Date(Date.now() + 86400_000),
      delivered_at: null,
    };

    const res = await app.inject({
      method: 'GET',
      url: '/v1/messages/inbox',
      headers: { authorization: makeAuthHeader('did:aap:bob') },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].message_id).toBe('inbox-msg-1');
    expect(body.messages[0]).toHaveProperty('outer_envelope_b64');
  });

  test('GET /v1/messages/inbox does not return other DID messages', async () => {
    const store = (mockDb as any)._messages;
    store['other-msg'] = {
      id: 'msg-x', to_did: 'did:aap:charlie', from_did: 'did:aap:alice',
      message_id: 'other-msg',
      outer_envelope: Buffer.from('encrypted'),
      status: 'pending', created_at: new Date(),
      expires_at: new Date(Date.now() + 86400_000), delivered_at: null,
    };

    const res = await app.inject({
      method: 'GET', url: '/v1/messages/inbox',
      headers: { authorization: makeAuthHeader('did:aap:bob') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().messages).toHaveLength(0);
  });

  test('GET /v1/messages/inbox returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/messages/inbox' });
    expect(res.statusCode).toBe(401);
  });

  // ── Ack ───────────────────────────────────────────────────────────────────

  test('POST /v1/messages/:id/ack sets status to delivered', async () => {
    const store = (mockDb as any)._messages;
    store['ack-msg'] = {
      id: 'msg-2', to_did: 'did:aap:bob', from_did: 'did:aap:alice',
      message_id: 'ack-msg',
      outer_envelope: Buffer.from('encrypted'),
      status: 'pending', created_at: new Date(),
      expires_at: new Date(Date.now() + 86400_000), delivered_at: null,
    };

    const res = await app.inject({
      method: 'POST', url: '/v1/messages/ack-msg/ack',
      headers: { authorization: makeAuthHeader('did:aap:bob') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });

  // ── Status ────────────────────────────────────────────────────────────────

  test('GET /v1/messages/:id/status returns current status', async () => {
    const store = (mockDb as any)._messages;
    store['status-msg'] = {
      id: 'msg-3', to_did: 'did:aap:bob', from_did: 'did:aap:alice',
      message_id: 'status-msg',
      outer_envelope: Buffer.from('enc'),
      status: 'pending', created_at: new Date(),
      expires_at: new Date(Date.now() + 86400_000), delivered_at: null,
    };

    const res = await app.inject({
      method: 'GET', url: '/v1/messages/status-msg/status',
      headers: { authorization: makeAuthHeader('did:aap:alice') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message_id: 'status-msg', status: 'pending' });
  });

  test('GET /v1/messages/:id/status returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET', url: '/v1/messages/does-not-exist/status',
      headers: { authorization: makeAuthHeader('did:aap:alice') },
    });
    expect(res.statusCode).toBe(404);
  });

  // ── Revoke ────────────────────────────────────────────────────────────────

  test('DELETE /v1/messages/:id revokes pending message', async () => {
    const store = (mockDb as any)._messages;
    store['revoke-msg'] = {
      id: 'msg-4', to_did: 'did:aap:bob', from_did: 'did:aap:alice',
      message_id: 'revoke-msg',
      outer_envelope: Buffer.from('enc'),
      status: 'pending', created_at: new Date(),
      expires_at: new Date(Date.now() + 86400_000), delivered_at: null,
    };

    const res = await app.inject({
      method: 'DELETE', url: '/v1/messages/revoke-msg',
      headers: { authorization: makeAuthHeader('did:aap:alice') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
    expect((mockDb as any)._messages['revoke-msg']).toBeUndefined();
  });

  test('DELETE /v1/messages/:id rejects already-delivered messages', async () => {
    const store = (mockDb as any)._messages;
    store['delivered-msg'] = {
      id: 'msg-5', to_did: 'did:aap:bob', from_did: 'did:aap:alice',
      message_id: 'delivered-msg',
      outer_envelope: Buffer.from('enc'),
      status: 'delivered', created_at: new Date(),
      expires_at: new Date(Date.now() + 86400_000), delivered_at: new Date(),
    };

    const res = await app.inject({
      method: 'DELETE', url: '/v1/messages/delivered-msg',
      headers: { authorization: makeAuthHeader('did:aap:alice') },
    });
    expect(res.statusCode).toBe(409);
  });
});
