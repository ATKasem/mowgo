-- Tier-change event log: powers churn-by-tier tracking (decision: blended churn
-- hides which tier is churning — log every tier change with a timestamp).
-- Written ONLY by the Stripe webhook (service role). No client access.
CREATE TABLE IF NOT EXISTS tier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tier text NOT NULL CHECK (tier IN ('free','solo','crew','premium')),
  source text NOT NULL DEFAULT 'webhook',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tier_events_user_idx ON tier_events (user_id, created_at DESC);
ALTER TABLE tier_events ENABLE ROW LEVEL SECURITY;
-- No policies: service-role-only table (locked down by default)

-- Convenience view: current tier per user.
-- security_invoker: view respects the table's RLS (no policies = nothing leaks to clients).
CREATE OR REPLACE VIEW tier_current
WITH (security_invoker = true) AS
SELECT DISTINCT ON (user_id) user_id, tier, created_at AS since
FROM tier_events
ORDER BY user_id, created_at DESC;
