-- ============================================================
-- Email Sequence Engine
-- ============================================================

-- Extend clients with per-client personalization fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS booking_link TEXT;

-- ── email_sequences ──────────────────────────────────────────
-- One row per lead per sequence run.
-- current_step tracks which email was last sent (0 = none yet).
-- next_send_at is the wall-clock time the cron should send the next email.
-- thread_id keeps all sequence emails in the same Gmail thread.

CREATE TABLE email_sequences (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id          UUID NOT NULL REFERENCES leads(id)   ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  status           TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

  current_step     INTEGER NOT NULL DEFAULT 0, -- 0=pending, 1=email1 sent, 2=email2 sent, 3=email3 sent
  next_send_at     TIMESTAMPTZ,                -- NULL once sequence is done
  replied          BOOLEAN NOT NULL DEFAULT false,

  -- Gmail tracking (so follow-ups land in the same thread)
  thread_id        TEXT,
  last_email_id    TEXT,

  -- Metadata
  cancelled_reason TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_sequences_lead      ON email_sequences(lead_id);
CREATE INDEX idx_email_sequences_client    ON email_sequences(client_id);
-- Fast cron query: active sequences whose next_send_at is due
CREATE INDEX idx_email_sequences_due       ON email_sequences(status, next_send_at)
  WHERE status = 'active' AND replied = false;

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access - email_sequences"
  ON email_sequences USING (auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Client access own sequences"
  ON email_sequences USING (client_id = auth.uid());
