-- Widen void_invoice to allow overdue invoices (UI offers Void for unpaid +
-- overdue on all platforms; the original guard only allowed 'unpaid', so
-- overdue voids silently no-op'd). Same owner-only, idempotent semantics.
CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id UUID) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_updated UUID;
BEGIN
  IF v_caller IS NULL OR v_caller <> current_business_id() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.invoices
     SET status = 'voided'
   WHERE id = p_invoice_id
     AND user_id = v_caller
     AND status IN ('unpaid', 'overdue')
  RETURNING id INTO v_updated;

  IF v_updated IS NOT NULL THEN
    RETURN true;
  END IF;

  -- Idempotent: a second call for an invoice this caller already voided
  -- still returns true instead of raising.
  RETURN EXISTS (
    SELECT 1 FROM public.invoices
     WHERE id = p_invoice_id AND user_id = v_caller AND status = 'voided'
  );
END; $$;

REVOKE ALL ON FUNCTION public.void_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_invoice(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_invoice(uuid) TO authenticated;
