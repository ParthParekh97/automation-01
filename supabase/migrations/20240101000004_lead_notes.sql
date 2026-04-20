-- ============================================================
-- Lead Notes & Status Change Log
-- ============================================================
-- type='note'          : manual note added by the CRM user
-- type='status_change' : logged automatically when lead status changes

CREATE TABLE lead_notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id    UUID NOT NULL REFERENCES leads(id)   ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('note', 'status_change')),
  content    TEXT NOT NULL,
  -- For status_change: {"from": "new", "to": "contacted"}
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_notes_lead_id ON lead_notes(lead_id);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access - lead_notes"
  ON lead_notes USING (auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Client access own notes"
  ON lead_notes USING (client_id = auth.uid());
