import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client';
import { validateAAPAddress, checkAndStoreNonce, validateTimestamp } from '../crypto/validate';
import { verify as ed25519Verify } from '@aap/crypto';

interface RegisterBody {
  aap_address:     string;
  public_key_hex:  string;
  endpoint_url:    string;
  capabilities:    string[];
  owner_type:      'human' | 'entity';
  timestamp:       number;
  nonce:           string;
  signature:       string;  // ed25519/dilithium3 sign(entire body minus signature)
}

export async function registerRoutes(app: FastifyInstance) {

  // POST /v1/register
  app.post<{ Body: RegisterBody }>('/register', async (req, reply) => {
    const { aap_address, public_key_hex, endpoint_url, capabilities,
            owner_type, timestamp, nonce, signature } = req.body;

    // 1. Validate aap:// address format
    if (!validateAAPAddress(aap_address)) {
      return reply.code(400).send({ error: 'INVALID_ADDRESS: expected aap://[owner].[type].[capability]' });
    }

    // 2. Validate timestamp (30s window)
    if (!validateTimestamp(timestamp)) {
      return reply.code(400).send({ error: 'TIMESTAMP_EXPIRED: message timestamp outside 30-second window' });
    }

    // 3. Nonce deduplication (replay attack prevention)
    const nonceOk = await checkAndStoreNonce(nonce, db);
    if (!nonceOk) {
      return reply.code(400).send({ error: 'REPLAY_ATTACK: nonce already used' });
    }

    // 4. Verify signature over the request body
    const { signature: _sig, ...bodyToVerify } = req.body;
    const messageBytes = new TextEncoder().encode(JSON.stringify(bodyToVerify));
    const sigValid = ed25519Verify(messageBytes, signature, public_key_hex);
    if (!sigValid) {
      return reply.code(401).send({ error: 'INVALID_SIGNATURE: request signature verification failed' });
    }

    // 5. Check address not already taken
    const existing = await db.query(
      'SELECT id FROM agents WHERE aap_address = $1',
      [aap_address]
    );
    if (existing.rows.length > 0) {
      return reply.code(409).send({ error: 'ADDRESS_TAKEN: aap:// address already registered' });
    }

    // 6. All new agents start unverified — trust is earned via audit chain history
    const verificationLevel = 'unverified';

    // 7. Build DID
    const did = `did:aap:${uuidv4().replace(/-/g, '')}`;

    const did_document = {
      '@context':   'https://www.w3.org/ns/did/v1',
      id:           did,
      aapAddress:   aap_address,
      verificationMethod: [{
        id:           `${did}#key-1`,
        type:         'Ed25519VerificationKey2020',
        publicKeyHex: public_key_hex,
      }],
      service: [{
        id:              `${did}#endpoint`,
        type:            'AAPMessaging',
        serviceEndpoint: endpoint_url,
      }],
      verificationLevel,
      trustScore: 50,
    };

    const result = await db.query(
      `INSERT INTO agents
         (aap_address, did, public_key_hex, did_document, endpoint_url, verification_level)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING did, aap_address, created_at`,
      [aap_address, did, public_key_hex, JSON.stringify(did_document), endpoint_url, verificationLevel]
    );

    const agent = result.rows[0];
    return reply.code(201).send({
      did:           agent.did,
      aap_address:   agent.aap_address,
      created_at:    agent.created_at,
    });
  });

  // PUT /v1/agent/:did  — update endpoint or capabilities
  app.put<{ Params: { did: string }; Body: { endpoint_url: string; signature: string } }>(
    '/agent/:did',
    async (req, reply) => {
      const { did } = req.params;
      const { endpoint_url, signature } = req.body;

      const agent = await db.query('SELECT public_key_hex FROM agents WHERE did = $1', [did]);
      if (agent.rows.length === 0) return reply.code(404).send({ error: 'Agent not found' });

      const msgBytes = new TextEncoder().encode(JSON.stringify({ did, endpoint_url }));
      if (!ed25519Verify(msgBytes, signature, agent.rows[0].public_key_hex)) {
        return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
      }

      await db.query(
        `UPDATE agents SET endpoint_url = $1,
         did_document = jsonb_set(did_document, '{service,0,serviceEndpoint}', $2::jsonb),
         updated_at = NOW() WHERE did = $3`,
        [endpoint_url, JSON.stringify(endpoint_url), did]
      );
      return reply.send({ success: true });
    }
  );

  // DELETE /v1/agent/:did  — deactivate
  app.delete<{ Params: { did: string }; Body: { signature: string } }>(
    '/agent/:did',
    async (req, reply) => {
      const { did } = req.params;
      const { signature } = req.body;

      const agent = await db.query('SELECT public_key_hex FROM agents WHERE did = $1', [did]);
      if (agent.rows.length === 0) return reply.code(404).send({ error: 'Agent not found' });

      const msgBytes = new TextEncoder().encode(`deactivate:${did}`);
      if (!ed25519Verify(msgBytes, signature, agent.rows[0].public_key_hex)) {
        return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
      }

      await db.query('UPDATE agents SET is_active = false WHERE did = $1', [did]);
      return reply.send({ success: true });
    }
  );
}
