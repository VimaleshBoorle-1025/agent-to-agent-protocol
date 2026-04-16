-- AAP Registry Schema
-- Migration 001: Core registry tables

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Humans table (one per real person)
CREATE TABLE humans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash         VARCHAR(128) UNIQUE,
  root_did           VARCHAR(512) UNIQUE NOT NULL,
  verification_level VARCHAR(50) DEFAULT 'phone',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Entities table (companies, governments)
CREATE TABLE entities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name         VARCHAR(512) NOT NULL,
  gleif_id           VARCHAR(20) UNIQUE,
  country_code       CHAR(2),
  verification_level VARCHAR(50) DEFAULT 'unverified',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table
CREATE TABLE agents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aap_address        VARCHAR(255) UNIQUE NOT NULL,
  did                VARCHAR(512) UNIQUE NOT NULL,
  owner_id           UUID REFERENCES humans(id),
  entity_id          UUID REFERENCES entities(id),
  public_key_hex     TEXT NOT NULL,
  did_document       JSONB NOT NULL,
  endpoint_url       VARCHAR(1024),
  capabilities_hash  VARCHAR(128),
  verification_level VARCHAR(50) DEFAULT 'unverified',
  trust_score        INTEGER DEFAULT 50,
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Nonces table (replay attack prevention)
CREATE TABLE used_nonces (
  nonce    VARCHAR(128) PRIMARY KEY,
  used_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-delete nonces older than 60 seconds (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-nonces', '* * * * *',
--   'DELETE FROM used_nonces WHERE used_at < NOW() - INTERVAL ''60 seconds''');

CREATE INDEX idx_agents_aap_address ON agents(aap_address);
CREATE INDEX idx_agents_did ON agents(did);
CREATE INDEX idx_agents_owner_id ON agents(owner_id);
CREATE INDEX idx_agents_trust_score ON agents(trust_score);
CREATE INDEX idx_nonces_used_at ON used_nonces(used_at);
