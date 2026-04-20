-- AAP Database Migration v1.0
-- Run against Railway PostgreSQL

-- ─── Registry Service ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
  id                 SERIAL PRIMARY KEY,
  aap_address        TEXT NOT NULL UNIQUE,
  did                TEXT NOT NULL UNIQUE,
  public_key_hex     TEXT NOT NULL,
  did_document       JSONB NOT NULL,
  endpoint_url       TEXT NOT NULL,
  verification_level TEXT NOT NULL DEFAULT 'unverified',
  trust_score        INTEGER NOT NULL DEFAULT 50,
  interaction_count  INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS used_nonces (
  nonce      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-expire nonces older than 5 minutes (cleanup index)
CREATE INDEX IF NOT EXISTS used_nonces_created_idx ON used_nonces (created_at);

-- ─── Mailbox Service ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mailbox_messages (
  id              SERIAL PRIMARY KEY,
  to_did          TEXT NOT NULL,
  from_did        TEXT NOT NULL,
  message_id      TEXT NOT NULL UNIQUE,
  outer_envelope  BYTEA NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS mailbox_to_did_status_idx ON mailbox_messages (to_did, status);
CREATE INDEX IF NOT EXISTS mailbox_from_did_created_idx ON mailbox_messages (from_did, created_at);

-- ─── Audit Service ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_public (
  id             SERIAL PRIMARY KEY,
  chain_id       INTEGER NOT NULL DEFAULT 1,
  entry_hash     TEXT NOT NULL UNIQUE,
  prev_hash      TEXT NOT NULL,
  agent_did_hash TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  outcome        TEXT NOT NULL,
  timestamp      BIGINT NOT NULL,
  content_hash   TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_chain_id_idx ON audit_public (chain_id, id);

-- ─── Workspace / Collab (v1.1) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  tags        TEXT[]   DEFAULT '{}',
  owner_did   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',      -- open | in_progress | completed | published
  visibility  TEXT NOT NULL DEFAULT 'public',    -- public | private
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_owner_idx  ON projects (owner_did);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);

CREATE TABLE IF NOT EXISTS project_members (
  id         SERIAL PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_did  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'contributor',  -- owner | contributor | observer
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, agent_did)
);

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  created_by  TEXT NOT NULL,
  assigned_to TEXT,
  status      TEXT NOT NULL DEFAULT 'open',    -- open | claimed | in_progress | review | done
  priority    TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high | urgent
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_project_idx     ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx    ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_status_idx      ON tasks (status);

CREATE TABLE IF NOT EXISTS publications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL,
  content      TEXT,
  tags         TEXT[] DEFAULT '{}',
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_activity (
  id         SERIAL PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_did  TEXT NOT NULL,
  action     TEXT NOT NULL,  -- project_created | task_added | task_claimed | task_done | member_joined | published
  detail     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_project_idx ON project_activity (project_id, created_at DESC);

-- ── Session Relay ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relay_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle      TEXT NOT NULL UNIQUE,
  host_did    TEXT NOT NULL,
  guest_did   TEXT,
  state       TEXT NOT NULL DEFAULT 'waiting',  -- waiting | active | closed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS relay_sessions_handle_idx ON relay_sessions (handle, state);

-- ── Poll Queue (REST fallback for platforms without WebSocket) ────────────────

CREATE TABLE IF NOT EXISTS relay_poll_queue (
  id          SERIAL PRIMARY KEY,
  to_handle   TEXT NOT NULL,
  from_did    TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX IF NOT EXISTS relay_poll_handle_idx ON relay_poll_queue (to_handle, created_at);
