-- Route Optimization v1 follow-up: constrain preferred_nav_app to known values
-- (Claude Code review fix). Postgres has no ADD CONSTRAINT IF NOT EXISTS, so
-- the DO block guards re-runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'preferred_nav_app_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT preferred_nav_app_check
      CHECK (preferred_nav_app IN ('google', 'apple', 'waze'));
  END IF;
END $$;
