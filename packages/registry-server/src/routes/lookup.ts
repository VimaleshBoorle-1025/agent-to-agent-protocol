import { FastifyInstance } from 'fastify';
import { db } from '../db/client';

// ─── Trust scoring ────────────────────────────────────────────────────────────
// Score = base(40) + verification bonus(0–35) + age bonus(0–15) + interaction bonus(0–30)
// Max possible: 120, clamped to 100.

function verificationBonus(level: string): number {
  if (level === 'enterprise')          return 35;
  if (level === 'business_verified')   return 25;
  if (level === 'personal_verified')   return 15;
  return 0; // unverified
}

function ageDays(createdAt: Date | string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function computeTrustScore(row: {
  verification_level: string;
  created_at: Date | string;
  interaction_count?: number;
}): number {
  const base         = 40;
  const verification = verificationBonus(row.verification_level);
  const age          = Math.min(ageDays(row.created_at), 15);
  const interactions = Math.min(Math.floor((row.interaction_count ?? 0) / 10), 30);
  return Math.min(base + verification + age + interactions, 100);
}

// ─────────────────────────────────────────────────────────────────────────────

export async function lookupRoutes(app: FastifyInstance) {
  // GET /v1/lookup/:address
  app.get<{ Params: { address: string } }>('/lookup/:address', async (req, reply) => {
    const address = decodeURIComponent(req.params.address);
    const result = await db.query(
      'SELECT did_document, trust_score, verification_level, created_at, interaction_count FROM agents WHERE aap_address = $1 AND is_active = true',
      [address]
    );
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    const row = result.rows[0];
    return reply.send({
      ...row.did_document,
      trustScore:        computeTrustScore(row),
      verificationLevel: row.verification_level,
    });
  });

  // GET /v1/resolve/:did
  app.get<{ Params: { did: string } }>('/resolve/:did', async (req, reply) => {
    const result = await db.query(
      'SELECT * FROM agents WHERE did = $1 AND is_active = true',
      [req.params.did]
    );
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'DID not found' });
    }
    return reply.send(result.rows[0]);
  });

  // GET /v1/search?capability=X&type=Y
  app.get('/search', async (req, reply) => {
    const { capability, type } = req.query as Record<string, string>;
    let query = 'SELECT aap_address, did, verification_level, trust_score FROM agents WHERE is_active = true';
    const params: string[] = [];
    if (capability) {
      params.push(`%${capability}%`);
      query += ` AND aap_address LIKE $${params.length}`;
    }
    if (type) {
      params.push(`%.${type}.%`);
      query += ` AND aap_address LIKE $${params.length}`;
    }
    query += ' ORDER BY trust_score DESC LIMIT 50';
    const result = await db.query(query, params);
    return reply.send({ agents: result.rows });
  });

  // GET /v1/agent/:did/trust  — live score with breakdown
  app.get<{ Params: { did: string } }>('/agent/:did/trust', async (req, reply) => {
    const result = await db.query(
      'SELECT trust_score, verification_level, created_at, interaction_count FROM agents WHERE did = $1',
      [req.params.did]
    );
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    const row   = result.rows[0];
    const score = computeTrustScore(row);

    if (score !== row.trust_score) {
      await db.query('UPDATE agents SET trust_score = $1 WHERE did = $2', [score, req.params.did]);
    }

    return reply.send({
      did:                req.params.did,
      trust_score:        score,
      verification_level: row.verification_level,
      breakdown: {
        base:         40,
        verification: verificationBonus(row.verification_level),
        age_days:     Math.min(ageDays(row.created_at), 15),
        interactions: Math.min(Math.floor((row.interaction_count ?? 0) / 10), 30),
      },
    });
  });
}
