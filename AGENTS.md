# MowGo — Codex Project Instructions

Lawn-care scheduling SaaS (owner: Aaron). React web + SwiftUI iOS + Kotlin Android + Supabase + Cloudflare Pages Functions.

## Repository layout
See `docs/REPO_MAP.md` for the canonical map; `README.md` is the front door.

## Architecture
- Web: `client/src/` — React 19 + Vite + supabase-js + stripe-js. Client-only SPA (no RSC). i18n in `client/src/i18n/`.
- CF Pages Functions: `functions/api/` — webhook dispatcher, Stripe checkout/webhook, booking, route-audit, leads, invite-crew, concierge, team. Env vars in CF dashboard. Deploy = push to `main`.
- Shared SSRF validator: `functions/api/_shared/safe-webhook-url.js` — returns `{ok, reason}`, NOT boolean. Use for any webhook URL validation.
- iOS: `ios-native/MowGo/` — SwiftUI, Keychain sessions (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`), SwiftData cache, Stripe PaymentSheet.
- Android: `client/android-native/` — Kotlin, supabase-kt 3.0.1 + EncryptedSharedPreferences session manager, Stripe PaymentSheet, FCM.
- Supabase: `supabase/migrations/` — RLS is the authz ground truth. Edge functions in `supabase/functions/`.
- `server/` — legacy Node server, largely superseded by CF functions.

## Hard rules
- **RLS is the authorization boundary.** Never claim an authz bypass without verifying RLS policies in migrations. Client-side checks are UX, not security.
- **Verify before claiming:** read source, `node --check`, live DB via `timeout 90 npx supabase db query --linked "..."` (from repo root). The tool display redacts `Bearer ` as `***` — confirm raw bytes with `od -c` before reporting template-literal bugs.
- **No secrets in git.** Only `.env.example` committed. Never commit `.env`/keys/tokens.
- **Job photos:** private `job-photo` bucket; DB stores storage PATH (signed URLs expire); resolve at render (iOS `signedPhotoURL(for:)`, Android `signedUrl(pathOrUrl)`, web `createSignedUrl`).
- **Invoices:** auto-invoice via SECURITY DEFINER RPC `create_invoice_for_job` — server-truth amount = `clients.rate` (ignores client-supplied amount); idempotent per job; manual invoices owner-only, max $100,000. Use the RPC-returned amount for display (never stale local rates).
- **Webhooks out:** HMAC-SHA256 (`X-MowGo-Signature: sha256=...`), URL validated by `isSafeWebhookUrl` before fetch. Stripe webhooks: verified signature + event-id dedup via `webhook_events` (RLS service-role-only).
- **Rate limits:** in-memory per-isolate Maps (booking 5/15min, invite-crew 10/15min, concierge 20/15min, webhook-dispatch 20/15min). Check AFTER auth. CF dashboard Rate Limiting for production-grade.
- **Tiers:** solo/crew/premium. Crew features require `crew` or `premium`. Invite Flow-2 must reject targets who already run their own business (data-existence check — role defaults to `owner` for ALL accounts, role alone can't discriminate).
- **Logging:** `print()`/`println()`/`Log.w` in `#if DEBUG`/`BuildConfig.DEBUG`. `return` statements OUTSIDE the guards (release-build breaker otherwise).
- **CSV exports:** key_code/alarm_code REDACTED ("***") on all three platforms.
- **pages.dev:** gone from all clients (mowgoapp.com only). Server ALLOWED_ORIGINS may keep both during transition.

## Deployment
- Web + functions: `git push origin main` → CF Pages auto-deploy.
- Supabase migrations: `npx supabase db query --linked --file <migration>` (CLI history out of sync with prod — 007-018 applied out-of-band; do NOT `supabase db push` blindly).
- Edge functions: `npx supabase functions deploy <name>`.
- Mobile: manual builds (GitHub Actions workflows).

## Review expectations
- After any changeset: adversarial review before shipping (multi-model loop: Claude Code + Codex + Mimo). Be the sharpest reviewer — check boundary values, verify with real commands, challenge task framing.
- Fix ALL findings including LOW/edge cases — no accepted trade-offs unless documented with rationale.
- Report format: severity-ranked (CRITICAL/HIGH/MEDIUM/LOW), exact file:line, impact, exploit path, remediation. PASS/FAIL per verified fix. Final SHIP/NO-SHIP.
