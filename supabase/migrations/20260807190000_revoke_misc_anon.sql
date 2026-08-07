-- SECURITY hygiene: revoke anon from functions whose migrations declared
-- service_role/owner-only grants but which Supabase's default grants leaked
-- EXECUTE to anon (verified 2026-08-07 — same root cause as the
-- expire_all_trials anonymous-DoS: REVOKE FROM PUBLIC does not remove
-- Supabase's explicit anon/authenticated grants).
-- None were cross-tenant exploitable (reorder_jobs is SECURITY INVOKER and
-- RLS-scoped to auth.uid(); the set_first_*/enforce_* are trigger functions
-- that error on NEW when called standalone) — this is defense-in-depth to
-- match the migrations' declared intent.
REVOKE EXECUTE ON FUNCTION public.reorder_jobs(UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reorder_jobs(UUID, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reorder_jobs(UUID, JSONB) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.set_first_client_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_first_job_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_first_invoice_at() FROM anon;

REVOKE EXECUTE ON FUNCTION public.enforce_free_client_limit() FROM anon;
