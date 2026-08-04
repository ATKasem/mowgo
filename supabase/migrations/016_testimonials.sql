-- Testimonials: in-app quote capture at the value moment (10th completed job).
-- Landing page renders only approved=true rows; admins approve in Supabase.
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  quote text NOT NULL CHECK (char_length(quote) BETWEEN 2 AND 600),
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',              -- e.g. "Solo operator, OKC"
  plan text NOT NULL DEFAULT '',              -- free | solo | crew | premium
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Authenticated users may insert their own testimonial, but never pre-approved:
-- a malicious client could otherwise set approved=true and publish fake quotes.
DROP POLICY IF EXISTS "Testimonials: insert own" ON testimonials;
CREATE POLICY "Testimonials: insert own" ON testimonials
  FOR INSERT WITH CHECK (auth.uid() = user_id AND approved = false);

-- Only approved testimonials are readable (landing page / public).
DROP POLICY IF EXISTS "Testimonials: read approved" ON testimonials;
CREATE POLICY "Testimonials: read approved" ON testimonials
  FOR SELECT USING (approved = true);

-- Owner can update/delete their own pending testimonial.
DROP POLICY IF EXISTS "Testimonials: owner update own" ON testimonials;
CREATE POLICY "Testimonials: owner update own" ON testimonials
  FOR UPDATE USING (auth.uid() = user_id AND approved = false)
  WITH CHECK (auth.uid() = user_id AND approved = false);

DROP POLICY IF EXISTS "Testimonials: owner delete own" ON testimonials;
CREATE POLICY "Testimonials: owner delete own" ON testimonials
  FOR DELETE USING (auth.uid() = user_id AND approved = false);

CREATE INDEX IF NOT EXISTS testimonials_approved_idx ON testimonials (approved, created_at DESC);
