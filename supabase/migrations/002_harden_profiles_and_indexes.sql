-- Hardening pass: billing columns and query indexes.
--
-- The RLS policy "Users can update own profile" restricts WHICH ROW a user may
-- update, but RLS cannot restrict WHICH COLUMNS. That left `tier` and
-- `stripe_customer_id` — billing state — writable from the browser with the
-- anon key, so any signed-in user could grant themselves a paid plan.
--
-- Column-level privileges are the right tool: revoke blanket UPDATE, then grant
-- back only the fields a user legitimately edits. Billing columns remain
-- writable by the service role (server + webhooks), which bypasses these grants.

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (business_name, phone) ON profiles TO authenticated;

-- `anon` should never write a profile at all.
REVOKE INSERT, UPDATE, DELETE ON profiles FROM anon;

-- Indexes for the access paths every screen uses. Without these, each query is
-- a sequential scan that degrades as job history accumulates.
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_scheduled_date ON jobs (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices (user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices (client_id);
