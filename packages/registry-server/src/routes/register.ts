import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import * as nodeCrypto from 'crypto';
import { db } from '../db/client';
import { validateAAPAddress, checkAndStoreNonce, validateTimestamp } from '../crypto/validate';
import { verify as ed25519Verify } from '@a2a_protocol/aap-crypto';

/**
 * Verify an ECDSA P-256 signature produced by the browser's Web Crypto API.
 * Public key is the raw 65-byte uncompressed point (130 hex chars).
 * Signature is IEEE P1363 format: raw r||s (64 bytes = 128 hex chars).
 */
function verifyP256(message: Uint8Array, signatureHex: string, publicKeyHex: string): boolean {
  try {
    // Wrap raw uncompressed P-256 public key in SPKI DER envelope
    const spkiPrefix = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');
    const pubKey = nodeCrypto.createPublicKey({
      key:    Buffer.concat([spkiPrefix, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type:   'spki',
    });

    // Convert IEEE P1363 (r||s) to DER SEQUENCE for Node's verify
    const sig = Buffer.from(signatureHex, 'hex');
    const encInt = (n: Buffer): Buffer => {
      let i = 0; while (i < n.length - 1 && n[i] === 0) i++; n = n.slice(i);
      if (n[0] & 0x80) n = Buffer.concat([Buffer.from([0x00]), n]);
      return Buffer.concat([Buffer.from([0x02, n.length]), n]);
    };
    const r = encInt(sig.slice(0, 32));
    const s = encInt(sig.slice(32, 64));
    const der = Buffer.concat([Buffer.from([0x30, r.length + s.length]), r, s]);

    return nodeCrypto.createVerify('SHA256').update(message).verify(pubKey, der);
  } catch { return false; }
}

/** Auto-detect algorithm from key length and verify. */
function verifySignature(message: Uint8Array, signatureHex: string, publicKeyHex: string): boolean {
  // P-256 uncompressed public key = 65 bytes = 130 hex chars
  if (publicKeyHex.length === 130) return verifyP256(message, signatureHex, publicKeyHex);
  // Ed25519 public key = 32 bytes = 64 hex chars
  return ed25519Verify(message, signatureHex, publicKeyHex);
}

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
    const sigValid = verifySignature(messageBytes, signature, public_key_hex);
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
      if (!verifySignature(msgBytes, signature, agent.rows[0].public_key_hex)) {
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
      if (!verifySignature(msgBytes, signature, agent.rows[0].public_key_hex)) {
        return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
      }

      await db.query('UPDATE agents SET is_active = false WHERE did = $1', [did]);
      return reply.send({ success: true });
    }
  );
}
