import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { authenticateDID } from '../middleware/auth';

interface SendBody {
  to_did:         string;
  from_did:       string;
  message_id:     string;
  outer_envelope: string; // base64-encoded encrypted envelope
  expires_at?:    string; // ISO timestamp, default 7 days
}

export async function messageRoutes(app: FastifyInstance, opts: { testMode?: boolean }) {
  const testMode = opts.testMode ?? false;

  // POST /v1/messages/send
  app.post<{ Body: SendBody }>('/messages/send', async (req, reply) => {
    const did = await authenticateDID(req, reply, testMode);
    if (!did) return;

    const { to_did, from_did, message_id, outer_envelope, expires_at } = req.body;

    if (!to_did || !from_did || !message_id || !outer_envelope) {
      return reply.code(400).send({ error: 'MISSING_FIELDS: to_did, from_did, message_id, outer_envelope required' });
    }

    // Rate limit: 1000 messages/hour per from_did
    const countRes = await db.query(
      `SELECT COUNT(*) FROM mailbox_messages
       WHERE from_did = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [from_did]
    );
    const hourCount = parseInt(countRes.rows[0].count, 10);
    if (hourCount >= 1000) {
      return reply.code(429).send({ error: 'RATE_LIMITED: max 1000 messages per hour' });
    }

    const envelope = Buffer.from(outer_envelope, 'base64');
    const expiresAt = expires_at ? new Date(expires_at) : new Date(Date.now() + 7 * 86400_000);

    await db.query(
      `INSERT INTO mailbox_messages (to_did, from_did, message_id, outer_envelope, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [to_did, from_did, message_id, envelope, expiresAt]
    );

    return reply.code(201).send({ message_id, status: 'queued' });
  });

  // GET /v1/messages/inbox
  app.get('/messages/inbox', async (req, reply) => {
    const did = await authenticateDID(req, reply, testMode);
    if (!did) return;

    const result = await db.query(
      `SELECT id, to_did, from_did, message_id, outer_envelope, status, created_at, expires_at
       FROM mailbox_messages
       WHERE to_did = $1 AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at ASC`,
      [did]
    );

    const messages = result.rows.map((row: any) => ({
      id:                row.id,
      from_did:          row.from_did,
      message_id:        row.message_id,
      outer_envelope_b64: Buffer.isBuffer(row.outer_envelope)
        ? row.outer_envelope.toString('base64')
        : Buffer.from(row.outer_envelope).toString('base64'),
      status:     row.status,
      created_at: row.created_at,
      expires_at: row.expires_at,
    }));

    return reply.send({ messages, count: messages.length });
  });

  // POST /v1/messages/:id/ack
  app.post<{ Params: { id: string } }>('/messages/:id/ack', async (req, reply) => {
    const did = await authenticateDID(req, reply, testMode);
    if (!did) return;

    await db.query(
      `UPDATE mailbox_messages
       SET status = 'delivered', delivered_at = NOW()
       WHERE message_id = $1`,
      [req.params.id]
    );

    return reply.send({ success: true });
  });

  // GET /v1/messages/:id/status
  app.get<{ Params: { id: string } }>('/messages/:id/status', async (req, reply) => {
    const did = await authenticateDID(req, reply, testMode);
    if (!did) return;

    const result = await db.query(
      'SELECT message_id, status, created_at, delivered_at, expires_at FROM mailbox_messages WHERE message_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'MESSAGE_NOT_FOUND' });
    }

    return reply.send(result.rows[0]);
  });

  // DELETE /v1/messages/:id — revoke
  app.delete<{ Params: { id: string } }>('/messages/:id', async (req, reply) => {
    const did = await authenticateDID(req, reply, testMode);
    if (!did) return;

    // Check message exists and is still pending
    const check = await db.query(
      'SELECT status FROM mailbox_messages WHERE message_id = $1',
      [req.params.id]
    );

    if (check.rows.length === 0) {
      return reply.code(404).send({ error: 'MESSAGE_NOT_FOUND' });
    }

    if (check.rows[0].status !== 'pending') {
      return reply.code(409).send({ error: 'CANNOT_REVOKE: message already delivered or expired' });
    }

    const result = await db.query(
      `DELETE FROM mailbox_messages WHERE message_id = $1 AND status = 'pending'`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return reply.code(409).send({ error: 'CANNOT_REVOKE: message already delivered' });
    }

    return reply.send({ success: true });
  });
}
