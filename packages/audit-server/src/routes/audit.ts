import { FastifyInstance } from 'fastify';
import { hashContent } from 'aap-crypto';
import { db } from '../db/client';
import { computeEntryHash, verifyChain, GENESIS_PREV_HASH, AuditEntry } from '../chain/integrity';

/** Single global chain id for v1.0 */
const CHAIN_ID = 1;

interface AppendBody {
  agent_did: string;
  action_type: string;
  outcome: string;
  timestamp: number;
  content_hash: string;
}

export async function auditRoutes(app: FastifyInstance) {

  // ---------------------------------------------------------------------------
  // POST /v1/audit/append
  // Append a new entry to the hash chain.
  // ---------------------------------------------------------------------------
  app.post<{ Body: AppendBody }>('/audit/append', {
    schema: {
      body: {
        type: 'object',
        required: ['agent_did', 'action_type', 'outcome', 'timestamp', 'content_hash'],
        properties: {
          agent_did:    { type: 'string', minLength: 1 },
          action_type:  { type: 'string', minLength: 1 },
          outcome:      { type: 'string', minLength: 1 },
          timestamp:    { type: 'number' },
          content_hash: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    const { agent_did, action_type, outcome, timestamp, content_hash } = req.body;

    // Privacy: store hashed DID, never the DID itself
    const agent_did_hash = hashContent(agent_did);

    // Fetch the latest entry's hash to use as prev_hash
    const lastResult = await db.query(
      `SELECT entry_hash FROM audit_public
       WHERE chain_id = $1
       ORDER BY id DESC LIMIT 1`,
      [CHAIN_ID]
    );
    const prev_hash: string = lastResult.rows.length > 0
      ? lastResult.rows[0].entry_hash
      : GENESIS_PREV_HASH;

    // Compute this entry's hash
    const entry_hash = computeEntryHash(
      prev_hash,
      agent_did_hash,
      action_type,
      outcome,
      timestamp,
      content_hash
    );

    const result = await db.query(
      `INSERT INTO audit_public
         (chain_id, entry_hash, prev_hash, agent_did_hash, action_type, outcome, timestamp, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [CHAIN_ID, entry_hash, prev_hash, agent_did_hash, action_type, outcome, timestamp, content_hash]
    );

    return reply.code(201).send(result.rows[0]);
  });

  // ---------------------------------------------------------------------------
  // GET /v1/audit/chain
  // Paginated public chain entries.
  // ---------------------------------------------------------------------------
  app.get<{
    Querystring: { limit?: number; offset?: number };
  }>('/audit/chain', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 1000, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (req, reply) => {
    const limit  = req.query.limit  ?? 50;
    const offset = req.query.offset ?? 0;

    const result = await db.query(
      `SELECT * FROM audit_public
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return reply.send({
      entries: result.rows,
      limit,
      offset,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /v1/audit/chain/:id
  // Retrieve a single chain entry by its numeric id.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/audit/chain/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: 'INVALID_ID: id must be a number' });
    }

    const result = await db.query(
      `SELECT * FROM audit_public WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'NOT_FOUND: no audit entry with that id' });
    }

    return reply.send(result.rows[0]);
  });

  // ---------------------------------------------------------------------------
  // GET /v1/audit/verify
  // Recompute every entry_hash in chain order and verify linkage.
  // Returns { valid: true, length: N } or { valid: false, broken_at: id }.
  // ---------------------------------------------------------------------------
  app.get('/audit/verify', async (_req, reply) => {
    const result = await db.query(
      `SELECT * FROM audit_public
       WHERE chain_id = $1
       ORDER BY id ASC`,
      [CHAIN_ID]
    );

    const entries: AuditEntry[] = result.rows;
    const verification = verifyChain(entries);

    return reply.send(verification);
  });

  // ---------------------------------------------------------------------------
  // GET /v1/audit/agent/:did_hash
  // Return all entries for a specific agent (identified by their hashed DID).
  // ---------------------------------------------------------------------------
  app.get<{
    Params: { did_hash: string };
    Querystring: { limit?: number; offset?: number };
  }>('/audit/agent/:did_hash', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 1000, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (req, reply) => {
    const { did_hash } = req.params;
    const limit  = req.query.limit  ?? 50;
    const offset = req.query.offset ?? 0;

    const result = await db.query(
      `SELECT * FROM audit_public
       WHERE agent_did_hash = $1
       ORDER BY id ASC
       LIMIT $2 OFFSET $3`,
      [did_hash, limit, offset]
    );

    return reply.send({
      entries: result.rows,
      limit,
      offset,
    });
  });
}
