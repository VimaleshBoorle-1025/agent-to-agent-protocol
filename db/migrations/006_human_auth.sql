-- Migration 006: Human Authorization Service
-- Persistent approval log (queue is in-memory/Redis; this is the audit trail)

CREATE TABLE IF NOT EXISTS human_approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id     UUID NOT NULL UNIQUE,
    agent_did       TEXT NOT NULL,
    action_type     TEXT NOT NULL,
    params          JSONB NOT NULL DEFAULT '{}',
    risk_category   SMALLINT NOT NULL CHECK (risk_category BETWEEN 1 AND 4),
    requires_mfa    BOOLEAN NOT NULL DEFAULT FALSE,
    status          TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','timeout')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    resolved_at     TIMESTAMPTZ,
    approved_by     TEXT,
    mfa_verified    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_human_approvals_status     ON human_approvals(status);
CREATE INDEX IF NOT EXISTS idx_human_approvals_agent_did  ON human_approvals(agent_did);
CREATE INDEX IF NOT EXISTS idx_human_approvals_created_at ON human_approvals(created_at DESC);

-- Auto-expire pending approvals older than 5 minutes (for scheduled job)
CREATE OR REPLACE FUNCTION expire_pending_approvals()
RETURNS void AS $$
    UPDATE human_approvals
    SET status = 'timeout', resolved_at = NOW()
    WHERE status = 'pending' AND expires_at < NOW();
$$ LANGUAGE SQL;

COMMENT ON TABLE human_approvals IS 'Audit log for all human authorization decisions';
COMMENT ON COLUMN human_approvals.risk_category IS '1=auto, 2=notify, 3=block, 4=block+MFA';
