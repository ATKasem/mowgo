# MowGo Canada Support Audit

## Findings

### 1. Phone Validation (8 files)
Symptom: "Enter a valid US phone number" — rejects valid Canadian numbers.
The regex `PHONE_RE` actually works for Canada (+1, 10-digit) but the error messages say "US".

Files:
- `client/src/pages/RouteAudit.jsx` — PHONE_RE + "US phone number" message
- `client/src/i18n/locales/en.json` — "Enter a valid US phone number"
- `functions/api/route-audit.js` — PHONE_RE + "US phone number" error
- `functions/api/leads/public.js` — PHONE_RE + "US phone number" error
- `functions/api/sms-optin.js` — "10-digit US phone number" error
- `supabase/functions/send-rain-delay-sms/index.ts` — "US phone" comment
- `supabase/functions/sms-inbound/index.ts` — "US phone" comment
- `supabase/functions/send-job-complete-sms/index.ts` — "US phone" comment

### 2. Pricing (5+ files)
Symptom: All prices shown as "$39/mo", "$79/mo" without currency identifier.
Need to say "$39 USD/mo" or show CAD-equivalent.

### 3. Postal Code (2 files — ALREADY FIXED)
- `client/src/pages/RouteAudit.jsx` — ✓ accepts Canadian postal codes
- `functions/api/route-audit.js` — ✓ accepts Canadian postal codes

### 4. SMS (3 files — WORKS FOR CANADA)
Canada uses +1 country code, same 10-digit format. No changes needed to normalization logic, just comments.

## Priority Fixes
1. Error messages: "US" → "US or Canada"
2. Pricing: add USD label