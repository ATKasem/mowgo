# MowGo — Project Context for Claude Code

MowGo is a lawn-care scheduling SaaS (owner: Aaron). Three client platforms + Supabase + Cloudflare Pages.

## Repository layout
See `docs/REPO_MAP.md` for the canonical map; `README.md` is the front door.

## Architecture
- **Web:** `client/src/` — React 19 + Vite + @supabase/supabase-js. Client-only SPA (no RSC). i18n via `client/src/i18n/`.
- **Cloudflare Pages Functions:** `functions/api/` — webhook dispatcher, payments (`api/payments/`), booking, route-audit, leads, invite-crew, concierge, team. Env vars set in CF dashboard (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENTS_PROVIDER`, etc.). Deploy = push to `main` (git integration).
- **Shared SSRF validator:** `functions/api/_shared/safe-webhook-url.js` — USE IT for any new outgoing-webhook URL validation (returns `{ok, reason}`, not boolean).
- **iOS:** `ios-native/MowGo/` — SwiftUI, Keychain session storage (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`), SwiftData local cache, hosted payment pages (SFSafariViewController).
- **Android:** `client/android-native/` — Kotlin, supabase-kt 3.0.1 with **EncryptedSharedPreferences session manager** (EncryptedSessionManager.kt), hosted payment pages, FCM.
- **Supabase:** `supabase/migrations/` — RLS is ground truth for authz. Tables: profiles, clients, jobs, invoices, estimates, leads, webhook_configs, team_invitations, concierge_requests, route_audits, testimonials, tier_events, sms_threads, webhook_events. Edge functions in `supabase/functions/` (deployed via `npx supabase functions deploy`).
- **Server (legacy/dead-ish):** `server/` — Node server, largely superseded by CF functions.

## Key conventions
- **RLS is the authorization boundary.** Never claim an authz bypass unless you've verified the RLS policies in migrations. Client-side checks are UX, not security.
- **Verify before claiming:** read actual source, run `node --check`, query the live DB (`timeout 90 npx supabase db query --linked "..."`). The tool display redacts `Bearer ` as `***` — check raw bytes with `od -c` before reporting template-literal bugs.
- **Review output format:** severity-ranked findings (CRITICAL/HIGH/MEDIUM/LOW) with exact `file:line`, impact, exploit path, remediation. PASS/FAIL per verified fix. Final SHIP/NO-SHIP verdict. Read-only — never modify files during review.
- **No secrets in git:** only `.env.example` files are committed. Never commit `.env`, keys, or tokens.
- **Job photos:** stored in PRIVATE `job-photo` Supabase bucket; DB stores the storage PATH (signed URLs expire); resolve at render via `signedPhotoURL(for:)` (iOS) / `signedUrl(pathOrUrl)` (Android) / `createSignedUrl` (web).
- **Invoices:** auto-invoice for completed jobs via SECURITY DEFINER RPC `create_invoice_for_job` — server-truth amount = `clients.rate`, ignores client-supplied amount; idempotent per job. Manual invoices: owner-only, max $100,000.
- **Webhooks out:** HMAC-SHA256 signed (`X-MowGo-Signature: sha256=...`), validated by `isSafeWebhookUrl` (https-only + DNS-rebinding check) before fetch.
- **Payments:** provider-neutral layer in `functions/api/_shared/payments/` (see `docs/PAYMENTS.md`). Nothing outside `providers/` may call a processor API. Stripe is fully removed (code, SDKs, DB columns). Rise Concepts (MX Merchant) is the provider and the default for `PAYMENTS_PROVIDER`; `providers/rise.js` is a stub until Rise's API is wired, so endpoints return 503 `payments_unavailable` and clients show "coming soon". Provider webhooks: verified signature, event-id dedup via `webhook_events` (`<provider>:<id>`, RLS service-role-only). Invoices are marked paid only by the webhook, never by clients; invoice card payments must settle to the business's own `merchant_accounts` row.
- **Rate limits:** in-memory per-isolate Maps (booking 5/15min, invite-crew 10/15min, concierge 20/15min, webhook-dispatch 20/15min). Comments note CF dashboard Rate Limiting for production-grade limits. Always run rate-limit checks AFTER auth.
- **Tiers:** solo / crew / premium. Crew features require tier `crew` or `premium`. Invite flow: owner with Crew/Premium plan invites; Flow-2 (existing user) must reject targets who already run their own business (check business data existence — role defaults to `owner` for ALL accounts, so role alone can't discriminate).
- **iOS/Android logging:** `print()`/`println()`/`Log.w` must be wrapped in `#if DEBUG` / `BuildConfig.DEBUG`. `return` statements must stay OUTSIDE the debug guards.
- **CSV exports:** key_code/alarm_code are REDACTED ("***") on all three platforms.
- **Demo mode:** `isDemoMode()` / `demo://` prefixes are client-only; keep demo paths separate from real logic.

## Deployment
- Web + CF functions: `git push origin main` → Cloudflare Pages auto-deploy.
- Supabase migrations: applied via `npx supabase db query --linked --file <migration>` (CLI history is out of sync with prod — 007-018 applied out-of-band; do NOT run `supabase db push` blindly). **NEW migrations use timestamp names** (`YYYYMMDDHHMMSS_description.sql`, e.g. `20260805193000_client_coords.sql`) — the numeric `007_`/`012_` prefixes already have duplicates and must not be extended.
- Edge functions: `npx supabase functions deploy <name>`.
- Mobile: manual app builds (Xcode/Gradle via GitHub Actions workflows).

## Review expectations
- After ANY changeset: run an adversarial review (self or delegated) before shipping. The repo uses a multi-model loop (Claude Code + Codex + Mimo). When you're Claude Code: be the sharpest reviewer in the room — check boundary values, verify claims with real commands, challenge the task framing.
- Fix ALL findings including LOW/edge cases — no accepted trade-offs unless explicitly documented with rationale.
