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
