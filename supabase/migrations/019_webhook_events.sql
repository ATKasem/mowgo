CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the service role (bypasses RLS) may write; clients with the anon key
-- cannot pre-insert event IDs to block Stripe webhook processing.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_events: service role only" ON webhook_events
  FOR ALL USING (false) WITH CHECK (false);
