-- Close the trial-farming gap (Mimo security review LOW-1/LOW-2, 2026-08-07):
-- a user could create multiple accounts with gmail +alias emails (or re-register
-- the same email after an admin deletion) and get a fresh 14-day trial each time,
-- because the one-shot guard is keyed on auth.uid() (per-account), not email.
-- Fix: a persistent used_trials table keyed on NORMALIZED email (lowercased,
-- gmail +alias stripped). grant_trial consults it and writes it. Because it's a
-- separate table, it survives account deletion — one trial per human, ever.

CREATE TABLE IF NOT EXISTS public.used_trials (
  email text PRIMARY KEY,          -- normalized: lowercase, +alias stripped
  plan text NOT NULL,              -- 'solo' | 'crew' | 'premium'
  first_granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.used_trials ENABLE ROW LEVEL SECURITY;
-- No policies: written by grant_trial (SECURITY DEFINER), read by nobody via
-- client. Service-role only.
REVOKE ALL ON TABLE public.used_trials FROM PUBLIC;
REVOKE ALL ON TABLE public.used_trials FROM anon, authenticated;
GRANT ALL ON TABLE public.used_trials TO service_role;

-- Normalize an email for the one-trial-per-human rule:
--   * lowercase
--   * gmail/googlemail: strip +alias (user+tag@gmail.com -> user@gmail.com),
--     strip dots in the local part (user.name@gmail.com -> username@gmail.com —
--     Gmail treats dots as the same inbox), and fold googlemail -> gmail.
--   * non-gmail: lowercase only (aliases are provider-specific).
CREATE OR REPLACE FUNCTION public.normalize_trial_email(p_email text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(p_email) ~ '@(gmail|googlemail)\.com$' THEN
      regexp_replace(split_part(split_part(lower(p_email), '+', 1), '@', 1), '\.', '', 'g') || '@gmail.com'
    ELSE lower(btrim(p_email))
  END;
$$;

REVOKE ALL ON FUNCTION public.normalize_trial_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_trial_email(text) TO authenticated;

-- Extend grant_trial: consult used_trials BEFORE granting, write it AFTER.
CREATE OR REPLACE FUNCTION public.grant_trial(p_plan text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier text;
  v_trial_end timestamptz;
  v_email text;
  v_norm_email text;
BEGIN
  SELECT tier, trial_ends_at INTO v_tier, v_trial_end
    FROM public.profiles WHERE id = auth.uid();
  IF v_tier IS NULL THEN RETURN false; END IF;              -- no profile row
  IF v_tier <> 'free' THEN RETURN false; END IF;            -- already paid (webhook)
  IF v_trial_end IS NOT NULL THEN RETURN false; END IF;     -- account-level one-shot

  -- Human-level one-shot: normalize the caller's email.
  -- SECURITY DEFINER: we may read auth.users as the function owner.
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN false; END IF;
  v_norm_email := public.normalize_trial_email(v_email);

  IF p_plan NOT IN ('solo','crew','premium') THEN RETURN false; END IF;

  -- Claim the human-level marker BEFORE granting anything. The PK on email
  -- makes this the atomic serialization point: two concurrent grant_trial
  -- calls for the same normalized email will have exactly one INSERT
  -- succeed (FOUND = true); the loser returns false without granting a
  -- trial. If anything below raises, the whole transaction — including this
  -- insert — rolls back, so the marker is never left behind unclaimed.
  INSERT INTO public.used_trials (email, plan) VALUES (v_norm_email, p_plan)
  ON CONFLICT (email) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.profiles
     SET tier = p_plan,
         trial_tier = p_plan,
         trial_started_at = now(),
         trial_ends_at = now() + interval '14 days'
   WHERE id = auth.uid();

  INSERT INTO public.tier_events (user_id, tier, source)
  VALUES (auth.uid(), p_plan, 'trial_grant')
  ON CONFLICT DO NOTHING;

  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.grant_trial(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_trial(text) TO authenticated;
