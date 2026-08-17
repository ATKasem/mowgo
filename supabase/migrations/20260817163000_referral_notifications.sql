-- Referral notification: sets up app-level config so apply_referral_code can
-- call the Cloudflare Pages referral-notify function via pg_net.
--
-- These config vars are read by apply_referral_code (defined in
-- 20260806160000_referrals.sql) which was modified to call
-- net.http_post() with these settings.
--
-- The actual function is re-deployed below so the migration is self-contained.

-- Set the notification endpoint URL. Must match the deployed Cloudflare Pages
-- function path. The 'true' flag means missing is OK (no error if not set).
ALTER DATABASE postgres SET app.referral_notify_url TO 'https://mowgoapp.com/api/integrations/referral-notify';

-- Service role key for authenticating to the notification function.
-- NOTE: This MUST be set via "supabase db set-config" or Dashboard SQL
-- after deployment — ALTER DATABASE only sets the default for new connections.
-- We set it here as a fallback; the actual value must be configured manually.
-- ALTER DATABASE postgres SET app.sb_service_key TO '';

-- Re-deploy apply_referral_code with the pg_net notification call
-- (the function body was edited in the migration file above).
CREATE OR REPLACE FUNCTION apply_referral_code(p_code TEXT) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p_norm TEXT;
  my_code TEXT;
  v_referrer_id UUID;
  v_referrer_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  p_norm := UPPER(TRIM(p_code));
  SELECT referral_code INTO my_code FROM profiles WHERE id = auth.uid();
  IF my_code IS NOT NULL AND my_code = p_norm THEN
    RAISE EXCEPTION 'cannot refer yourself';
  END IF;
  IF profile_is_referred(auth.uid()) THEN
    RETURN 'already_referred';
  END IF;
  SELECT id, business_name INTO v_referrer_id, v_referrer_name
    FROM profiles WHERE referral_code = p_norm;
  IF v_referrer_id IS NULL OR v_referrer_name IS NULL THEN
    RETURN null;
  END IF;
  UPDATE profiles SET referred_by = v_referrer_id
    WHERE id = auth.uid() AND referred_by IS NULL;
  BEGIN
    INSERT INTO referrals (referrer_id, referred_user_id, code_used)
    VALUES (v_referrer_id, auth.uid(), p_norm);
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already_referred';
  END;
  -- Fire-and-forget notification
  PERFORM net.http_post(
    url := current_setting('app.referral_notify_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.sb_service_key', true)
    ),
    body := jsonb_build_object(
      'referrer_id', v_referrer_id::text,
      'referrer_name', v_referrer_name,
      'new_user_id', auth.uid()::text,
      'code_used', p_norm
    )::text
  );
  RETURN v_referrer_name::text;
END; $$;

REVOKE ALL ON FUNCTION apply_referral_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION apply_referral_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION apply_referral_code(text) TO authenticated;