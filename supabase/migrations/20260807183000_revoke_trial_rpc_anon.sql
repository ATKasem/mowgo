-- SECURITY: revoke the trial RPCs from anon/authenticated where they don't
-- belong (verified 2026-08-07: anon could call expire_all_trials and
-- force-expire EVERY active trial on the platform — anonymous DoS on the
-- conversion funnel. Supabase grants EXECUTE to anon/authenticated on public
-- schema functions by default; REVOKE FROM PUBLIC does not remove those
-- explicit role grants).
REVOKE EXECUTE ON FUNCTION public.expire_all_trials() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_all_trials() FROM PUBLIC;

-- grant_trial/expire_trial are owner-scoped via auth.uid() and return false
-- for anon, but hygiene: anon should not even reach them.
REVOKE EXECUTE ON FUNCTION public.grant_trial(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_trial() FROM anon;

-- Final state: expire_all_trials = service_role only;
-- grant_trial/expire_trial = authenticated only.
GRANT EXECUTE ON FUNCTION public.grant_trial(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_trial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_all_trials() TO service_role;
