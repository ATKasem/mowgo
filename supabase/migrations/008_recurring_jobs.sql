-- Recurring job templates
-- Stores repeat patterns so the iOS app can auto-generate job instances on load.
CREATE TABLE IF NOT EXISTS recurring_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Lawn Care',
  scheduled_time TIME,
  duration_minutes INTEGER DEFAULT 60,
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  frequency TEXT DEFAULT 'weekly',           -- 'weekly', 'biweekly', 'monthly'
  days_of_week INTEGER[] DEFAULT '{}',       -- 1=Mon,2=Tue,...,6=Sat
  is_active BOOLEAN DEFAULT true,
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by user + active status (used by auto-generation)
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_user_active
  ON recurring_jobs (user_id, is_active)
  WHERE is_active = true;

-- RLS — recurring templates belong to the business owner. Crew members can
-- read their business's templates but cannot create or modify them.
ALTER TABLE recurring_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own recurring jobs" ON recurring_jobs;
DROP POLICY IF EXISTS "Recurring jobs: owner full access" ON recurring_jobs;
DROP POLICY IF EXISTS "Recurring jobs: crew read" ON recurring_jobs;

CREATE POLICY "Recurring jobs: owner full access" ON recurring_jobs
  FOR ALL
  USING (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  )
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  );

CREATE POLICY "Recurring jobs: crew read" ON recurring_jobs
  FOR SELECT USING (
    user_id = current_business_id()
    AND auth.uid() <> current_business_id()
  );
