-- Referral program v1 — Hormozi §49/§25/§35 lane (ask at the moment of purchase)
-- See docs/referral-program-spec-2026-08-06.md

-- ── profiles columns ───────────────────────────────────────────────────────
-- ⚠️ REVOKE NOTE: per 002_crew_features.sql:79-80 convention, later migrations
--    GRANT UPDATE on new profiles columns to authenticated. REFERRAL COLUMNS MUST
--    NOT follow that pattern — both must remain writable ONLY by SECURITY DEFINER RPC.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
DO $do$ BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS u_profiles_referral_code;
EXCEPTION WHEN undefined_object THEN NULL; END $do$;
ALTER TABLE profiles ADD CONSTRAINT u_profiles_referral_code UNIQUE (referral_code);

-- Code generation trigger — NEW pattern (no repo precedent for code-gen).
-- 6-char uppercase codes, unambiguous alphabet (exclude I,O,0,1).
-- AFTER INSERT (not BEFORE): assigns the code via a real UPDATE so a code
-- collision raises a genuine unique_violation that the per-attempt exception
-- block can catch and retry — a BEFORE INSERT trigger can only pre-check
-- (TOCTOU race: two concurrent signups could pass the check and the second
-- INSERT would fail the whole row with an unhandled constraint error).
CREATE OR REPLACE FUNCTION ensure_referral_code() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  letter_alpha TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 chars, no I/O/0/1
  code TEXT;
BEGIN
  IF COALESCE(NEW.referral_code, '') != '' THEN
    RETURN NEW; -- already set (client-supplied), skip
  END IF;

  FOR _attempt IN 1..10 LOOP
    code := '';
    FOR j IN 1..6 LOOP
      code := code || SUBSTR(letter_alpha, FLOOR(RANDOM() * LENGTH(letter_alpha) + 1)::INT, 1);
    END LOOP;
    code := UPPER(TRIM(code));

    BEGIN
      UPDATE profiles SET referral_code = code WHERE id = NEW.id AND referral_code IS NULL;
      IF FOUND THEN
        RETURN NEW;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE; -- collision — try a fresh code (aborts only this attempt)
    END;
  END LOOP;

  RAISE NOTICE 'ensure_referral_code: failed to generate code for user % after 10 attempts', NEW.id;
  RETURN NEW; -- code stays NULL (UNIQUE allows multiple NULLs); backfill can retry later
END; $$;

REVOKE ALL ON FUNCTION ensure_referral_code() FROM PUBLIC;

DROP TRIGGER IF EXISTS ref_code_generate_trigger ON profiles;
CREATE TRIGGER ref_code_generate_trigger AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION ensure_referral_code();

-- Backfill existing users with referral codes (safe multi-row)
DO $do$
DECLARE
  r RECORD;
  letter_alpha TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- same as trigger fn
  code TEXT; ok BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE referral_code IS NULL ORDER BY created_at LOOP
    ok := FALSE;
    FOR _att IN 1..10 LOOP
      code := '';
      FOR j IN 1..6 LOOP
        code := code || SUBSTR(letter_alpha, FLOOR(RANDOM() * LENGTH(letter_alpha) + 1)::INT, 1);
      END LOOP;
      code := UPPER(TRIM(code));

      BEGIN
        UPDATE profiles SET referral_code = code WHERE id = r.id AND referral_code IS NULL;
        ok := TRUE;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        CONTINUE; -- try again
      END;
    END LOOP;

    IF NOT ok THEN
      RAISE NOTICE 'backfill referral_code: skip (collision) user %', r.id;
    END IF;
  END LOOP;
END $do$;

-- Referrals tracking table (one credit per referred user, ever)
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_used text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'earned')),
  credit_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  earned_at timestamptz,
  UNIQUE (referred_user_id)   -- one credit per referred user, ever
);

CREATE INDEX IF NOT EXISTS referrals_status_created_idx ON referrals (status, created_at);

-- RLS: service-role only, zero policies (mirror lead_touches / activation_touches pattern)
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE referrals FROM anon, authenticated;

-- ── SECURITY DEFINER RPCs ──────────────────────────────────────────────────
-- All functions revoke from PUBLIC first (027 rule), then grant to specific roles.

-- profile_is_referred(p_uid): helper used inside apply_referral_code.
-- SECURITY DEFINER owner-call only — NOT granted to any client role: the
-- internal call from apply_referral_code runs as the function owner regardless
-- of client-facing grants, and a public grant would let any logged-in user
-- probe whether ANY uuid has ever been referred (no product justification).
CREATE OR REPLACE FUNCTION profile_is_referred(p_uid UUID) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*) > 0 FROM referrals WHERE referred_user_id = p_uid;
$$;

