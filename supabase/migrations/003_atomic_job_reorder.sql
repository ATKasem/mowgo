-- Update a route as one transaction. Raising for a missing job rolls back all
-- preceding updates in the batch.
CREATE OR REPLACE FUNCTION reorder_jobs(p_user_id UUID, p_orders JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  updated_count INTEGER;
BEGIN
  IF jsonb_typeof(p_orders) <> 'array' THEN
    RAISE EXCEPTION 'p_orders must be an array';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_orders)
  LOOP
    UPDATE jobs
    SET route_order = (item->>'route_order')::INTEGER
    WHERE id = (item->>'id')::UUID
      AND user_id = p_user_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> 1 THEN
      RAISE EXCEPTION 'Job not found';
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION reorder_jobs(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_jobs(UUID, JSONB) TO service_role;
