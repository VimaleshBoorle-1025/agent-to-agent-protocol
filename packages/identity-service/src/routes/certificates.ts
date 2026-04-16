import { FastifyInstance } from 'fastify';
import {
  issueCertificate,
  getCertificate,
  verifyCertificate,
  revokeCertificate,
  VerificationLevel,
} from '../services/issuer';

interface IssueBody {
  agent_did:          string;
  aap_address:        string;
  public_key_hex:     string;
  verification_level: VerificationLevel;
}

interface RevokeBody {
  reason?: string;
}

export async function certificateRoutes(app: FastifyInstance) {

  // POST /v1/certificates/issue
  app.post<{ Body: IssueBody }>('/certificates/issue', async (req, reply) => {
    const { agent_did, aap_address, public_key_hex, verification_level } = req.body;

    if (!agent_did || !aap_address || !public_key_hex || !verification_level) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    try {
      const cert = await issueCertificate({ agent_did, aap_address, public_key_hex, verification_level });
      return reply.code(201).send(cert);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 409) {
        return reply.code(409).send({ error: 'Certificate already exists for this agent' });
      }
      app.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /v1/certificates/:did
  app.get<{ Params: { did: string } }>('/certificates/:did', async (req, reply) => {
    const did = decodeURIComponent(req.params.did);
    const cert = await getCertificate(did);
    if (!cert) return reply.code(404).send({ error: 'Certificate not found' });
    return reply.send(cert);
  });

  // GET /v1/certificates/:did/verify
  app.get<{ Params: { did: string } }>('/certificates/:did/verify', async (req, reply) => {
    const did = decodeURIComponent(req.params.did);
    const result = await verifyCertificate(did);
    return reply.send(result);
  });

  // POST /v1/certificates/:did/revoke
  app.post<{ Params: { did: string }; Body: RevokeBody }>(
    '/certificates/:did/revoke',
    async (req, reply) => {
      const did = decodeURIComponent(req.params.did);
      const { reason } = req.body ?? {};

      try {
        const result = await revokeCertificate(did, reason);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        if (e.statusCode === 404) {
          return reply.code(404).send({ error: 'Certificate not found' });
        }
        app.log.error(err);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}