REVOKE ALL ON FUNCTION profile_is_referred(uuid) FROM PUBLIC;

-- apply_referral_code(p_code text): client calls to redeem a referral link.
-- Grants: authenticated (with auth.uid() guard).
CREATE OR REPLACE FUNCTION apply_referral_code(p_code TEXT) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p_norm TEXT;       -- UPPER(TRIM(input)) — what they typed
  my_code TEXT;      -- caller's own stored referral_code
  v_referrer_id UUID;
  v_referrer_name TEXT;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Normalize input (case-insensitive lookup)
  p_norm := UPPER(TRIM(p_code));

  -- Get caller's own referral code
  SELECT referral_code INTO my_code FROM profiles WHERE id = auth.uid();

  -- Self-referral check: typed code == caller's OWN code → reject
  IF my_code IS NOT NULL AND my_code = p_norm THEN
    RAISE EXCEPTION 'cannot refer yourself';
  END IF;

  -- Re-entrancy guard: has caller already been referred?
  IF profile_is_referred(auth.uid()) THEN
    RETURN 'already_referred';
  END IF;

  -- Find referrer by the typed code
  SELECT id, business_name INTO v_referrer_id, v_referrer_name
    FROM profiles WHERE referral_code = p_norm;

  IF v_referrer_id IS NULL OR v_referrer_name IS NULL THEN
    RETURN null; -- unknown/invalid code
  END IF;

  -- Mark as referred (update WHERE not yet set; atomic even under race)
  UPDATE profiles SET referred_by = v_referrer_id
    WHERE id = auth.uid() AND referred_by IS NULL;

  -- Insert referrals row; swallow unique violation from race conditions
  BEGIN
    INSERT INTO referrals (referrer_id, referred_user_id, code_used)
    VALUES (v_referrer_id, auth.uid(), p_norm);
  EXCEPTION WHEN unique_violation THEN
    -- Another tab raced ahead; still considered referred.
    RETURN 'already_referred';
  END;

  RETURN v_referrer_name::text;
END; $$;

REVOKE ALL ON FUNCTION apply_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_referral_code(text) TO authenticated;

-- referral_status(): client reads their own referral code + counts.
-- Grants: authenticated (with auth.uid() guard).
CREATE OR REPLACE FUNCTION referral_status() RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_total_count INT;
  v_earned_count INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT referral_code INTO v_code FROM profiles WHERE id = auth.uid();

  SELECT COUNT(*) INTO v_total_count FROM referrals WHERE referrer_id = auth.uid();
  SELECT COUNT(*) INTO v_earned_count FROM referrals WHERE referrer_id = auth.uid() AND status = 'earned';

  RETURN json_build_object(
    'code', v_code,
    'total_count', COALESCE(v_total_count, 0),
    'earned_count', COALESCE(v_earned_count, 0)
  );
END; $$;

REVOKE ALL ON FUNCTION referral_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION referral_status() TO authenticated;

-- earn_referral_credit(p_referred_user_id uuid): atomic cap+earn, SERVICE-ROLE ONLY.
-- Webhook calls this via service key. Never callable by clients.
CREATE OR REPLACE FUNCTION earn_referral_credit(p_referred_user_id UUID) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer_id UUID;
  v_self_count INT;
BEGIN
  -- Service-role gate — no authenticated role can call this
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'access denied'; END IF;

  -- Derive referrer from referrals row (defense-in-depth; RPC already blocks self-referral)
  SELECT referrer_id INTO v_referrer_id FROM referrals
    WHERE referred_user_id = p_referred_user_id AND status = 'pending'
    FOR UPDATE; -- lock the row to prevent double-earn races

  IF v_referrer_id IS NULL THEN
    RETURN false; -- no pending referral found (already earned / never had one)
  END IF;

  -- Explicit self-referral backstop (spec: referred_by != id): if a future
  -- writer ever inserts a self-referral row, this blocks the credit even
  -- though apply_referral_code already guards the normal path.
  IF v_referrer_id = p_referred_user_id THEN
    RETURN false;
  END IF;

  -- Fraud cap: atomic count-and-update inside advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('referral_cap:' || v_referrer_id::text));

  SELECT COUNT(*) INTO v_self_count FROM referrals
    WHERE referrer_id = v_referrer_id AND status = 'earned';

  IF v_self_count >= 3 THEN
    RETURN false; -- cap reached
  END IF;

  -- Earn the credit
  UPDATE referrals SET status = 'earned', earned_at = now()
    WHERE referred_user_id = p_referred_user_id AND status = 'pending';

  RETURN FOUND;
END; $$;

-- service_role only — webhook is the sole caller
REVOKE ALL ON FUNCTION earn_referral_credit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION earn_referral_credit(uuid) TO service_role;
