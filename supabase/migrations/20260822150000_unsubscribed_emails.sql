-- Unsubscribed emails blocklist for List-Unsubscribe compliance.
-- The unsubscribe page (POST /api/unsubscribe) inserts rows here via the
-- service_role key.  The email-send and email-followup scripts check this
-- table at send time (or its local mirror /opt/data/mowgo/leads/blocked_emails.json).
-- RLS is disabled because inserts come from a Pages Function using the
-- service_role key; the table itself is internal-only, never exposed to clients.
create table if not exists unsubscribed_emails (
  id bigint generated always as identity primary key,
  email text not null,
  source text not null default 'unsubscribe_page',
  created_at timestamptz not null default now()
);
-- Speed up the send-time lookup (lower(email) in select).
create index if not exists idx_unsubscribed_emails_lower_email
  on unsubscribed_emails (lower(email));