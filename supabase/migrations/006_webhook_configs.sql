-- Migration 006: Zapier-ready webhook support
-- Creates webhook_configs table with RLS so users can manage their
-- own Zapier webhook configuration. Webhooks are fired via the
-- send-webhook Edge Function, called from the frontend when events
-- occur (job created, invoice paid, etc.).

-- ============================================================
-- 1. webhook_configs table
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_configs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  zapier_url TEXT NOT NULL,
  events     JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Only one active config per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_configs_user_active
  ON webhook_configs (user_id) WHERE is_active = true;

-- ============================================================
-- 2. RLS — users can only see/edit their own configs
-- ============================================================
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own webhook configs"
  ON webhook_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhook configs"
  ON webhook_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhook configs"
  ON webhook_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhook configs"
  ON webhook_configs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Note: Webhooks are fired by the send-webhook Edge Function.
-- The frontend calls it via supabase.functions.invoke() when
-- events occur. This avoids needing pg_net for DB triggers.
--
-- To add DB-trigger-based firing later, you'd:
--   1. Enable the pg_net extension: CREATE EXTENSION IF NOT EXISTS pg_net;
--   2. Add AFTER INSERT/UPDATE triggers on jobs, invoices, clients
--      that call net.http_post() to the send-webhook function.
-- ============================================================
