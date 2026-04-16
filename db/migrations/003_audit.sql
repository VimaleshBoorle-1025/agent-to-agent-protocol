-- AAP Audit Chain Schema
-- Migration 003: Immutable append-only audit log

CREATE TABLE audit_public (
  id             BIGSERIAL PRIMARY KEY,
  chain_id       BIGINT NOT NULL,
  entry_hash     VARCHAR(128) NOT NULL,
  prev_hash      VARCHAR(128) NOT NULL,
  agent_did_hash VARCHAR(128) NOT NULL,
  action_type    VARCHAR(80)  NOT NULL,
  outcome        VARCHAR(20)  NOT NULL,
  timestamp      BIGINT       NOT NULL,
  content_hash   VARCHAR(128) NOT NULL,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- Enforce append-only via row-level security
ALTER TABLE audit_public ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert_only ON audit_public FOR INSERT WITH CHECK (true);

-- No UPDATE or DELETE allowed
CREATE RULE no_update_audit AS ON UPDATE TO audit_public DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_public DO INSTEAD NOTHING;

CREATE INDEX idx_audit_chain_id       ON audit_public(chain_id);
CREATE INDEX idx_audit_agent_did_hash ON audit_public(agent_did_hash);
CREATE INDEX idx_audit_action_type    ON audit_public(action_type);
CREATE INDEX idx_audit_timestamp      ON audit_public(timestamp);
