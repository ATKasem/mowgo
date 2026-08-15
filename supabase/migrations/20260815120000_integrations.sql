-- QuickBooks Online OAuth integration: stores per-user access/refresh tokens.
--
-- Intentionally no RLS policies for anon/authenticated — this table holds
-- plaintext OAuth tokens, and a "user can SELECT own row" policy (the usual
-- pattern for user-owned tables in this schema) would hand access_token /
-- refresh_token straight to browser JS via PostgREST. All reads/writes go
-- through Cloudflare Pages Functions using the Supabase service role
-- (functions/api/_shared/qbo-tokens.js); functions/api/integrations/qbo-status.js
-- returns only sanitized fields (connected, companyName, lastSyncedAt) to the
-- client. Same posture as activation_touches (20260806150000).
CREATE TABLE IF NOT EXISTS public.integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL CHECK (provider = 'quickbooks'),
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  realm_id       TEXT,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_user_provider
  ON public.integrations (user_id, provider);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;
GRANT ALL ON TABLE public.integrations TO service_role;
