import { FastifyInstance } from 'fastify';
import { db } from '../db/client';

export async function lookupRoutes(app: FastifyInstance) {
  // GET /v1/lookup/:address
  app.get<{ Params: { address: string } }>('/lookup/:address', async (req, reply) => {
    const address = decodeURIComponent(req.params.address);
    const result = await db.query(
      'SELECT did_document, trust_score, verification_level FROM agents WHERE aap_address = $1 AND is_active = true',
      [address]
    );
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    const row = result.rows[0];
    return reply.send({
      ...row.did_document,
      trustScore: row.trust_score,
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
    const { capability, type, owner } = req.query as Record<string, string>;
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

  // GET /v1/agent/:did/trust
  app.get<{ Params: { did: string } }>('/agent/:did/trust', async (req, reply) => {
    const result = await db.query(
      'SELECT trust_score, verification_level, created_at FROM agents WHERE did = $1',
      [req.params.did]
    );
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    return reply.send(result.rows[0]);
  });
}
