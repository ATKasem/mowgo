-- Speed-to-lead idempotency table + route_audits phone/SMS-consent columns.
-- Written/read exclusively by functions/api/route-audit.js,
-- functions/api/lead-touch.js, and scripts/lead_nurture.py via the Supabase
-- REST service role. See docs/speed-to-lead-spec-2026-08-06.md.
--
-- Dedup key is UNIQUE(lead_email, kind) — NOT per-source — so a lead who
-- hits both the route-audit funnel and the signup funnel gets at most 3
-- touches ever (instant/day2/day7), not 3 per source. Email is always
-- lowercased by the callers before insert (Postgres unique is
-- case-sensitive).
CREATE TABLE IF NOT EXISTS lead_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('route_audit', 'signup')),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  lead_email text NOT NULL,
  lead_phone text,
  kind text NOT NULL CHECK (kind IN ('instant', 'day2', 'day7')),
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_email, kind)
);

CREATE INDEX IF NOT EXISTS lead_touches_status_created_idx
  ON lead_touches (status, created_at);

ALTER TABLE lead_touches ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service role (bypasses RLS) may access
-- this table. Explicit revoke below is defense-in-depth, same posture as
-- 027_revoke_anon_execute.sql.
REVOKE ALL ON TABLE lead_touches FROM anon, authenticated;

ALTER TABLE route_audits ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE route_audits ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false;
