DROP POLICY IF EXISTS "Estimates: owner only" ON estimates;
CREATE POLICY "Estimates: owner only" ON estimates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
