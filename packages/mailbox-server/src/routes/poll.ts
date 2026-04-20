import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { authenticateDID } from '../middleware/auth';

/**
 * REST polling transport — for platforms that cannot maintain a persistent
 * WebSocket connection (background iOS fetch, serverless functions, etc.).
 *
 * POST /v1/relay/send          — enqueue a message for a handle
 * GET  /v1/relay/:handle/poll  — fetch + delete pending messages
 *
 * Messages expire after 5 minutes. A cleanup job runs every 60 s.
 */

interface SendBody {
  to_handle: string;   // aap:// address or bare handle
  payload:   string;   // base64-encoded outer envelope (same format as mailbox)
}

export async function pollRoutes(app: FastifyInstance, opts: { testMode?: boolean }) {
  const testMode = opts.testMode ?? false;

  // Ensure table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS relay_poll_queue (
      id          SERIAL PRIMARY KEY,
      to_handle   TEXT NOT NULL,
      from_did    TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
    );
    CREATE INDEX IF NOT EXISTS relay_poll_handle_idx ON relay_poll_queue (to_handle, created_at);
  `).catch(() => { /* already exists */ });

  // Cleanup expired rows every 60 s
  const cleanup = setInterval(async () => {
    await db.query(`DELETE FROM relay_poll_queue WHERE expires_at < NOW()`).catch(() => {});
  }, 60_000);
  // Allow process to exit even if interval is running
  if (cleanup.unref) cleanup.unref();

  // ── POST /v1/relay/send ──────────────────────────────────────────────────
  app.post<{ Body: SendBody }>('/relay/send', async (req, reply) => {
    const did = await authenticateDID(req, reply, testMode);
    if (!did) return;

    const { to_handle, payload } = req.body;
    if (!to_handle || !payload) {
      return reply.code(400).send({ error: 'MISSING_FIELDS: to_handle and payload required' });
    }

    await db.query(
      `INSERT INTO relay_poll_queue (to_handle, from_did, payload) VALUES ($1, $2, $3)`,
      [to_handle, did, payload]
    );

    return reply.code(201).send({ status: 'queued' });
  });

  // ── GET /v1/relay/:handle/poll ────────────────────────────────────────────
  app.get<{ Params: { handle: string }; Querystring: { since?: string } }>(
    '/relay/:handle/poll',
    async (req, reply) => {
      const did = await authenticateDID(req, reply, testMode);
      if (!did) return;

      const handle = decodeURIComponent(req.params.handle);
      const since  = req.query.since ? new Date(req.query.since) : new Date(0);

      // Fetch and immediately delete — acts as a destructive read
      const result = await db.query(
        `DELETE FROM relay_poll_queue
         WHERE to_handle = $1 AND created_at > $2 AND expires_at > NOW()
         RETURNING id, from_did, payload, created_at`,
        [handle, since]
      );

      const messages = result.rows.map((r: any) => ({
        id:         r.id,
        from_did:   r.from_did,
        payload:    r.payload,
        created_at: r.created_at,
      }));

      return reply.send({ messages, count: messages.length });
    }
  );
}
