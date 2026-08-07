ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lead_alerts_enabled boolean NOT NULL DEFAULT true;
GRANT UPDATE (lead_alerts_enabled) ON profiles TO authenticated;  -- 002 revoked UPDATE on profiles; new columns need their own grant
ALTER PUBLICATION supabase_realtime ADD TABLE leads;              -- realtime broadcast for web toast
