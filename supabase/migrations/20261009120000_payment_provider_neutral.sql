-- Provider-neutral payments (Stripe removed; Rise Concepts planned).
--
-- Code now reads/writes only the neutral columns below, through the payments
-- layer in functions/api/_shared/payments/. See docs/PAYMENTS.md.
--
-- The old stripe_* columns are left in place (not dropped) so any app build
-- already installed that still SELECTs them keeps working. Drop them in a
-- later migration once no supported client reads them.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- profiles: billing identity for the business's MowGo subscription
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_provider text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_subscription_id text;

-- 004_fix_ios_stripe_customer.sql let any signed-in user write their own
-- stripe_customer_id. A user who points it at someone else's customer id can
-- hijack or block that customer's subscription webhooks. Billing identity is
-- server-only from now on: no GRANT UPDATE on the billing_* columns either
-- (profiles had blanket UPDATE revoked in 002_crew_features.sql).
REVOKE UPDATE (stripe_customer_id) ON public.profiles FROM authenticated;

UPDATE public.profiles
   SET billing_provider = 'stripe',
       billing_customer_id = stripe_customer_id
 WHERE stripe_customer_id IS NOT NULL
   AND billing_customer_id IS NULL;

-- Webhooks resolve profiles by (provider, customer id).
CREATE INDEX IF NOT EXISTS profiles_billing_customer_idx
  ON public.profiles (billing_provider, billing_customer_id)
  WHERE billing_customer_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- invoices: the hosted payment link for an invoice
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS provider_payment_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_link_url text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_link_amount_cents integer;

UPDATE public.invoices
   SET payment_provider = 'stripe',
       provider_payment_id = stripe_payment_intent_id
 WHERE stripe_payment_intent_id IS NOT NULL
   AND provider_payment_id IS NULL;

-- ---------------------------------------------------------------------------
-- webhook_events: which provider an event id belongs to
-- (new ids are also namespaced '<provider>:<id>' by the webhook handler)
-- ---------------------------------------------------------------------------
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';

-- ---------------------------------------------------------------------------
-- merchant_accounts: each business's own merchant account with the provider.
-- Invoice card payments settle HERE (to the business), never to MowGo's
-- platform account. Written only by the server (onboarding + provider
-- webhooks); owners can read their own row to see setup status.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_accounts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_merchant_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'restricted', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_accounts: owner reads own" ON public.merchant_accounts;
CREATE POLICY "merchant_accounts: owner reads own" ON public.merchant_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.merchant_accounts FROM anon, authenticated;
GRANT SELECT ON TABLE public.merchant_accounts TO authenticated;

-- ---------------------------------------------------------------------------
-- Conversion KPI: "converted" previously required stripe_customer_id.
-- Use the neutral billing_customer_id (backfilled above for Stripe rows).
-- Same logic otherwise — see 20260808120000_conversion_kpi_rpc.sql.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_conversion_kpi()
RETURNS TABLE (
  total_signups bigint,
  trials_started bigint,
  trials_started_last_30_days bigint,
  trials_converted bigint
)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.profiles) AS total_signups,
    (SELECT count(DISTINCT user_id) FROM public.tier_events
       WHERE source = 'trial_grant') AS trials_started,
    (SELECT count(DISTINCT user_id) FROM public.tier_events
       WHERE source = 'trial_grant' AND created_at >= now() - interval '30 days'
    ) AS trials_started_last_30_days,
    (SELECT count(DISTINCT tg.user_id)
       FROM public.tier_events tg
       WHERE tg.source = 'trial_grant'
         AND (
           EXISTS (
             SELECT 1 FROM public.tier_events w
             WHERE w.user_id = tg.user_id
               AND w.source = 'webhook'
               AND w.tier IN ('solo','crew','premium')
           )
           OR EXISTS (
             -- Trial columns are cleared only by a real subscription event
             -- (billing-events.js updateBillingProfile); billing_customer_id
             -- can exist before payment completes, so require both.
             SELECT 1 FROM public.profiles p
             WHERE p.id = tg.user_id
               AND p.tier IN ('solo','crew','premium')
               AND p.trial_started_at IS NULL
               AND p.trial_tier IS NULL
               AND p.billing_customer_id IS NOT NULL
           )
         )
    ) AS trials_converted;
$$;

REVOKE ALL ON FUNCTION public.get_conversion_kpi() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_conversion_kpi() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversion_kpi() TO service_role;
