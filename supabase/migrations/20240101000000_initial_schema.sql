-- ============================================================
-- AI CRM SaaS - Initial Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  active       BOOLEAN NOT NULL DEFAULT true,
  plan         TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'scale')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE leads (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  source       TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'web', 'facebook', 'instagram', 'google', 'referral', 'other')),
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'booked', 'closed_won', 'closed_lost')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_client_id ON leads(client_id);
CREATE INDEX idx_leads_status ON leads(status);

-- ============================================================
-- CALLS
-- ============================================================
CREATE TABLE calls (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  outcome         TEXT DEFAULT 'no_answer' CHECK (outcome IN ('no_answer', 'voicemail', 'callback', 'interested', 'not_interested', 'booked', 'other')),
  duration        INTEGER DEFAULT 0, -- seconds
  transcript      TEXT,
  recording_url   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calls_lead_id ON calls(lead_id);
CREATE INDEX idx_calls_client_id ON calls(client_id);

-- ============================================================
-- EMAILS
-- ============================================================
CREATE TABLE emails (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  sent_at      TIMESTAMPTZ
);

CREATE INDEX idx_emails_lead_id ON emails(lead_id);
CREATE INDEX idx_emails_client_id ON emails(client_id);
CREATE INDEX idx_emails_status ON emails(status);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE conversations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'facebook', 'instagram', 'webchat', 'email')),
  messages     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversations_client_id ON conversations(client_id);
CREATE INDEX idx_conversations_channel ON conversations(channel);
-- GIN index for JSONB message search
CREATE INDEX idx_conversations_messages ON conversations USING GIN (messages);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE bookings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id        UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  booking_date   TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')),
  cal_event_id   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_lead_id ON bookings(lead_id);
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      ENABLE ROW LEVEL SECURITY;

-- Super admin bypass (set via app role claim)
CREATE POLICY "Super admin full access - clients"       ON clients       USING (auth.jwt() ->> 'role' = 'super_admin');
CREATE POLICY "Super admin full access - leads"         ON leads         USING (auth.jwt() ->> 'role' = 'super_admin');
CREATE POLICY "Super admin full access - calls"         ON calls         USING (auth.jwt() ->> 'role' = 'super_admin');
CREATE POLICY "Super admin full access - emails"        ON emails        USING (auth.jwt() ->> 'role' = 'super_admin');
CREATE POLICY "Super admin full access - conversations" ON conversations  USING (auth.jwt() ->> 'role' = 'super_admin');
CREATE POLICY "Super admin full access - bookings"      ON bookings      USING (auth.jwt() ->> 'role' = 'super_admin');

-- Clients can only access their own data (matched by auth.uid() = clients.id)
CREATE POLICY "Client access own leads" ON leads
  USING (client_id = auth.uid());

CREATE POLICY "Client access own calls" ON calls
  USING (client_id = auth.uid());

CREATE POLICY "Client access own emails" ON emails
  USING (client_id = auth.uid());

CREATE POLICY "Client access own conversations" ON conversations
  USING (client_id = auth.uid());

CREATE POLICY "Client access own bookings" ON bookings
  USING (client_id = auth.uid());

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Lead summary with latest activity
CREATE VIEW lead_summary AS
SELECT
  l.id,
  l.client_id,
  l.name,
  l.phone,
  l.email,
  l.source,
  l.status,
  l.created_at,
  COUNT(DISTINCT ca.id)  AS call_count,
  COUNT(DISTINCT e.id)   AS email_count,
  COUNT(DISTINCT co.id)  AS conversation_count,
  COUNT(DISTINCT b.id)   AS booking_count,
  MAX(ca.created_at)     AS last_call_at,
  MAX(e.sent_at)         AS last_email_at
FROM leads l
LEFT JOIN calls         ca ON ca.lead_id = l.id
LEFT JOIN emails        e  ON e.lead_id  = l.id
LEFT JOIN conversations co ON co.lead_id = l.id
LEFT JOIN bookings      b  ON b.lead_id  = l.id
GROUP BY l.id;

-- ============================================================
-- UPDATED_AT TRIGGER (for future audit columns)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
