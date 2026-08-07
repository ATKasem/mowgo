-- Tighten the voided-guard trigger: only fire on status changes (negligible
-- overhead otherwise; correctness identical).
CREATE OR REPLACE FUNCTION public.guard_invoice_voided()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'voided' AND NEW.status IS DISTINCT FROM 'voided' THEN
    RAISE EXCEPTION 'voided invoice cannot change status';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS invoices_guard_voided ON public.invoices;
CREATE TRIGGER invoices_guard_voided
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.guard_invoice_voided();

REVOKE ALL ON FUNCTION public.guard_invoice_voided() FROM PUBLIC, anon, authenticated;
