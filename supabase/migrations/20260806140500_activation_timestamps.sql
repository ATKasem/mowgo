-- Activation analytics (Hormozi audit #9): first-touch timestamps per
-- business, set once on first insert and never overwritten. Also adds
-- cancelled_at, written by the cancellation win-back flow
-- (functions/api/stripe/webhook.js handleSubscriptionDeleted) and read by
-- the activation-emails cron (mowgo_activation_emails.py win-back #2).
--
-- clients.user_id / jobs.user_id / invoices.user_id are always the BUSINESS
-- OWNER's id (see 20260806140000_free_client_cap.sql for the RLS reasoning),
-- so no business_id join is needed here either.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_client_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_job_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_invoice_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_first_client_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET first_client_at = now()
    WHERE id = NEW.user_id AND first_client_at IS NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_first_job_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET first_job_at = now()
    WHERE id = NEW.user_id AND first_job_at IS NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_first_invoice_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET first_invoice_at = now()
    WHERE id = NEW.user_id AND first_invoice_at IS NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION set_first_client_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION set_first_job_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION set_first_invoice_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS set_first_client_at_trigger ON clients;
CREATE TRIGGER set_first_client_at_trigger
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION set_first_client_at();

DROP TRIGGER IF EXISTS set_first_job_at_trigger ON jobs;
CREATE TRIGGER set_first_job_at_trigger
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_first_job_at();

DROP TRIGGER IF EXISTS set_first_invoice_at_trigger ON invoices;
CREATE TRIGGER set_first_invoice_at_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_first_invoice_at();
