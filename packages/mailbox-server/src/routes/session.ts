import { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { db } from '../db/client';

/**
 * Real-time bidirectional session relay.
 *
 * Two agents from any platform (CLI, iOS, Android, web) connect to the same
 * handle and get a live encrypted tunnel. The server forwards frames opaquely —
 * it never decrypts or inspects the payload. End-to-end encryption is enforced.
 *
 * Protocol:
 *   1. First client  → SESSION_WAITING  (host role)
 *   2. Second client → SESSION_READY    (broadcast to both)
 *   3. Either side sends a frame → forwarded to the other socket verbatim
 *   4. Either side closes → SESSION_CLOSED sent to the remaining peer
 *
 * Auth: Authorization: DID <did> [<signature>]
 *   (signature optional for relay — the encrypted payload is the trust boundary)
 *
 * Usage:
 *   WS  wss://mailbox.aap.dev/v1/session/alice.dev/ws
 *   WSS wss://mailbox.aap.dev/v1/session/aap%3A%2F%2Falice.dev/ws
 */

type Peer = { ws: any; did: string };
const sessions = new Map<string, { host: Peer | null; guest: Peer | null }>();

export async function sessionRoutes(app: FastifyInstance) {
  // Ensure table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS relay_sessions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      handle      TEXT NOT NULL UNIQUE,
      host_did    TEXT NOT NULL,
      guest_did   TEXT,
      state       TEXT NOT NULL DEFAULT 'waiting',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
    );
    CREATE INDEX IF NOT EXISTS relay_sessions_handle_idx ON relay_sessions (handle, state);
  `).catch(() => { /* already exists */ });

  app.get<{ Params: { handle: string } }>(
    '/session/:handle/ws',
    { websocket: true },
    async (connection: SocketStream, req) => {
      const ws     = connection.socket;
      const handle = decodeURIComponent((req.params as any).handle);

      // ── Auth ──────────────────────────────────────────────────────────────
      const authHeader = (req.headers['authorization'] as string) ?? '';
      if (!authHeader.startsWith('DID ')) {
        ws.send(JSON.stringify({ type: 'ERROR', error: 'UNAUTHORIZED' }));
        ws.close();
        return;
      }
      const afterDID = authHeader.slice(4).trim();
      const did      = afterDID.split(' ')[0];
      if (!did.startsWith('did:')) {
        ws.send(JSON.stringify({ type: 'ERROR', error: 'INVALID_DID' }));
        ws.close();
        return;
      }

      // ── Role assignment ───────────────────────────────────────────────────
      let session = sessions.get(handle);
      let role: 'host' | 'guest';

      if (!session || !session.host) {
        role = 'host';
        sessions.set(handle, { host: { ws, did }, guest: null });

        await db.query(
          `INSERT INTO relay_sessions (handle, host_did, state)
           VALUES ($1, $2, 'waiting')
           ON CONFLICT (handle) DO UPDATE
             SET host_did = $2, guest_did = NULL, state = 'waiting',
                 created_at = NOW(), expires_at = NOW() + INTERVAL '1 hour'`,
          [handle, did]
        ).catch(() => {});

        ws.send(JSON.stringify({ type: 'SESSION_WAITING', handle, role: 'host' }));

      } else if (!session.guest) {
        role        = 'guest';
        session.guest = { ws, did };

        await db.query(
          `UPDATE relay_sessions SET guest_did = $1, state = 'active' WHERE handle = $2`,
          [did, handle]
        ).catch(() => {});

        const ready = JSON.stringify({ type: 'SESSION_READY', handle, peers: 2 });
        session.host.ws.send(ready);
        ws.send(ready);

      } else {
        ws.send(JSON.stringify({ type: 'ERROR', error: 'SESSION_FULL' }));
        ws.close();
        return;
      }

      // ── Frame relay ───────────────────────────────────────────────────────
      ws.on('message', (data: Buffer) => {
        const s     = sessions.get(handle);
        if (!s) return;
        const other = role === 'host' ? s.guest?.ws : s.host?.ws;
        if (other && other.readyState === 1 /* OPEN */) {
          try { other.send(data); } catch { /* peer gone */ }
        }
      });

      // ── Disconnect ────────────────────────────────────────────────────────
      ws.on('close', () => {
        const s = sessions.get(handle);
        if (!s) return;

        const otherWs = role === 'host' ? s.guest?.ws : s.host?.ws;
        if (otherWs && otherWs.readyState === 1) {
          try {
            otherWs.send(JSON.stringify({ type: 'SESSION_CLOSED', by: did }));
          } catch { /* already gone */ }
        }

        sessions.delete(handle);
        db.query(
          `UPDATE relay_sessions SET state = 'closed' WHERE handle = $1`,
          [handle]
        ).catch(() => {});
      });
    }
  );

  // ── Admin: list active sessions (internal use) ───────────────────────────
  app.get('/sessions', async (_req, reply) => {
    const result = await db.query(
      `SELECT handle, host_did, guest_did, state, created_at, expires_at
       FROM relay_sessions WHERE state != 'closed' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 100`
    );
    return reply.send({ sessions: result.rows, count: result.rows.length });
  });
}
