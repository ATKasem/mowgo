-- 007_push_notifications.sql — Push notification support
-- Adds device_token column to profiles for APNs push delivery.

-- ====================================================================
-- 1. profiles: add device_token
-- ====================================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS device_token TEXT;

COMMENT ON COLUMN profiles.device_token IS 'APNs device token for push notifications. Stored as hex string.';

-- ====================================================================
-- 2. RLS: allow authenticated users to update their own device_token
-- ====================================================================
-- The existing "Profiles: update own" policy already covers auth.uid() = id,
-- so users can PATCH device_token on their own profile row.
-- No new policy needed — just ensure the column is accessible via REST.
GRANT UPDATE (device_token) ON profiles TO authenticated;

-- ====================================================================
-- 3. Function: auto-clear device_token on sign-out (optional safety)
-- ====================================================================
-- We do NOT auto-clear on auth delete because the profile row persists
-- until the user explicitly deletes their account. The token is replaced
-- on each login via the app's registration flow.
