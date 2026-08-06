-- Server-side enforcement of the free-tier 5-client cap (Hormozi audit fix #4).
-- The client-side check (client/src/lib/data.js createClient) is UX only —
-- RLS/triggers are the authz boundary (CLAUDE.md). clients.user_id is always
-- the BUSINESS OWNER's id: RLS policy "Clients: owner full access"
-- (002_crew_features.sql) requires auth.uid() = user_id AND
-- auth.uid() = current_business_id() on INSERT, so crew members can never
-- insert a clients row and NEW.user_id is always the owner — no business_id
-- join is needed, just count rows for NEW.user_id directly.
CREATE OR REPLACE FUNCTION enforce_free_client_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_count INTEGER;
BEGIN
  SELECT tier INTO v_tier FROM profiles WHERE id = NEW.user_id;

  -- Mirror the client's FREE_TIERS check: null/empty/'free' are all free tier.
  IF v_tier IS NULL OR v_tier = '' OR v_tier = 'free' THEN
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

REVOKE ALL ON FUNCTION enforce_free_client_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS free_client_limit_trigger ON clients;
CREATE TRIGGER free_client_limit_trigger
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION enforce_free_client_limit();
