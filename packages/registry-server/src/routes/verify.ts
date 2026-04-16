import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { getTwilioClient } from '../services/twilio';
import { v4 as uuidv4 } from 'uuid';

export async function verifyRoutes(app: FastifyInstance) {

  // POST /v1/verify/phone — send OTP
  app.post<{ Body: { agent_did: string; phone_number: string } }>(
    '/verify/phone',
    async (req, reply) => {
      const { agent_did, phone_number } = req.body;

      // Rate limit: max 5 attempts per phone per hour
      const attempts = await db.query(
        `SELECT count(*) FROM pending_verifications
         WHERE phone_number = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [phone_number]
      );
      if (parseInt(attempts.rows[0].count) >= 5) {
        return reply.code(429).send({ error: 'RATE_LIMITED: max 5 OTP attempts per hour' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otp_token = uuidv4();
      const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await db.query(
        `INSERT INTO pending_verifications
           (agent_did, phone_number, otp_code, otp_token, expires_at, used)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [agent_did, phone_number, otp, otp_token, expires_at]
      );

      // Send OTP via Twilio
      const twilioEnabled = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
      if (twilioEnabled) {
        const client = getTwilioClient();
        await client.messages.create({
          body: `Your AAP verification code is: ${otp}. Valid for 5 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to:   phone_number,
        });
      } else {
        // Development mode — log OTP to console
        app.log.info(`[DEV] OTP for ${phone_number}: ${otp}`);
      }

      return reply.send({ status: 'otp_sent', expires_in: 300 });
    }
  );

  // POST /v1/verify/phone/confirm — validate OTP
  app.post<{ Body: { agent_did: string; otp_token: string; otp_code: string } }>(
    '/verify/phone/confirm',
    async (req, reply) => {
      const { agent_did, otp_token, otp_code } = req.body;

      const record = await db.query(
        `SELECT * FROM pending_verifications
         WHERE agent_did = $1 AND otp_token = $2
           AND otp_code = $3 AND expires_at > NOW() AND used = false`,
        [agent_did, otp_token, otp_code]
      );

      if (record.rows.length === 0) {
        return reply.code(400).send({ error: 'INVALID_OTP: code is incorrect, expired, or already used' });
      }

      // Mark OTP as used
      await db.query(
        'UPDATE pending_verifications SET used = true WHERE otp_token = $1',
        [otp_token]
      );

      // Upgrade agent verification level
      await db.query(
        `UPDATE agents
         SET verification_level = 'personal_verified',
             trust_score = GREATEST(trust_score, 70),
             did_document = jsonb_set(did_document, '{verificationLevel}', '"personal_verified"'),
             updated_at = NOW()
         WHERE did = $1`,
        [agent_did]
      );

      return reply.send({ status: 'verified', verification_level: 'personal_verified' });
    }
  );

  // POST /v1/verify/gleif — business entity verification
  app.post<{ Body: { agent_did: string; gleif_id: string; legal_name: string; country: string } }>(
    '/verify/gleif',
    async (req, reply) => {
      const { agent_did, gleif_id, legal_name, country } = req.body;

      // Call GLEIF API to verify entity
      try {
        const gleifUrl = `${process.env.GLEIF_API_URL}/lei-records/${gleif_id}`;
        const response = await fetch(gleifUrl);
        if (!response.ok) {
          return reply.code(400).send({ error: 'GLEIF_NOT_FOUND: entity not found in GLEIF registry' });
        }

        const data = await response.json() as { data?: { attributes?: { entity?: { legalName?: { name?: string }; status?: string } } } };
        const entity = data?.data?.attributes?.entity;

        if (!entity || entity.status !== 'ACTIVE') {
          return reply.code(400).send({ error: 'GLEIF_INACTIVE: legal entity is not active' });
        }

        const registeredName = entity.legalName?.name?.toLowerCase();
        if (registeredName && !registeredName.includes(legal_name.toLowerCase())) {
          return reply.code(400).send({ error: 'GLEIF_NAME_MISMATCH: legal name does not match GLEIF record' });
        }

        // Store pending business verification (manual review for edge cases)
        await db.query(
          `INSERT INTO business_verifications (agent_did, gleif_id, legal_name, country, status)
           VALUES ($1, $2, $3, $4, 'pending_review')`,
          [agent_did, gleif_id, legal_name, country]
        );

        return reply.send({ status: 'under_review', estimated_days: '2-5' });
      } catch (err) {
        app.log.error(err);
        return reply.code(502).send({ error: 'GLEIF_API_ERROR: could not reach GLEIF API' });
      }
    }
  );
}
