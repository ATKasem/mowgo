create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  source text not null default 'other' check (source in ('booking_link', 'phone', 'facebook', 'referral', 'walk_in', 'other')),
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_user_created_idx on public.leads (user_id, created_at desc);
alter table public.leads enable row level security;

create policy "Owners can select leads" on public.leads for select using (user_id = auth.uid());
create policy "Owners can insert leads" on public.leads for insert with check (user_id = auth.uid());
create policy "Owners can update leads" on public.leads for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owners can delete leads" on public.leads for delete using (user_id = auth.uid());
