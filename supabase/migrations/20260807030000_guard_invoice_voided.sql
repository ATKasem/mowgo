-- Voided invoices are terminal: block any status transition away from 'voided'.
-- UI gates exist on web/iOS/Android; this is the server-truth backstop so a
-- direct update (or a stale client) cannot flip a voided invoice back to
-- collectible status. Mirrors the owner-only void_invoice RPC semantics.
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
  EXECUTE FUNCTION public.guard_invoice_voided();

REVOKE ALL ON FUNCTION public.guard_invoice_voided() FROM PUBLIC, anon, authenticated;
