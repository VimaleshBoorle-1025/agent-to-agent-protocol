import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client';
import { validateAAPAddress } from '../crypto/validate';

interface RegisterBody {
  aap_address: string;
  public_key_hex: string;
  endpoint_url: string;
  capabilities: string[];
  owner_type: 'human' | 'entity';
  phone_otp_token?: string;
  signature: string;
}

export async function registerRoutes(app: FastifyInstance) {
  // POST /v1/register
  app.post<{ Body: RegisterBody }>('/register', async (req, reply) => {
    const {
      aap_address,
      public_key_hex,
      endpoint_url,
      capabilities,
      owner_type,
      phone_otp_token,
      signature,
    } = req.body;

    // Validate aap:// address format
    if (!validateAAPAddress(aap_address)) {
      return reply.code(400).send({ error: 'Invalid aap:// address format. Expected aap://[owner].[type].[capability]' });
    }

    // Check address not already taken
    const existing = await db.query(
      'SELECT id FROM agents WHERE aap_address = $1',
      [aap_address]
    );
    if (existing.rows.length > 0) {
      return reply.code(409).send({ error: 'Address already registered' });
    }

    // Build DID
    const did = `did:aap:${uuidv4().replace(/-/g, '')}`;

    // Build DID Document
    const did_document = {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: did,
      aapAddress: aap_address,
      verificationMethod: [{
        id: `${did}#key-1`,
        type: 'Dilithium3VerificationKey2026',
        publicKeyHex: public_key_hex,
      }],
      service: [{
        id: `${did}#endpoint`,
        type: 'AAPMessaging',
        serviceEndpoint: endpoint_url,
      }],
      verificationLevel: owner_type === 'human' && phone_otp_token ? 'personal_verified' : 'unverified',
      trustScore: 50,
    };

    const result = await db.query(
      `INSERT INTO agents
         (aap_address, did, public_key_hex, did_document, endpoint_url,
          capabilities_hash, verification_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING did, aap_address, created_at`,
      [
        aap_address,
        did,
        public_key_hex,
        JSON.stringify(did_document),
        endpoint_url,
        null,
        did_document.verificationLevel,
      ]
    );

    const agent = result.rows[0];
    return reply.code(201).send({
      did: agent.did,
      aap_address: agent.aap_address,
      created_at: agent.created_at,
    });
  });

  // DELETE /v1/agent/:did  — deactivate
  app.delete<{ Params: { did: string } }>('/agent/:did', async (req, reply) => {
    const { did } = req.params;
    await db.query('UPDATE agents SET is_active = false WHERE did = $1', [did]);
    return reply.send({ success: true });
  });
}
