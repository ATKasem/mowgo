ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lead_alerts_enabled boolean NOT NULL DEFAULT true;
GRANT UPDATE (lead_alerts_enabled) ON profiles TO authenticated;  -- 002 revoked UPDATE on profiles; new columns need their own grant

-- Realtime broadcast for the web lead toast — guarded so re-running this file
-- (CLI history is out of sync with prod) never fails on "already a member".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  END IF;
END $$;
