-- sms_optins: A2P 10DLC opt-in capture (service-role only, no RLS policies needed)
create table if not exists public.sms_optins (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  source text not null default 'sms-optin-page',
  created_at timestamptz not null default now()
);

-- 024 patch: separated informational + marketing consent columns
alter table public.sms_optins add column if not exists consent_info boolean not null default false;
alter table public.sms_optins add column if not exists consent_mkt boolean not null default false;

alter table public.sms_optins enable row level security;
-- No policies: only service role (via CF Pages Function) writes; no client reads.
