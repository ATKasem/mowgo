# Edge Functions

Supabase Edge Functions for MowGo iOS app.

## Functions

Payments (subscriptions and invoice card payments) no longer run here — see
`functions/api/payments/` and `docs/PAYMENTS.md`.

| Function | Purpose | Called by |
|----------|---------|-----------|
| `ai-chat` | Proxies chat messages to OpenRouter for AI responses | ChatService.swift |

## Deploy

```bash
# One-liner:
bash ../deploy-edge-functions.sh

# Or manually:
supabase functions deploy ai-chat
```

## Required Secrets

Set via `supabase secrets set KEY=value`:

- `OPENROUTER_API_KEY` — your OpenRouter API key
- `OPENROUTER_MODEL` — optional, defaults to `openai/gpt-4o-mini`

## Test

```bash
# Test AI chat (requires auth token):
curl -X POST https://vqgiynfrpsqddjrayczc.supabase.co/functions/v1/ai-chat \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What should I charge for a half-acre lot?"}]}'
```
