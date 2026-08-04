ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
GRANT UPDATE (latitude, longitude) ON profiles TO authenticated;
