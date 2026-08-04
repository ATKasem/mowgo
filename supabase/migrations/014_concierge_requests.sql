CREATE TABLE IF NOT EXISTS concierge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  business_name text NOT NULL,
  client_count int,
  csv_content text,
  csv_attachment_url text,
  imported_client_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',   -- pending | importing | done | skipped
  claimed_at timestamptz,
  done_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE concierge_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Concierge: owner select own" ON concierge_requests;
CREATE POLICY "Concierge: owner select own" ON concierge_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS concierge_requests_one_active_per_user
  ON concierge_requests (user_id) WHERE status IN ('pending','importing');
