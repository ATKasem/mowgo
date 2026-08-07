-- Close the trial-expiry enforcement window (trial-first no-card flow, 2026-08-07).
-- Root cause: enforce_free_client_limit() gates on profiles.tier only. Between
-- trial_ends_at passing and expire_trial()/cron actually reverting tier (app
-- left open, or API-only use), tier is still 'premium' — so an expired-trial
-- user could keep adding unlimited clients (and, via concierge-submit.js, claim
-- real human setup work) for free.
-- Fix: the trigger now reads trial_ends_at and treats an expired trial as free
-- tier at the moment of enforcement — no dependence on expire_trial timing.
CREATE OR REPLACE FUNCTION public.enforce_free_client_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_trial_end TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  SELECT tier, trial_ends_at INTO v_tier, v_trial_end
    FROM profiles WHERE id = NEW.user_id;

  -- Mirror the client's FREE_TIERS check: null/empty/'free' are all free tier.
  -- An EXPIRED trial counts as free tier too, even if the tier column hasn't
  -- been reverted yet (expire_trial runs on app mount; cron is the backstop —
  -- enforcement must not wait for either).
  IF (v_tier IS NULL OR v_tier = '' OR v_tier = 'free')
     OR (v_trial_end IS NOT NULL AND v_trial_end < now()) THEN
    -- Serialize concurrent inserts per owner so the count check cannot race
    -- (two parallel inserts could otherwise both see 4 and both succeed).
    PERFORM pg_advisory_xact_lock(hashtext('free_client_cap:' || NEW.user_id::text));
    SELECT count(*) INTO v_count FROM clients WHERE user_id = NEW.user_id;
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Free plan is limited to 5 clients';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_free_client_limit() FROM PUBLIC;
