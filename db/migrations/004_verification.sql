-- AAP Verification Tables
-- Migration 004: phone OTP and business verification

CREATE TABLE pending_verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_did    VARCHAR(512) NOT NULL,
  phone_number VARCHAR(20)  NOT NULL,
  otp_code     VARCHAR(6)   NOT NULL,
  otp_token    UUID         NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ  NOT NULL,
  used         BOOLEAN      DEFAULT false,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE business_verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_did    VARCHAR(512) NOT NULL,
  gleif_id     VARCHAR(20)  NOT NULL,
  legal_name   VARCHAR(512) NOT NULL,
  country      CHAR(2),
  status       VARCHAR(30)  DEFAULT 'pending_review',
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_pv_phone    ON pending_verifications(phone_number, created_at);
CREATE INDEX idx_pv_token    ON pending_verifications(otp_token);
CREATE INDEX idx_pv_agent    ON pending_verifications(agent_did);
CREATE INDEX idx_bv_agent    ON business_verifications(agent_did);
CREATE INDEX idx_bv_gleif    ON business_verifications(gleif_id);
