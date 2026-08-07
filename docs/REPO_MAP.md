# MowGo — Repository Map

Canonical layout for humans and agents. `README.md` is the front door; this is the floor plan.

## Top level

| Path | What it is | App code? |
|---|---|---|
| `client/` | React 19 + Vite web app. `src/` = pages, components, lib, hooks, i18n. `android-native/` = Kotlin Android app (supabase-kt, FCM). `public/` = static assets | ✅ web + android |
| `functions/` | **Cloudflare Pages Functions — the production API.** `api/` subdir: stripe checkout/webhook/portal, route-audit, leads, concierge, autopilot, team invites, booking. `_shared/` = shared validators (e.g. `safe-webhook-url.js`) | ✅ API |
| `supabase/` | `migrations/` = SQL schema (RLS is the authorization ground truth). `functions/` = edge functions (auth hooks, checkout session for native) | ✅ backend |
| `ios-native/` | SwiftUI iOS app (`MowGo/`), Keychain sessions, SwiftData cache, Stripe PaymentSheet. `edge-functions/` = Supabase edge functions used by iOS | ✅ iOS |
| `server/` | Legacy Node/Express server — dev + invoice path only, largely superseded by `functions/`. `test/` = webhook tests | ⚠️ legacy |
| `scripts/` | Ops + cron backend scripts (activation emails, lead nurture, vault sync dumps, etc.). **Called by absolute path from Hermes cron wrappers — do not move** | ⚙️ ops |
| `docs/` | Specs, setup guides (Supabase auth, Stripe, CI/CD, store metadata, architecture, brand) | 📄 |
| `marketing/` | Playbooks, content templates, social strategy | 📄 |
| `ops/` | Non-app artifacts. `ops/archive/agent-scratch/` = one-shot agent working files; `ops/archive/reports/` = historical one-shot reports | 🗄️ archive |
| `certs/`, `profiles/`, `match_version.txt` | fastlane match signing store for CI | 🔐 CI |
| `.github/workflows/` | CI: `android-native-ci.yml`, `ios-ci.yml` | ⚙️ CI |
| `AGENTS.md` | Codex/agent hard rules (RLS boundary, verification discipline, no secrets) | 📄 |
| `CLAUDE.md` | Claude Code project context | 📄 |
| `test/` | Webhook / function tests | ✅ |

## Cron-generated live data (tracked, DO NOT move)

These are written + committed by background Hermes crons. They are part of the ops loop, not the app:

| Path | Producer |
|---|---|
| `vault/` | Nightly vault sync — raw Discord channel dumps (`YYYY-MM-DD_channel-*-raw.md`) |
| `intel/` | MowGo Intel Engine — research/market intel snapshots |
| `leads/` | Lead tracking + outreach state (`reddit-threads.md`, `sms-scripts-batch1.md`, ...) |
| `daily_scan.json` | Cowork 7am scan → consumed by 8am action cron |
| `daily_report/`, `daily_actions/`, `reports/` | Cowork + QA outputs |
| `.run_markers/`, `.bi_state.json`, `.bi_tools/` | BI engine state + run markers |
| `bi_report_*.md`, `weekly_digest_*.md`, `monday_plate_*.md` (root, gitignored going forward) | One-shot BI/report outputs |

## Client app (web) — src layout

```
client/src/
  main.jsx, App.jsx      entry + RequireAuth guard + HashRouter + shared state
  pages/                 Landing, RouteAudit, Compare, Login, ResetPassword, Subscribe,
                         Layout (5-tab nav) → Home, Today, Clients, Invoices, Settings, Autopilot
  components/            JobCard, NewJobForm, InvoiceToast, OnboardingChecklist, ConciergeSetup, ...
  lib/                   supabase.js (demo mode), payments.js (Stripe), constants.js,
                         offlineStorage.js, maps.js, autopilotTools.js, ics.js, demoData.js
  hooks/                 useAutopilot.js, ...
  i18n/                  locale files (textKey 72-char truncation — see AGENTS.md)
```

## API (functions/api) — endpoint index

| Endpoint | Purpose |
|---|---|
| `stripe/checkout-subscription.js` | Create Stripe Checkout session (solo/crew/premium × month/year) |
| `stripe/webhook.js` | **Production billing truth** — updates `profiles.tier` |
| `stripe/create-portal-session.js` | Customer billing portal |
| `route-audit.js` | Free route-audit lead magnet (estimate email + lead capture) |
| `leads/public.js` | Lead intake (shared phone regex with route-audit) |
| `autopilot.js` | LLM proxy for chat-to-CRM |
| `concierge/` | Done-for-you setup request handling |
| `invite-crew.js`, `booking.js`, `team.js` | Crew + booking |
| `_shared/safe-webhook-url.js` | SSRF validator — returns `{ok, reason}` |

## Deployment model

`git push origin main` → Cloudflare Pages auto-deploy (web + functions). No web CI — verify with prod build + adversarial review before pushing. Supabase migrations via `supabase db query --linked` (CLI history out of sync — never blind `db push`).

## Conventions (from AGENTS.md)

- **RLS is the authorization boundary** — client-side checks are UX, not security.
- **No secrets in git** — only `.env.example`.
- **Verify before claiming** — read source, `node --check`, live DB probes.
- **Tiers:** solo / crew / premium. Crew features need crew+.
- **CSV exports** redact key_code / alarm_code on all platforms.
- **Logging:** debug-only via `#if DEBUG` / `BuildConfig.DEBUG`.
