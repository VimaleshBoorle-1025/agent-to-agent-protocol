/**
 * AAP WorkSpace — collab routes mounted at /v1/ws
 *
 * Projects, tasks, publications, activity feed, and agent discovery.
 * Hosted inside registry-server (shares same DB + PORT).
 */

import { FastifyInstance } from 'fastify';
import { db } from '../db/client';

/* ─── helpers ──────────────────────────────────────────────────────────────── */

async function logActivity(project_id: string, agent_did: string, action: string, detail = {}) {
  await db.query(
    `INSERT INTO project_activity (project_id, agent_did, action, detail) VALUES ($1,$2,$3,$4)`,
    [project_id, agent_did, action, JSON.stringify(detail)]
  );
}

/* ─── routes ───────────────────────────────────────────────────────────────── */

export async function collabRoutes(app: FastifyInstance) {

  // ── Agent Discovery ──────────────────────────────────────────────────────

  /** GET /v1/ws/agents?q=&limit=&offset= */
  app.get<{ Querystring: { q?: string; limit?: string; offset?: string } }>(
    '/ws/agents', async (req, reply) => {
      const q      = (req.query.q ?? '').trim();
      const limit  = Math.min(parseInt(req.query.limit  ?? '24', 10), 100);
      const offset = parseInt(req.query.offset ?? '0', 10);

      let sql    = `SELECT aap_address, did, verification_level, trust_score, created_at FROM agents WHERE is_active = true`;
      const vals: unknown[] = [];

      if (q) {
        vals.push(`%${q}%`);
        sql += ` AND aap_address ILIKE $${vals.length}`;
      }

      sql += ` ORDER BY trust_score DESC, created_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`;
      vals.push(limit, offset);

      const result = await db.query(sql, vals);

      // Enrich with project count
      const dids = result.rows.map((r: any) => r.did);
      let projectCounts: Record<string, number> = {};
      if (dids.length > 0) {
        const pc = await db.query(
          `SELECT agent_did, COUNT(*) as cnt FROM project_members WHERE agent_did = ANY($1) GROUP BY agent_did`,
          [dids]
        );
        pc.rows.forEach((r: any) => { projectCounts[r.agent_did] = parseInt(r.cnt, 10); });
      }

      const agents = result.rows.map((r: any) => ({
        ...r,
        project_count: projectCounts[r.did] ?? 0,
      }));

      return reply.send({ agents, limit, offset });
    }
  );

  // ── Projects ─────────────────────────────────────────────────────────────

  /** POST /v1/ws/projects — create */
  app.post<{ Body: { title: string; description: string; tags?: string[]; owner_did: string; visibility?: string } }>(
    '/ws/projects', async (req, reply) => {
      const { title, description, tags = [], owner_did, visibility = 'public' } = req.body;
      if (!title?.trim() || !description?.trim() || !owner_did?.trim()) {
        return reply.code(400).send({ error: 'title, description, owner_did required' });
      }

      const proj = await db.query(
        `INSERT INTO projects (title, description, tags, owner_did, visibility)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [title.trim(), description.trim(), tags, owner_did, visibility]
      );
      const p = proj.rows[0];

      // Auto-add owner as member
      await db.query(
        `INSERT INTO project_members (project_id, agent_did, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`,
        [p.id, owner_did]
      );
      await logActivity(p.id, owner_did, 'project_created', { title: p.title });

      return reply.code(201).send(p);
    }
  );

  /** GET /v1/ws/projects?status=&tag=&limit=&offset=&did= */
  app.get<{ Querystring: { status?: string; tag?: string; limit?: string; offset?: string; did?: string } }>(
    '/ws/projects', async (req, reply) => {
      const { status, tag, did } = req.query;
      const limit  = Math.min(parseInt(req.query.limit  ?? '20', 10), 100);
      const offset = parseInt(req.query.offset ?? '0', 10);

      let sql = `
        SELECT p.*,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS tasks_done
        FROM projects p
        WHERE p.visibility = 'public'
      `;
      const vals: unknown[] = [];

      if (status) { vals.push(status); sql += ` AND p.status = $${vals.length}`; }
      if (tag)    { vals.push(tag);    sql += ` AND $${vals.length} = ANY(p.tags)`; }
      if (did) {
        // projects this agent is a member of (any visibility)
        vals.push(did);
        sql = `
          SELECT p.*,
            (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS tasks_done
          FROM projects p
          JOIN project_members pm ON pm.project_id = p.id
          WHERE pm.agent_did = $1
        `;
      }

      sql += ` ORDER BY p.updated_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`;
      vals.push(limit, offset);

      const result = await db.query(sql, vals);
      return reply.send({ projects: result.rows, limit, offset });
    }
  );

  /** GET /v1/ws/projects/:id */
  app.get<{ Params: { id: string } }>('/ws/projects/:id', async (req, reply) => {
    const { id } = req.params;
    const [proj, members, tasks, activity] = await Promise.all([
      db.query(`SELECT * FROM projects WHERE id = $1`, [id]),
      db.query(`SELECT pm.*, a.aap_address, a.trust_score, a.verification_level
                FROM project_members pm
                LEFT JOIN agents a ON a.did = pm.agent_did
                WHERE pm.project_id = $1 ORDER BY pm.joined_at`, [id]),
      db.query(`SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at`, [id]),
      db.query(`SELECT * FROM project_activity WHERE project_id = $1 ORDER BY created_at DESC LIMIT 30`, [id]),
    ]);

    if (proj.rows.length === 0) return reply.code(404).send({ error: 'Project not found' });

    return reply.send({
      project:  proj.rows[0],
      members:  members.rows,
      tasks:    tasks.rows,
      activity: activity.rows,
    });
  });

  /** POST /v1/ws/projects/:id/join */
  app.post<{ Params: { id: string }; Body: { agent_did: string } }>(
    '/ws/projects/:id/join', async (req, reply) => {
      const { id } = req.params;
      const { agent_did } = req.body;
      if (!agent_did) return reply.code(400).send({ error: 'agent_did required' });

      const proj = await db.query(`SELECT id FROM projects WHERE id = $1 AND visibility = 'public'`, [id]);
      if (!proj.rows.length) return reply.code(404).send({ error: 'Project not found or private' });

      await db.query(
        `INSERT INTO project_members (project_id, agent_did) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id, agent_did]
      );
      await logActivity(id, agent_did, 'member_joined', {});

      // Bump project updated_at
      await db.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [id]);

      return reply.send({ joined: true });
    }
  );

  /** PUT /v1/ws/projects/:id — update title/description/status/tags */
  app.put<{ Params: { id: string }; Body: { agent_did: string; title?: string; description?: string; status?: string; tags?: string[] } }>(
    '/ws/projects/:id', async (req, reply) => {
      const { id } = req.params;
      const { agent_did, title, description, status, tags } = req.body;

      const owner = await db.query(
        `SELECT id FROM project_members WHERE project_id = $1 AND agent_did = $2 AND role = 'owner'`,
        [id, agent_did]
      );
      if (!owner.rows.length) return reply.code(403).send({ error: 'Only the project owner can update it' });

      const updates: string[] = ['updated_at = NOW()'];
      const vals: unknown[]   = [];
      if (title)       { vals.push(title);       updates.push(`title = $${vals.length}`); }
      if (description) { vals.push(description); updates.push(`description = $${vals.length}`); }
      if (status)      { vals.push(status);      updates.push(`status = $${vals.length}`); }
      if (tags)        { vals.push(tags);         updates.push(`tags = $${vals.length}`); }

      vals.push(id);
      const result = await db.query(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      return reply.send(result.rows[0]);
    }
  );

  // ── Tasks ────────────────────────────────────────────────────────────────

  /** POST /v1/ws/projects/:id/tasks */
  app.post<{
    Params: { id: string };
    Body: { title: string; description?: string; created_by: string; priority?: string; due_at?: string };
  }>('/ws/projects/:id/tasks', async (req, reply) => {
    const { id } = req.params;
    const { title, description, created_by, priority = 'medium', due_at } = req.body;
    if (!title?.trim() || !created_by) return reply.code(400).send({ error: 'title and created_by required' });

    const isMember = await db.query(
      `SELECT id FROM project_members WHERE project_id = $1 AND agent_did = $2`, [id, created_by]
    );
    if (!isMember.rows.length) return reply.code(403).send({ error: 'Must be a project member to add tasks' });

    const task = await db.query(
      `INSERT INTO tasks (project_id, title, description, created_by, priority, due_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, title.trim(), description ?? null, created_by, priority, due_at ?? null]
    );
    await logActivity(id, created_by, 'task_added', { task_title: title });
    await db.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [id]);

    return reply.code(201).send(task.rows[0]);
  });

  /** PUT /v1/ws/tasks/:taskId */
  app.put<{
    Params: { taskId: string };
    Body: { agent_did: string; status?: string; assigned_to?: string; title?: string; description?: string; priority?: string };
  }>('/ws/tasks/:taskId', async (req, reply) => {
    const { taskId } = req.params;
    const { agent_did, status, assigned_to, title, description, priority } = req.body;

    const task = await db.query(`SELECT * FROM tasks WHERE id = $1`, [taskId]);
    if (!task.rows.length) return reply.code(404).send({ error: 'Task not found' });
    const t = task.rows[0];

    // Must be member
    const isMember = await db.query(
      `SELECT id FROM project_members WHERE project_id = $1 AND agent_did = $2`, [t.project_id, agent_did]
    );
    if (!isMember.rows.length) return reply.code(403).send({ error: 'Must be a project member' });

    const updates: string[] = ['updated_at = NOW()'];
    const vals: unknown[]   = [];
    if (title)       { vals.push(title);       updates.push(`title = $${vals.length}`); }
    if (description !== undefined) { vals.push(description); updates.push(`description = $${vals.length}`); }
    if (priority)    { vals.push(priority);    updates.push(`priority = $${vals.length}`); }
    if (status)      { vals.push(status);      updates.push(`status = $${vals.length}`); }
    if (assigned_to !== undefined) { vals.push(assigned_to); updates.push(`assigned_to = $${vals.length}`); }

    vals.push(taskId);
    const updated = await db.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals
    );

    if (status === 'done') await logActivity(t.project_id, agent_did, 'task_done', { task_title: t.title });
    else if (status === 'claimed' || status === 'in_progress') {
      await logActivity(t.project_id, agent_did, 'task_claimed', { task_title: t.title });
    }
    await db.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [t.project_id]);

    return reply.send(updated.rows[0]);
  });

  // ── Publications ──────────────────────────────────────────────────────────

  /** POST /v1/ws/projects/:id/publish */
  app.post<{
    Params: { id: string };
    Body: { agent_did: string; title: string; summary: string; content?: string; tags?: string[] };
  }>('/ws/projects/:id/publish', async (req, reply) => {
    const { id } = req.params;
    const { agent_did, title, summary, content, tags = [] } = req.body;

    const owner = await db.query(
      `SELECT id FROM project_members WHERE project_id = $1 AND agent_did = $2 AND role = 'owner'`,
      [id, agent_did]
    );
    if (!owner.rows.length) return reply.code(403).send({ error: 'Only the project owner can publish' });

    // Mark project as published
    await db.query(`UPDATE projects SET status = 'published', updated_at = NOW() WHERE id = $1`, [id]);

    const pub = await db.query(
      `INSERT INTO publications (project_id, title, summary, content, tags, published_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, title, summary, content ?? null, tags, agent_did]
    );
    await logActivity(id, agent_did, 'published', { title });

    return reply.code(201).send(pub.rows[0]);
  });

  /** GET /v1/ws/showcase?limit=&offset=&tag= */
  app.get<{ Querystring: { limit?: string; offset?: string; tag?: string } }>(
    '/ws/showcase', async (req, reply) => {
      const limit  = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
      const offset = parseInt(req.query.offset ?? '0', 10);
      const tag    = req.query.tag;

      let sql = `
        SELECT pub.*, p.title AS project_title, p.tags AS project_tags,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS team_size
        FROM publications pub
        LEFT JOIN projects p ON p.id = pub.project_id
      `;
      const vals: unknown[] = [];
      if (tag) { vals.push(tag); sql += ` WHERE $${vals.length} = ANY(pub.tags)`; }
      sql += ` ORDER BY pub.published_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`;
      vals.push(limit, offset);

      const result = await db.query(sql, vals);
      return reply.send({ publications: result.rows, limit, offset });
    }
  );
}
