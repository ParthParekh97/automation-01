-- ============================================================
-- Gmail Integration
-- ============================================================

-- Per-client OAuth token storage (provider-agnostic, Gmail first)
CREATE TABLE client_integrations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id            UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'facebook', 'instagram')),
  access_token_enc     TEXT NOT NULL,          -- AES-256-GCM encrypted
  refresh_token_enc    TEXT,                   -- AES-256-GCM encrypted
  token_expiry         TIMESTAMPTZ,
  scope                TEXT,
  connected_email      TEXT,                   -- e.g. "alice@gmail.com" (display only)
  gmail_history_id     TEXT,                   -- incremental poll cursor
  gmail_watch_expiry   TIMESTAMPTZ,            -- Google Pub/Sub watch expiry
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, provider)
);

CREATE INDEX idx_client_integrations_client   ON client_integrations(client_id);
CREATE INDEX idx_client_integrations_provider ON client_integrations(provider);

-- Auto-bump updated_at (reuses the trigger function from migration 000000)
CREATE TRIGGER set_updated_at_client_integrations
  BEFORE UPDATE ON client_integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Extend emails table for Gmail tracking
-- ============================================================

ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS direction       TEXT NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'inbound')),
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS thread_id        TEXT,
  ADD COLUMN IF NOT EXISTS from_email       TEXT;

CREATE INDEX IF NOT EXISTS idx_emails_gmail_message_id ON emails(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id        ON emails(thread_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access - client_integrations"
  ON client_integrations
  USING (auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Client access own integrations"
  ON client_integrations
  USING (client_id = auth.uid());
