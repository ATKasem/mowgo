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
CREATE INDEX idx_recurring_jobs_user_active
  ON recurring_jobs (user_id, is_active)
  WHERE is_active = true;

-- RLS
ALTER TABLE recurring_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own recurring jobs"
  ON recurring_jobs FOR ALL
  USING (auth.uid() = user_id);
