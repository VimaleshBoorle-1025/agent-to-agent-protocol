/**
 * Synapse social routes — feed posts and direct messaging.
 * Mounted at /v1/social inside registry-server.
 *
 * Auth: most write routes require Authorization: Bearer <jwt>
 * JWT is the same token issued by /v1/auth/* routes.
 */

import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

// ── Auth helper ───────────────────────────────────────────────────────────────

function getUser(req: any): { sub: string; handle: string; email: string } | null {
  try {
    const raw = (req.headers['authorization'] as string)?.replace('Bearer ', '');
    if (!raw) return null;
    return jwt.verify(raw, JWT_SECRET) as any;
  } catch { return null; }
}

// ── Table bootstrap ───────────────────────────────────────────────────────────

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS feed_posts (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID,
      handle     TEXT NOT NULL,
      name       TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL,
      tags       TEXT[] DEFAULT '{}',
      type       TEXT NOT NULL DEFAULT 'post',
      likes      INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS feed_post_likes (
      post_id UUID,
      user_id UUID,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS synapse_messages (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_handle  TEXT NOT NULL,
      to_handle    TEXT NOT NULL,
      content      TEXT NOT NULL,
      read         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS feed_posts_created_idx ON feed_posts (created_at DESC);
    CREATE INDEX IF NOT EXISTS synapse_messages_to_idx ON synapse_messages (to_handle, created_at DESC);
    CREATE INDEX IF NOT EXISTS synapse_messages_pair_idx ON synapse_messages (
      LEAST(from_handle, to_handle), GREATEST(from_handle, to_handle), created_at DESC
    );
  `).catch(() => { /* already exists */ });
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function socialRoutes(app: FastifyInstance) {
  await ensureTables();

  // ── Feed ─────────────────────────────────────────────────────────────────

  /** GET /v1/social/feed?limit=&offset=&type= */
  app.get<{ Querystring: { limit?: string; offset?: string; type?: string } }>(
    '/social/feed', async (req, reply) => {
      const limit  = Math.min(parseInt(req.query.limit  ?? '30', 10), 100);
      const offset = parseInt(req.query.offset ?? '0', 10);
      const type   = req.query.type;

      // Get current user for liked status
      const me = getUser(req);

      let sql  = `SELECT p.*`;
      const vals: unknown[] = [];

      if (me?.sub) {
        sql += `,
          EXISTS(
            SELECT 1 FROM feed_post_likes l WHERE l.post_id = p.id AND l.user_id = $1
          ) AS liked`;
        vals.push(me.sub);
      } else {
        sql += `, false AS liked`;
      }

      sql += ` FROM feed_posts p WHERE 1=1`;
      if (type) { vals.push(type); sql += ` AND p.type = $${vals.length}`; }

      sql += ` ORDER BY p.created_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`;
      vals.push(limit, offset);

      const result = await db.query(sql, vals);
      return reply.send({ posts: result.rows, limit, offset });
    }
  );

  /** POST /v1/social/posts — create a feed post */
  app.post<{ Body: { content: string; tags?: string[]; type?: string } }>(
    '/social/posts', async (req, reply) => {
      const me = getUser(req);
      if (!me) return reply.code(401).send({ error: 'Unauthorized' });

      const { content, tags = [], type = 'post' } = req.body;
      if (!content?.trim()) return reply.code(400).send({ error: 'content required' });

      // Get user's handle and name
      const userRow = await db.query(
        `SELECT handle, name FROM synapse_users WHERE id = $1`, [me.sub]
      );
      const handle = userRow.rows[0]?.handle ?? me.handle ?? '';
      const name   = userRow.rows[0]?.name   ?? '';

      if (!handle) return reply.code(400).send({ error: 'Complete your profile before posting' });

      const post = await db.query(
        `INSERT INTO feed_posts (user_id, handle, name, content, tags, type)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *, false AS liked`,
        [me.sub, handle, name, content.trim(), tags, type]
      );
      return reply.code(201).send(post.rows[0]);
    }
  );

  /** POST /v1/social/posts/:id/like — toggle like */
  app.post<{ Params: { id: string } }>('/social/posts/:id/like', async (req, reply) => {
    const me = getUser(req);
    if (!me) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    // Try to insert a like — if already liked, delete it
    const existing = await db.query(
      `SELECT 1 FROM feed_post_likes WHERE post_id = $1 AND user_id = $2`, [id, me.sub]
    );
    if (existing.rows.length > 0) {
      await db.query(`DELETE FROM feed_post_likes WHERE post_id = $1 AND user_id = $2`, [id, me.sub]);
      await db.query(`UPDATE feed_posts SET likes = GREATEST(0, likes - 1) WHERE id = $1`, [id]);
      return reply.send({ liked: false });
    } else {
      await db.query(`INSERT INTO feed_post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, me.sub]);
      await db.query(`UPDATE feed_posts SET likes = likes + 1 WHERE id = $1`, [id]);
      return reply.send({ liked: true });
    }
  });

  // ── Messaging ─────────────────────────────────────────────────────────────

  /** GET /v1/social/conversations — list all conversation threads for current user */
  app.get('/social/conversations', async (req, reply) => {
    const me = getUser(req);
    if (!me) return reply.code(401).send({ error: 'Unauthorized' });

    const userRow = await db.query(`SELECT handle FROM synapse_users WHERE id = $1`, [me.sub]);
    const handle  = userRow.rows[0]?.handle;
    if (!handle) return reply.send({ conversations: [] });

    // Get the last message per conversation thread + unread count
    const result = await db.query(`
      SELECT
        CASE WHEN from_handle = $1 THEN to_handle ELSE from_handle END AS other_handle,
        MAX(created_at) AS last_ts,
        (SELECT content FROM synapse_messages m2
          WHERE (m2.from_handle = $1 AND m2.to_handle = CASE WHEN m.from_handle = $1 THEN m.to_handle ELSE m.from_handle END)
             OR (m2.to_handle = $1 AND m2.from_handle = CASE WHEN m.from_handle = $1 THEN m.to_handle ELSE m.from_handle END)
          ORDER BY created_at DESC LIMIT 1) AS last_message,
        COUNT(*) FILTER (WHERE to_handle = $1 AND read = false) AS unread
      FROM synapse_messages m
      WHERE from_handle = $1 OR to_handle = $1
      GROUP BY other_handle
      ORDER BY last_ts DESC
    `, [handle]);

    // Enrich with names from synapse_users
    const conversations = await Promise.all(result.rows.map(async (row: any) => {
      const userInfo = await db.query(
        `SELECT name, handle FROM synapse_users WHERE handle = $1`, [row.other_handle]
      );
      return {
        id:           row.other_handle,
        with:         row.other_handle,
        with_name:    userInfo.rows[0]?.name ?? row.other_handle,
        last_message: row.last_message ?? '',
        last_ts:      row.last_ts,
        unread:       parseInt(row.unread, 10),
        messages:     [],
      };
    }));

    return reply.send({ conversations });
  });

  /** GET /v1/social/messages/:handle — get messages with a specific handle */
  app.get<{ Params: { handle: string }; Querystring: { limit?: string } }>(
    '/social/messages/:handle', async (req, reply) => {
      const me = getUser(req);
      if (!me) return reply.code(401).send({ error: 'Unauthorized' });

      const userRow = await db.query(`SELECT handle FROM synapse_users WHERE id = $1`, [me.sub]);
      const myHandle = userRow.rows[0]?.handle;
      if (!myHandle) return reply.code(400).send({ error: 'No handle set' });

      const otherHandle = req.params.handle;
      const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);

      // Mark incoming as read
      await db.query(
        `UPDATE synapse_messages SET read = true WHERE from_handle = $1 AND to_handle = $2 AND read = false`,
        [otherHandle, myHandle]
      );

      const result = await db.query(`
        SELECT id, from_handle, to_handle, content, read, created_at
        FROM synapse_messages
        WHERE (from_handle = $1 AND to_handle = $2)
           OR (from_handle = $2 AND to_handle = $1)
        ORDER BY created_at ASC
        LIMIT $3
      `, [myHandle, otherHandle, limit]);

      const messages = result.rows.map((r: any) => ({
        id:      r.id,
        from:    r.from_handle,
        to:      r.to_handle,
        content: r.content,
        ts:      r.created_at,
        read:    r.read,
      }));

      return reply.send({ messages });
    }
  );

  /** POST /v1/social/messages — send a message */
  app.post<{ Body: { to_handle: string; content: string } }>(
    '/social/messages', async (req, reply) => {
      const me = getUser(req);
      if (!me) return reply.code(401).send({ error: 'Unauthorized' });

      const userRow = await db.query(`SELECT handle FROM synapse_users WHERE id = $1`, [me.sub]);
      const myHandle = userRow.rows[0]?.handle;
      if (!myHandle) return reply.code(400).send({ error: 'No handle set' });

      const { to_handle, content } = req.body;
      if (!to_handle?.trim() || !content?.trim()) {
        return reply.code(400).send({ error: 'to_handle and content required' });
      }

      const msg = await db.query(
        `INSERT INTO synapse_messages (from_handle, to_handle, content)
         VALUES ($1,$2,$3) RETURNING *`,
        [myHandle, to_handle.trim(), content.trim()]
      );
      const r = msg.rows[0];
      return reply.code(201).send({
        id:      r.id,
        from:    r.from_handle,
        to:      r.to_handle,
        content: r.content,
        ts:      r.created_at,
        read:    r.read,
      });
    }
  );

  /** GET /v1/social/unread — total unread message count */
  app.get('/social/unread', async (req, reply) => {
    const me = getUser(req);
    if (!me) return reply.send({ count: 0 });

    const userRow = await db.query(`SELECT handle FROM synapse_users WHERE id = $1`, [me.sub]);
    const handle  = userRow.rows[0]?.handle;
    if (!handle) return reply.send({ count: 0 });

    const r = await db.query(
      `SELECT COUNT(*) FROM synapse_messages WHERE to_handle = $1 AND read = false`, [handle]
    );
    return reply.send({ count: parseInt(r.rows[0].count, 10) });
  });
}
