-- AAP Certificates Schema
-- Migration 005: cryptographic agent certificates

CREATE TABLE certificates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_did          VARCHAR(512) UNIQUE NOT NULL,
  aap_address        VARCHAR(255) NOT NULL,
  public_key_hex     TEXT NOT NULL,
  verification_level VARCHAR(50)  NOT NULL DEFAULT 'unverified',
  issued_at          TIMESTAMPTZ  DEFAULT NOW(),
  expires_at         TIMESTAMPTZ  DEFAULT NOW() + INTERVAL '1 year',
  issuer_did         VARCHAR(512) NOT NULL,
  certificate_hash   VARCHAR(128) NOT NULL,
  signature          TEXT NOT NULL,
  revoked            BOOLEAN      DEFAULT false,
  revoked_at         TIMESTAMPTZ,
  revoke_reason      TEXT
);

CREATE INDEX idx_cert_agent_did ON certificates(agent_did);
CREATE INDEX idx_cert_revoked   ON certificates(revoked, expires_at);
CREATE INDEX idx_cert_level     ON certificates(verification_level);
