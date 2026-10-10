-- merchant_accounts: one business per provider merchant id.
--
-- Provider webhooks (merchant.updated, invoice payments) identify a business
-- by its merchant id; a unique index keeps that lookup unambiguous and fast.
--
-- Idempotent: safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS merchant_accounts_provider_merchant_idx
  ON public.merchant_accounts (provider, provider_merchant_id)
  WHERE provider_merchant_id IS NOT NULL;
