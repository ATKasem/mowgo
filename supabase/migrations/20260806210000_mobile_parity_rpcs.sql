-- Mobile parity RPCs (iOS + Android rain-delay / void-invoice flows).
-- Mirrors create_invoice_for_job's SECURITY DEFINER + owner-resolution
-- pattern (023_create_invoice_for_job_rpc.sql).

CREATE TABLE IF NOT EXISTS public.rain_delay_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  jobs_moved integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rain_delay_entries_business_idx ON public.rain_delay_entries (business_id, created_at DESC);

-- Service-role-only (mirror tier_events / referrals): no client reads this
-- table directly today; it is written exclusively by apply_rain_delay below,
-- which is SECURITY DEFINER and bypasses RLS as the function owner.
ALTER TABLE public.rain_delay_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rain_delay_entries FROM anon, authenticated;

-- apply_rain_delay(p_business_id, p_from_date, p_to_date): moves a
-- business's scheduled jobs from one date to another (only the date column
-- changes, so scheduled_time is preserved) and logs one rain_delay_entries
-- row. Callable by the owner OR any crew member of that business — mirrors
-- create_invoice_for_job, where crew can act on the owner's behalf for
-- day-to-day operational actions (this is scheduling, not money).
CREATE OR REPLACE FUNCTION public.apply_rain_delay(
  p_business_id UUID,
  p_from_date DATE,
  p_to_date DATE
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_moved INTEGER;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_business_id IS NULL OR p_from_date IS NULL OR p_to_date IS NULL THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;

  -- Caller must belong to the target business (owner or crew member).
  -- current_business_id() resolves to the OWNER's id for both roles, so this
  -- also blocks a caller from passing someone else's business id.
  IF p_business_id <> current_business_id() THEN
    RAISE EXCEPTION 'not authorized for this business';
  END IF;

  UPDATE public.jobs
     SET scheduled_date = p_to_date
   WHERE user_id = p_business_id
     AND scheduled_date = p_from_date
     AND status = 'scheduled';

  GET DIAGNOSTICS v_moved = ROW_COUNT;

  INSERT INTO public.rain_delay_entries (business_id, from_date, to_date, jobs_moved, created_by)
  VALUES (p_business_id, p_from_date, p_to_date, v_moved, v_caller);

  RETURN v_moved;
END; $$;

REVOKE ALL ON FUNCTION public.apply_rain_delay(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_rain_delay(uuid, date, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_rain_delay(uuid, date, date) TO authenticated;

-- void_invoice(p_invoice_id): owner-only (NOT crew — this is financial,
-- unlike rain delay's operational scheduling above), idempotent.
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
     AND status = 'unpaid'
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
