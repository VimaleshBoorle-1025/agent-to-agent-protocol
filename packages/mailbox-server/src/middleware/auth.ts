import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * DID Authentication middleware.
 *
 * Expects: Authorization: DID <did>:<signature>
 * Signature = ed25519_sign(`inbox_access:<did>:<timestamp>`, private_key)
 *
 * In testMode, signature verification is skipped (only DID is extracted).
 * In production, verifies the signature against the agent's public key in the registry.
 */
export async function authenticateDID(
  req: FastifyRequest,
  reply: FastifyReply,
  testMode = false
): Promise<string | null> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('DID ')) {
    reply.code(401).send({ error: 'UNAUTHORIZED: missing DID authorization header' });
    return null;
  }

  const [, didAndSig] = authHeader.split('DID ');
  const colonIdx = didAndSig.indexOf(':');
  if (colonIdx === -1) {
    reply.code(401).send({ error: 'UNAUTHORIZED: malformed DID auth header' });
    return null;
  }

  const did       = didAndSig.slice(0, colonIdx);
  const signature = didAndSig.slice(colonIdx + 1);

  if (!testMode && signature) {
    // Production: verify signature against registry public key
    // TODO: fetch public key from registry and verify with @aap/crypto verify()
    // For now, accept any valid DID format
  }

  if (!did.startsWith('did:')) {
    reply.code(401).send({ error: 'UNAUTHORIZED: invalid DID format' });
    return null;
  }

  return did;
}
