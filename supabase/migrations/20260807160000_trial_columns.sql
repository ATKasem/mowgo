ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_tier TEXT,           -- 'solo'|'crew'|'premium' — plan granted during trial
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Grant the trial. SECURITY DEFINER, owner-scoped, idempotent.
-- Rules:
--   * ONE trial per user, ever: if trial_ends_at has EVER been set (active OR
--     expired), never grant again — no trial-shopping loophole.
--   * Never touches users with a REAL paid tier from Stripe (tier <> 'free').
--   * Sets tier = p_plan, trial_tier = p_plan, trial_started_at = now(),
--     trial_ends_at = now() + 14 days.
--   * Caller must be the profile owner (auth.uid() = id).
CREATE OR REPLACE FUNCTION public.grant_trial(p_plan text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier text;
  v_trial_end timestamptz;
BEGIN
  SELECT tier, trial_ends_at INTO v_tier, v_trial_end
    FROM public.profiles WHERE id = auth.uid();
  IF v_tier IS NULL THEN RETURN false; END IF;
  IF v_tier <> 'free' THEN RETURN false; END IF;              -- already paid (webhook) — never downgrade/override
  IF v_trial_end IS NOT NULL THEN RETURN false; END IF;       -- trial ever used (active or expired) — one shot only
  IF p_plan NOT IN ('solo','crew','premium') THEN RETURN false; END IF;
  UPDATE public.profiles
     SET tier = p_plan,
         trial_tier = p_plan,
         trial_started_at = now(),
         trial_ends_at = now() + interval '14 days'
   WHERE id = auth.uid();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.grant_trial(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_trial(text) TO authenticated;

-- Expire own trial if past end (call on app mount; idempotent, cheap).
-- KEEPS the trial row (trial_tier/trial_ends_at) so TrialBanner can show the
-- "trial ended" state and grant_trial can never re-grant. Only tier flips
-- back to 'free'.
CREATE OR REPLACE FUNCTION public.expire_trial()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trial_end timestamptz;
  v_trial_tier text;
BEGIN
  SELECT trial_ends_at, trial_tier INTO v_trial_end, v_trial_tier
    FROM public.profiles WHERE id = auth.uid();
  IF v_trial_end IS NOT NULL AND v_trial_end < now() AND v_trial_tier IS NOT NULL THEN
    UPDATE public.profiles
       SET tier = 'free'
     WHERE id = auth.uid() AND tier = v_trial_tier;   -- only revert if tier still equals the trial grant
    RETURN true;
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.expire_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_trial() TO authenticated;

-- Service-role backstop for ALL users (daily cron): expire every past trial.
-- Same rule — revert tier only, keep the trial row.
CREATE OR REPLACE FUNCTION public.expire_all_trials()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.profiles
     SET tier = 'free'
   WHERE trial_ends_at IS NOT NULL AND trial_ends_at < now() AND tier = trial_tier;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.expire_all_trials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_all_trials() TO service_role;
