-- Activation nudge idempotency table (Hormozi/Barry activation lane).
-- Written/read exclusively by scripts/mowgo_activation_emails.py via the
-- Supabase REST service role. T1 (24h, no first_job_at), T2 (72h, no
-- first_invoice_at), winback2 (7d after cancelled_at) — see
-- docs/activation-instrumentation-spec-2026-08-06.md.
CREATE TABLE IF NOT EXISTS activation_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('t1', 't2', 'winback2')),
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

CREATE INDEX IF NOT EXISTS activation_touches_status_created_idx
  ON activation_touches (status, created_at);

ALTER TABLE activation_touches ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service role (bypasses RLS) may access
-- this table. Explicit revoke below is defense-in-depth, same posture as
-- 027_revoke_anon_execute.sql.
REVOKE ALL ON TABLE activation_touches FROM anon, authenticated;
