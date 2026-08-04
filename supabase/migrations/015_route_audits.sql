create table public.route_audits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  zip text not null,
  lawns_bucket text not null,
  crew_bucket text not null,
  hours_wasted_week integer not null,
  revenue_impact_month integer not null,
  created_at timestamptz not null default now()
);

create index route_audits_email_idx on public.route_audits (email);

alter table public.route_audits enable row level security;

-- Intentionally no policies: only the service role, which bypasses RLS, may access this table.
