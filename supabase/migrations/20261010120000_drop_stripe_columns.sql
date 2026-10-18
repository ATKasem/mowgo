-- Finish the Stripe → Rise Concepts switch: drop the Stripe-specific columns.
--
-- Run AFTER 20261009120000_payment_provider_neutral.sql, which copied their
-- values into billing_customer_id / provider_payment_id. No app code reads
-- these columns any more (web/Android select '*' or neutral columns; iOS
-- decodes optional neutral fields).
--
-- Idempotent: safe to re-run.

-- Guard: refuse to drop data that wasn't copied (e.g. the previous migration
-- was skipped).
DO $$
DECLARE
  uncopied boolean;
BEGIN
  -- Dynamic SQL: the column may already be gone on a re-run, and a static
  -- reference would fail to compile even inside a false IF.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.profiles
               WHERE stripe_customer_id IS NOT NULL AND billing_customer_id IS NULL)' INTO uncopied;
    IF uncopied THEN
      RAISE EXCEPTION 'profiles.stripe_customer_id has values not copied to billing_customer_id — run 20261009120000_payment_provider_neutral.sql first';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'stripe_payment_intent_id') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.invoices
               WHERE stripe_payment_intent_id IS NOT NULL AND provider_payment_id IS NULL)' INTO uncopied;
    IF uncopied THEN
      RAISE EXCEPTION 'invoices.stripe_payment_intent_id has values not copied to provider_payment_id — run 20261009120000_payment_provider_neutral.sql first';
    END IF;
  END IF;
END $$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS stripe_invoice_id;

-- The webhook handler always sets provider explicitly; no Stripe default.
ALTER TABLE public.webhook_events ALTER COLUMN provider DROP DEFAULT;
