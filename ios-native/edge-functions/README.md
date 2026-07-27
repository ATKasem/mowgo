# Edge Functions

Supabase Edge Functions for MowGo iOS app.

## Functions

| Function | Purpose | Called by |
|----------|---------|-----------|
| `ai-chat` | Proxies chat messages to OpenRouter for AI responses | ChatService.swift |
| `create-payment-intent` | Creates Stripe PaymentIntent for invoice payments | StripeService.swift |
| `confirm-payment` | Marks invoice as paid after successful payment | StripeService.swift |
| `create-checkout-session` | Creates Stripe Checkout for subscription upgrades | StripeService.swift |

## Deploy

```bash
# One-liner:
bash ../deploy-edge-functions.sh

# Or manually:
supabase functions deploy ai-chat
supabase functions deploy create-payment-intent
supabase functions deploy confirm-payment
supabase functions deploy create-checkout-session
```

## Required Secrets

Set via `supabase secrets set KEY=value`:

- `OPENROUTER_API_KEY` — your OpenRouter API key
- `OPENROUTER_MODEL` — optional, defaults to `openai/gpt-4o-mini`
- `STRIPE_SECRET_KEY` — Stripe secret key (`sk_live_...` or `sk_test_...`)
- `STRIPE_PRICE_SOLO` — `price_1TwFiDGwXKVLlr2IIyi3NmBi` (Solo tier)
- `STRIPE_PRICE_CREW` — `price_1TwFiUGwXKVLlr2InMLdsc6T` (Crew tier, $79/mo)

## Test

```bash
# Test AI chat (requires auth token):
curl -X POST https://vqgiynfrpsqddjrayczc.supabase.co/functions/v1/ai-chat \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What should I charge for a half-acre lot?"}]}'
```
