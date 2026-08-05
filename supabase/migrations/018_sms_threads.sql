-- Rain-delay SMS reply routing (018)
create table public.sms_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_phone text not null,
  last_activity timestamptz not null default now(),
  last_from text not null default 'client' check (last_from in ('client', 'owner')),
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index sms_threads_user_activity_idx on public.sms_threads (user_id, last_activity desc);

alter table public.sms_threads enable row level security;

-- Intentionally no policies: only the service role, which bypasses RLS, may access this table.
