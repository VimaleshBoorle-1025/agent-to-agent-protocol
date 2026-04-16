-- AAP Mailbox Schema
-- Migration 002: Async message queue

CREATE TABLE mailbox_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_did         VARCHAR(512) NOT NULL,
  from_did       VARCHAR(512) NOT NULL,
  message_id     VARCHAR(128) UNIQUE NOT NULL,
  outer_envelope BYTEA NOT NULL,
  status         VARCHAR(20) DEFAULT 'pending',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  delivered_at   TIMESTAMPTZ
);

CREATE INDEX idx_mailbox_to_did    ON mailbox_messages(to_did, status);
CREATE INDEX idx_mailbox_from_did  ON mailbox_messages(from_did);
CREATE INDEX idx_mailbox_expires   ON mailbox_messages(expires_at);
CREATE INDEX idx_mailbox_message_id ON mailbox_messages(message_id);
