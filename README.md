# MowGo

Lawn-care scheduling SaaS — **"The lawn care app that just works. Even when it rains."**

Built by Aaron (lawn care business owner) for lawn care businesses. Web app + native iOS (SwiftUI) + native Android (Kotlin), on Supabase + Cloudflare Pages. Card payments go through a swappable payment provider (see `docs/PAYMENTS.md`).

## Live

| Domain | Purpose |
|---|---|
| **mowgoapp.com** | Production — what customers see |
| mowgo.pages.dev | Secondary Cloudflare Pages deployment (dev/staging parity) |

> ⚠️ This repo was originally a fastlane `match` certs repo; the old auto-generated README has been replaced. If `fastlane match` runs against this repo it may overwrite `README.md` — the canonical project docs live in `docs/` and `docs/REPO_MAP.md`.

## Stack

- **Web:** React 19 + Vite 8 + Tailwind v4 + supabase-js (SPA, HashRouter)
- **API:** Cloudflare Pages Functions (`functions/api/`) — provider-neutral payments (`api/payments/`), route audit, leads, concierge, autopilot, team invites
- **Backend:** Supabase (Postgres, RLS = authz ground truth, migrations in `supabase/migrations/`)
- **iOS:** SwiftUI (`ios-native/MowGo/`), Keychain sessions, hosted payment pages (no payment SDK)
- **Android:** Kotlin (`client/android-native/`), supabase-kt, FCM
- **Payments:** provider layer in `functions/api/_shared/payments/` — Rise Concepts (MX Merchant) is the processor (Stripe fully removed); card payments show "coming soon" until `providers/rise.js` is implemented. Tiers: Free / Solo $39 / Crew $79 / Premium $199, 14-day no-card trial

## Repo layout

Full map: **`docs/REPO_MAP.md`** · Agent instructions: **`AGENTS.md`** (Codex) · **`CLAUDE.md`** (Claude Code)

```
client/          Web app (src/ = pages, components, lib, i18n; android-native/ = Kotlin)
functions/       Cloudflare Pages Functions (the production API)
supabase/        Migrations + edge functions
ios-native/      SwiftUI iOS app + edge functions
server/          Legacy Node server (dev + invoice only; largely superseded by functions/)
scripts/         Ops/cron backend scripts (called by Hermes cron wrappers)
docs/            Specs, setup guides, store metadata, repo map
marketing/       Playbooks + content templates
ops/             Non-app artifacts: archive of agent scratch + one-shot reports
certs/, profiles/  fastlane match (CI signing)
.github/         CI workflows (Android native, iOS)
```

## Quickstart (web)

```bash
cd client
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
```

## Deployment

- **Web + functions:** `git push origin main` → Cloudflare Pages auto-deploy (mowgoapp.com + mowgo.pages.dev). No CI on GitHub for the web app — verify with a prod build + review before pushing.
- **Supabase migrations:** `npx supabase db query --linked --file <migration>` (history is out of sync with prod — never `supabase db push` blindly).
- **Edge functions:** `npx supabase functions deploy <name>`.
- **Mobile:** GitHub Actions workflows (`.github/workflows/android-native-ci.yml`, `ios-ci.yml`) — manual builds.

## Key docs

- `AGENTS.md` — hard rules (RLS boundary, no secrets in git, verification discipline)
- `CLAUDE.md` — Claude Code project context
- `docs/REPO_MAP.md` — canonical repository map
- `docs/APP_STORE.md`, `docs/PLAY_STORE.md` — store metadata
- `docs/IOS_CI_SETUP.md`, `docs/ANDROID_CI_SETUP.md`, `docs/CAPACITOR_SETUP.md` — CI setup guides

## Notes

- Demo mode: `VITE_FORCE_DEMO=true` bypasses auth (used for preview builds only).
- No secrets in git — only `.env.example` is committed. Real env vars live in the CF Pages dashboard and local `.env` files.
