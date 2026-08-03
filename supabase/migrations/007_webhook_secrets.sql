-- Migration 007: Webhook secrets + multi-URL support
-- Adds HMAC secret column, drops the one-active-config-per-user constraint,
-- and adds a label column so users can name their endpoints.

-- ============================================================
-- 1. Add secret + label columns
-- ============================================================
ALTER TABLE webhook_configs ADD COLUMN IF NOT EXISTS secret TEXT;
ALTER TABLE webhook_configs ADD COLUMN IF NOT EXISTS label TEXT;

-- Backfill secrets for existing rows that lack one
UPDATE webhook_configs SET secret = encode(gen_random_bytes(32), 'hex') WHERE secret IS NULL;

-- Make secret NOT NULL now that all rows have one
ALTER TABLE webhook_configs ALTER COLUMN secret SET NOT NULL;

-- ============================================================
-- 2. Drop the one-active-config-per-user unique index
--    so users can configure multiple webhook endpoints
-- ============================================================
DROP INDEX IF EXISTS idx_webhook_configs_user_active;
