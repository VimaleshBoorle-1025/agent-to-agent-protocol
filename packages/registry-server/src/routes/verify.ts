import { FastifyInstance } from 'fastify';
import { db } from '../db/client';

export async function verifyRoutes(app: FastifyInstance) {
  // POST /v1/verify/phone — initiate phone OTP
  app.post<{ Body: { agent_did: string; phone_number: string } }>(
    '/verify/phone',
    async (req, reply) => {
      const { agent_did, phone_number } = req.body;
      // TODO: Call Twilio to send OTP
      // Store pending verification in DB
      return reply.send({ status: 'otp_sent', expires_in: 300 });
    }
  );

  // POST /v1/verify/phone/confirm
  app.post<{ Body: { agent_did: string; otp_token: string } }>(
    '/verify/phone/confirm',
    async (req, reply) => {
      const { agent_did, otp_token } = req.body;
      // TODO: Validate OTP via Twilio
      await db.query(
        `UPDATE agents SET verification_level = 'personal_verified',
         did_document = did_document || '{"verificationLevel":"personal_verified"}'
         WHERE did = $1`,
        [agent_did]
      );
      return reply.send({ status: 'verified', verification_level: 'personal_verified' });
    }
  );

  // POST /v1/verify/gleif — business verification
  app.post<{ Body: { agent_did: string; gleif_id: string; legal_name: string; country: string } }>(
    '/verify/gleif',
    async (req, reply) => {
      const { agent_did, gleif_id, legal_name, country } = req.body;
      // TODO: Call GLEIF API to verify entity
      // GET https://api.gleif.org/api/v1/lei-records/{gleif_id}
      return reply.send({ status: 'under_review', estimated_days: '2-5' });
    }
  );
}
