-- Estimates (Batch 11)
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'draft',
  note TEXT,
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estimates: owner only" ON estimates
  FOR ALL USING (auth.uid() = user_id);
