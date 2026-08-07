# Leads v2 — Instant Lead Alerts (scope)

**Status:** In build · **Date:** 2026-08-06 · **Owner:** Blasian + Hermes + Claude Code CLI

## Decision trail

- Hormozi lens (feature-decision-lens protocol): "every problem is a lead problem"; sell at the
  point of deprivation; speed-to-lead is the single biggest conversion lever (60s response = +391%).
- Completes the Leads v1 story: quote link → lead lands → **alert → call in 60s**. The bucket
  exists; this stops the leak.
- Audit (2026-08-06, all 3 platforms): leads pipeline exists on web/iOS/Android. Push plumbing
  (APNs registration + FCM registration + `send-push` Supabase edge function with full APNs/FCM
  delivery + Twilio SMS edge function) is built and dormant. The expensive 90% is already paid for.
- **Scope: instant lead alerts ONLY.** Bulk import and the commercial-account finder are
  explicitly OUT (shelf, revisit after v1 proves out).

## Requirements

1. **Trigger:** when a lead is created via the public quote link
   (`functions/api/leads/public.js`, `source = booking_link`), alert the business owner **iff**
   `profiles.tier IN ('solo','crew','premium')` AND `profiles.lead_alerts_enabled = true`.
2. **Channels:**
   - **Mobile push (iOS + Android):** via the existing `send-push` Supabase edge function
     (APNs `device_token` / FCM `fcm_token`). Extend `send-push/index.ts` with a
     **server-triggered path**: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` →
     allow sending to any `userId` (validated UUID), with a per-user rate limit
     (5 alerts / 15 min). Keep the existing user-JWT self-send path untouched.
     Standardize env: use `SUPABASE_SERVICE_ROLE_KEY` (auto-injected by the platform) for the
     admin client — the current `SB_SERVICE_ROLE_KEY` reference may be unset.
   - **Web in-app:** toast + Leads-tab badge when the app is open — Supabase Realtime on
     `leads` INSERT filtered by `user_id` (owner-only RLS select policy already exists).
     If Realtime proves non-deliverable, fall back to a 60s poll of `loadLeads()`; prefer Realtime.
3. **Never fail lead creation on alert failure** — fire-and-forget via `waitUntil` (same
   pattern as `fireLeadWebhook` in public.js). The quote submitter must always get 201.
4. **Settings (web, Notifications section):** "Lead alerts" toggle bound to
   `profiles.lead_alerts_enabled` (server-persisted, default `true`). EN i18n keys ONLY —
   Hermes adds ES after the build (never let the coding agent translate).
5. **Push copy:** title `New lead request`, body `{name} · {source}` (short; no fabricated
   fields; the name is the lead's own submission).
6. **Demo mode:** toggle + alerts are no-ops.
7. **Do NOT touch `ios-native/` or `client/android-native/`** in this batch (parity is a
   follow-up dartboard item).
8. **No git commit/push/deploy/migrate from the agent** — implement + local verification only.
   Hermes handles migration, edge-function deploy, commit, push, smoke test.

## Migration — `supabase/migrations/20260806220000_lead_alerts.sql`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lead_alerts_enabled boolean NOT NULL DEFAULT true;
GRANT UPDATE (lead_alerts_enabled) ON profiles TO authenticated;  -- 002 revoked UPDATE on profiles; new columns need their own grant
ALTER PUBLICATION supabase_realtime ADD TABLE leads;              -- realtime broadcast for web toast
```

(Follow the 013_profile_location.sql precedent: new profile columns need their own column grant.)

## Files to change

- `supabase/functions/send-push/index.ts` — service-role auth path + per-user rate limit + env standardization.
- `functions/api/leads/public.js` — post-insert owner alert (profile fetch → tier/enabled check → fire-and-forget POST to send-push).
- `client/src/pages/Settings.jsx` — Lead alerts toggle (Notifications section, same switch pattern as rain delay).
- `client/src/lib/data.js` — profile update for `lead_alerts_enabled` + realtime/poll hook for new leads.
- `client/src/App.jsx` (or equivalent root) — mount the new-lead alert listener (toast anywhere in the app; badge on Leads tab in Clients.jsx).
- `client/src/pages/Clients.jsx` — Leads badge when unread new leads exist (minimal).
- `client/src/i18n/locales/en.json` — new keys only (leave es.json to Hermes).
- `supabase/migrations/20260806220000_lead_alerts.sql` — new.
- `docs/leads-v2-scope.md` — this file.

## Security

- Service-role path is the ONLY server trigger; guard by comparing the bearer token to the
  env secret (constant-time compare preferred). User-JWT path unchanged.
- Validate `userId` as UUID; per-user rate limit (5/15min); never echo lead PII beyond name+source.
- `leads/public.js` already rate-limits 5/15min per IP — keep. Alert path must not open an
  SMS/push-spam vector (rate limit on the send side too).

## Verification (Hermes runs after agent completes)

1. `cd client && npx vite build` passes.
2. `node --check` on changed CF functions.
3. Apply migration via `npx supabase db query --linked --file supabase/migrations/20260806220000_lead_alerts.sql` (NOT `db push`).
4. Deploy edge function: `npx supabase functions deploy send-push`.
5. Smoke: POST a test payload to `/api/leads/public` with a valid paid business_id → 201;
   alert path fires without breaking the response.
6. Adversarial review pass on the diff before ship.

## Out of scope (shelf)

- Bulk lead import (paste/CSV) — dartboard backlog.
- Commercial-account finder (OpenStreetMap) — dartboard backlog.
- Web push (VAPID/service worker), SMS owner alerts, iOS/Android parity — follow-ups.
