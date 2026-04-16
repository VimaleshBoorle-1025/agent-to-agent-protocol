import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { computeEntryHash, hashAgentDid, hashContent, verifyChain, ChainEntry } from '../chain/integrity';

const GENESIS_PREV_HASH = '0'.repeat(64);
const CHAIN_ID = 1;

interface AppendBody {
  agent_did:    string;
  action_type:  string;
  outcome:      string;
  content_hash: string;
  timestamp:    number;
}

export async function auditRoutes(app: FastifyInstance) {

  // POST /v1/audit/append
  app.post<{ Body: AppendBody }>('/audit/append', async (req, reply) => {
    const { agent_did, action_type, outcome, content_hash, timestamp } = req.body;

    if (!agent_did || !action_type || !outcome || !content_hash || !timestamp) {
      return reply.code(400).send({ error: 'MISSING_FIELDS: agent_did, action_type, outcome, content_hash, timestamp required' });
    }

    const agent_did_hash = hashAgentDid(agent_did);

    // Get last entry for chaining
    const lastRes = await db.query(
      'SELECT entry_hash FROM audit_public WHERE chain_id = $1 ORDER BY id DESC LIMIT 1',
      [CHAIN_ID]
    );
    const prev_hash = lastRes.rows.length > 0 ? lastRes.rows[0].entry_hash : GENESIS_PREV_HASH;

    const entry_hash = computeEntryHash(prev_hash, agent_did_hash, action_type, outcome, timestamp, content_hash);

    const result = await db.query(
      `INSERT INTO audit_public
         (chain_id, entry_hash, prev_hash, agent_did_hash, action_type, outcome, timestamp, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [CHAIN_ID, entry_hash, prev_hash, agent_did_hash, action_type, outcome, timestamp, content_hash]
    );

    return reply.code(201).send(result.rows[0]);
  });

  // GET /v1/audit/chain?limit=50&offset=0
  app.get('/audit/chain', async (req, reply) => {
    const { limit = '50', offset = '0' } = req.query as Record<string, string>;
    const result = await db.query(
      'SELECT * FROM audit_public ORDER BY id ASC LIMIT $1 OFFSET $2',
      [parseInt(limit), parseInt(offset)]
    );
    return reply.send({ entries: result.rows, limit: parseInt(limit), offset: parseInt(offset) });
  });

  // GET /v1/audit/chain/:id
  app.get<{ Params: { id: string } }>('/audit/chain/:id', async (req, reply) => {
    const result = await db.query('SELECT * FROM audit_public WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return reply.code(404).send({ error: 'ENTRY_NOT_FOUND' });
    return reply.send(result.rows[0]);
  });

  // GET /v1/audit/verify — full chain integrity check
  app.get('/audit/verify', async (req, reply) => {
    const result = await db.query(
      'SELECT * FROM audit_public WHERE chain_id = $1 ORDER BY id ASC',
      [CHAIN_ID]
    );
    const verification = verifyChain(result.rows as ChainEntry[]);
    return reply.send(verification);
  });

  // GET /v1/audit/agent/:did_hash
  app.get<{ Params: { did_hash: string } }>('/audit/agent/:did_hash', async (req, reply) => {
    const result = await db.query(
      'SELECT * FROM audit_public WHERE agent_did_hash = $1 ORDER BY id ASC',
      [req.params.did_hash]
    );
    return reply.send({ entries: result.rows, count: result.rows.length });
  });
}
