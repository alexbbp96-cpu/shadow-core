-- SHADOW CORE 1.0 LEDGER migration
-- Based on proposed schema + review table + basic RLS

CREATE TABLE IF NOT EXISTS shadow_transactions (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  counterparty TEXT,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'needs_review', 'reviewed', 'rejected')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS shadow_transactions_occurred_at_idx ON shadow_transactions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS shadow_transactions_status_idx ON shadow_transactions (status, received_at DESC);

CREATE TABLE IF NOT EXISTS shadow_audit_events (
  id UUID PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES shadow_transactions(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('TRANSACTION_RECEIVED', 'RISK_FLAGGED', 'STATUS_CHANGED')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shadow_audit_events_transaction_idx ON shadow_audit_events (transaction_id, occurred_at ASC);

CREATE TABLE IF NOT EXISTS shadow_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES shadow_transactions(id),
  reviewer_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'needs_more_info')),
  notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE shadow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_reviews ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust with real Supabase Auth roles)
CREATE POLICY "service_role_all" ON shadow_transactions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON shadow_audit_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON shadow_reviews FOR ALL TO service_role USING (true);
