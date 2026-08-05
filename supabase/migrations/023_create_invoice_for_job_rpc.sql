-- Owner-safe invoice creation for crew-completed jobs (023, v2)
--
-- RLS makes invoices owner-only (auth.uid() = user_id AND auth.uid() =
-- current_business_id()), so a crew member completing a job could never
-- insert the invoice for the owner. This SECURITY DEFINER RPC validates the
-- caller (job owner, or a crew member of the owner's business) and inserts
-- with the OWNER's user_id. ON CONFLICT makes it atomically idempotent per
-- job (matches the partial unique index on invoices(job_id)).
--
-- Returns a single row (invoice_id, created) for BOTH outcomes so clients
-- never have to fetch the invoice afterwards (crew callers can't see
-- owner-only rows through RLS).
drop function if exists public.create_invoice_for_job(uuid, numeric);

create or replace function public.create_invoice_for_job(
  p_job_id uuid,
  p_amount numeric
)
returns table (invoice_id uuid, created boolean, amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_user uuid;
  v_client uuid;
  v_rate numeric;
  v_caller uuid := auth.uid();
  v_created uuid;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  select user_id, client_id into v_job_user, v_client
  from public.jobs
  where id = p_job_id;

  if v_job_user is null then
    raise exception 'job not found';
  end if;

  -- Caller must be the job's owner or a crew member of that business.
  if v_caller <> v_job_user then
    if not exists (
      select 1 from public.profiles
      where id = v_caller and business_id = v_job_user
    ) then
      raise exception 'not authorized for this job';
    end if;
  end if;

  -- Server-side truth: the invoice amount is the client's stored rate, NOT
  -- the client-supplied p_amount. A modified client cannot inflate invoices.
  select rate into v_rate
  from public.clients
  where id = v_client;

  if v_rate is null or v_rate <= 0 or v_rate <> v_rate then
    raise exception 'invalid amount';
  end if;

  insert into public.invoices (user_id, client_id, job_id, amount, status)
  values (v_job_user, v_client, p_job_id, v_rate, 'unpaid')
  on conflict (job_id) where job_id is not null do nothing
  returning id into v_created;

  if v_created is not null then
    invoice_id := v_created;
    created := true;
  else
    -- Duplicate (another device won the race): return the existing invoice.
    select id into invoice_id from public.invoices where job_id = p_job_id;
    created := false;
  end if;
  -- Return the authoritative amount so clients never display a stale rate.
  amount := v_rate;
  return next;
end;
$$;

grant execute on function public.create_invoice_for_job(uuid, numeric) to authenticated;
