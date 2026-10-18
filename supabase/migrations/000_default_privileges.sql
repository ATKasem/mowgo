-- Default data-API grants for every table/sequence the later migrations create.
--
-- Newer Supabase stacks no longer grant anon/authenticated/service_role on new
-- tables in public by default, and no migration here grants them explicitly.
-- A fresh environment (local, branch, staging, DR) built from these files
-- therefore returned 403 on every /rest/v1 table. Production was created
-- before that change and already has these defaults, so this is a no-op there.
--
-- Deliberately numbered 000_ (not a timestamp) so it runs FIRST: later
-- migrations revoke privileges on purpose (002 REVOKE UPDATE ON profiles,
-- referrals / lead_touches / activation_touches / rain_delay_entries /
-- weather_push_events REVOKE ALL). A timestamped migration would run last and
-- a blanket GRANT there would silently re-open all of those. RLS remains the
-- authorization boundary.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
