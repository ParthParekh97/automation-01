-- Add vapi_call_id to calls so outbound call records can be matched
-- to incoming end-of-call webhooks from Vapi.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS vapi_call_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id ON calls(vapi_call_id);
