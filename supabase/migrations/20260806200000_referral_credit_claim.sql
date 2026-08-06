-- Referral credit: real Stripe balance-transaction application (CRITICAL fix).
-- earn_referral_credit (20260806160000) only flips referrals.status to
-- 'earned' — no money ever moved, but the UI/email promise a real free
-- month. This migration adds the columns + atomic claim RPC the Stripe
-- webhook needs to apply a REAL Stripe customer-balance credit without
-- double-crediting on webhook retries / concurrent deliveries.

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS applied_at timestamptz;

-- claim_referral_credit(p_referred_user_id): atomically reserves the right
-- to apply a Stripe credit for this referral BEFORE the webhook calls
-- Stripe. Reserve-then-act, not act-then-reserve: the Stripe API call is an
-- external side effect that can't live in the same DB transaction, so the
-- only way to guarantee no double-credit under concurrent/duplicate webhook
-- delivery is to atomically claim the row first (WHERE credit_applied =
-- false is the compare-and-swap). A claim that's never followed by a
-- successful Stripe call (rare — only on a Stripe API error) is logged by
-- the caller for manual reconciliation and is NOT auto-retried, because
-- retrying would reopen the exact race this function exists to close.
CREATE OR REPLACE FUNCTION public.claim_referral_credit(p_referred_user_id UUID) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claimed UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'access denied'; END IF;

  UPDATE public.referrals
     SET credit_applied = true, applied_at = now()
   WHERE referred_user_id = p_referred_user_id
     AND status = 'earned'
     AND credit_applied = false
  RETURNING id INTO v_claimed;

  RETURN v_claimed IS NOT NULL;
END; $$;

-- service_role only — webhook is the sole caller (027 rule: explicit
-- anon/authenticated grants survive a PUBLIC revoke, clear them too).
REVOKE ALL ON FUNCTION public.claim_referral_credit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_referral_credit(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_credit(uuid) TO service_role;

-- Win-back email idempotency marker (HIGH-2 fix support): tracks whether a
-- cancellation win-back email has been sent for the CURRENT free-tier
-- period, so a concurrent/duplicate customer.subscription.deleted delivery
-- can't send it twice. Reset to NULL whenever the user becomes paid again
-- (webhook's updateProfile) so a FUTURE cancellation still gets its own
-- win-back email.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS winback_sent_at timestamptz;
