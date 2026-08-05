-- Route Optimization v1: client coordinates + nav-app preference.
-- Naming: timestamp convention (014 is taken by concierge_requests; newest
-- repo migration is 20260731193000_add_client_tags.sql).

ALTER TABLE clients ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_nav_app TEXT DEFAULT NULL;
-- profiles got REVOKE UPDATE in 002:79, so new profile columns need the
-- 013-style column grant. clients needs NO grant (plain RLS, no revoke).
GRANT UPDATE (preferred_nav_app) ON profiles TO authenticated;
