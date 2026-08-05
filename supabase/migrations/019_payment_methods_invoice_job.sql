-- Payment methods for invoice texts + invoice-job linkage (019)
alter table public.profiles
  add column if not exists venmo_handle text,
  add column if not exists cashapp_handle text,
  add column if not exists zelle_handle text;

alter table public.invoices
  add column if not exists job_id uuid;

-- One invoice per completed job (idempotent auto-invoicing)
create unique index if not exists invoices_job_id_unique on public.invoices (job_id) where job_id is not null;

-- RLS: migration 002 only grants named columns on profiles; the new payment
-- fields need explicit UPDATE grants for authenticated users.
grant update (venmo_handle, cashapp_handle, zelle_handle) on public.profiles to authenticated;

-- NOTE: invoices.job_id and its FK to jobs(id) already exist in the base schema;
-- 019 only adds the unique index above (idempotency guard).
