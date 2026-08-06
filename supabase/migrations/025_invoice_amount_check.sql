-- Server-side invoice amount cap (defense-in-depth; client caps are UX).
-- Manual invoice path inserts directly (no RPC), so enforce at the DB level.
-- Rate-truth RPC amounts come from clients.rate — a CHECK here also bounds
-- any future rate-driven path. 0 rows exist today; constraint is safe.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_amount_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_amount_check
  CHECK (amount > 0 AND amount <= 100000);
