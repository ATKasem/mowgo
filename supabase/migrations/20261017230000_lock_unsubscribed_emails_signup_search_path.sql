-- 1) unsubscribed_emails was created without RLS (20260822150000). With the
--    data-API grants every public table receives, anyone holding the public
--    anon key could read the unsubscribed address list via /rest/v1 and
--    insert or delete rows (re-subscribing people). Its only writers/readers
--    are functions/api/unsubscribe.js and server-side send scripts, all using
--    service_role, which bypasses RLS. So: RLS on, no policies, and the client
--    roles lose table privileges (defense in depth, same posture as
--    lead_touches / activation_touches).
alter table public.unsubscribed_emails enable row level security;
revoke all on table public.unsubscribed_emails from anon, authenticated;

-- 2) handle_new_user() (001) inserts into unqualified "profiles" and has no
--    search_path. Supabase Auth fires the signup trigger as
--    supabase_auth_admin, whose search_path doesn't include public, so on a
--    fresh database every signup fails ('relation "profiles" does not exist').
--    Pin search_path without replacing the body — production's body may have
--    been changed out-of-band and must not be overwritten.
alter function public.handle_new_user() set search_path = public;
