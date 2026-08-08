-- RPC backing supabase/functions/get-conversion-kpi/index.ts (admin-only KPI
-- edge function, called with the service role key).
--
-- Why an RPC instead of PostgREST .select()/.length in the edge function:
--   1. profiles.trial_started_at is NOT a reliable trial cohort — the Stripe
--      webhook (functions/api/stripe/webhook.js updateProfile) nulls
--      trial_tier/trial_started_at/trial_ends_at on ANY paid subscription
--      event (trial is "consumed"), so converted users disappear from that
--      column. tier_events(source='trial_grant') is the immutable audit
--      trail written once per user by grant_trial() (see
--      20260807160000_trial_columns.sql) and is the real cohort.
--   2. "Converted" must catch a trial user who was ALREADY on the trial's
--      tier and bought the same tier — the webhook only logs a tier_events
--      row when before.tier <> tier (see stripe/webhook.js logTierChange
--      call site), so a same-tier purchase produces no webhook event. We
--      also have to fall back to profiles.tier/stripe_customer_id for that
--      case.
--   3. Doing this with PostgREST .select() + JS filtering would require
--      fetching every trial_grant/webhook row, which silently truncates at
--      PostgREST's ~1000-row default cap once the platform grows. Aggregate
--      it in SQL instead.
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
             -- profiles.tier alone is NOT proof of conversion: grant_trial()
             -- (20260807160000_trial_columns.sql) sets tier to the paid plan
             -- the instant a trial starts, so every active trial would count
             -- as "converted" without the trial-cleared check below.
             -- trial_started_at/trial_tier are only nulled by the Stripe
             -- webhook's updateProfile() (stripe/webhook.js:348-350) on a
             -- REAL subscription event — that's the actual conversion
             -- signal. stripe_customer_id is set as soon as checkout starts
             -- (stripe/checkout-subscription.js:106), before payment
             -- completes, so it's not sufficient alone either; require it
             -- alongside the cleared-trial check.
             SELECT 1 FROM public.profiles p
             WHERE p.id = tg.user_id
               AND p.tier IN ('solo','crew','premium')
               AND p.trial_started_at IS NULL
               AND p.trial_tier IS NULL
               AND p.stripe_customer_id IS NOT NULL
           )
         )
    ) AS trials_converted;
$$;

-- Aggregate-only, no row-level data returned — but the query touches
-- tier_events (service-role-only table, no RLS policies) and business
-- financials, so lock it to service_role like the other admin/webhook RPCs
-- (see 20260807183000_revoke_trial_rpc_anon.sql for the same pattern).
REVOKE ALL ON FUNCTION public.get_conversion_kpi() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_conversion_kpi() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversion_kpi() TO service_role;
