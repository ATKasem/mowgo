-- Migration 010: Rename zapier_url -> url for webhook dispatch consistency
-- The webhook-dispatch edge function and WebhookSettings UI expect 'url',
-- but 006 created the column as 'zapier_url'.
ALTER TABLE webhook_configs RENAME COLUMN zapier_url TO url;
