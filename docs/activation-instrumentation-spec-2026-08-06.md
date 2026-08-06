# SPEC: Activation Instrumentation & Onboarding Loop (web) — Hormozi/Barry activation lane

**Date:** 2026-08-06 · **Rev:** 2 (post-Claude-review — fixes from adversarial review) · **Source:** Board review #1

## Goal
Close the activation loop. Data layer exists (`profiles.first_client_at / first_job_at / first_invoice_at / cancelled_at`, triggers in `20260806140500`). This rev: (1) RECONCILE with the existing checklist UI, (2) gate + surface the setup-call booking, (3) 24h/72h nudge emails + win-back #2, (4) weekly activation report.

## Current state (VERIFIED — Claude review pass 08-06)
- Timestamps + triggers: LIVE (`20260806140500_activation_timestamps.sql`). Set once on first insert, never overwritten. `cancelled_at` written by `functions/api/stripe/webhook.js` handleSubscriptionDeleted.
- **`client/src/components/OnboardingChecklist.jsx` ALREADY EXISTS and is live** — rendered at `Dashboard.jsx:6,125,185` (owner + non-owner views). 4-row dismissible checklist ("Add your first client" / "Schedule your first job" / "Mark a job complete" / conditional "Get set up — free concierge"). Data source: live COUNT queries on `clients`/`jobs`. Dismiss = PERMANENT (localStorage). i18n keys `onboarding.*` (en.json:1380 + es.json).
- `client/src/components/ConciergeSetup.jsx` EXISTS (used in Settings.jsx/Subscribe.jsx) — tier-UNAWARE: any user can fill business name + client CSV; only `concierge-submit.js:58` returns 403 for free tier. Free-tier users can enter real client PII before discovering ineligibility.
- `profiles.created_at` exists (001:9). RLS: user reads own profile (001:81).
- **NO** activation email script on disk (`mowgo_activation_emails.py` referenced in migration comment but absent). No weekly report. `Login.jsx:121-125` has a `confirmSent` branch — email-confirm users get no session at signup.
- `Booking.jsx` = client-facing job booking (book/quote modes) — NOT the setup call. Do not confuse.

## Build

### 1. Reconcile checklist — `client/src/components/OnboardingChecklist.jsx` (+ Dashboard.jsx wiring stays)
- **Data source switch:** read own `profiles` row (existing RLS policy) → derive 3 states from `first_client_at`, `first_job_at`, `first_invoice_at` (timestamps = "ever activated", single source of truth — replaces the live COUNT queries; COUNTs reflect current state and would re-nag after deletions).
- Keep existing component structure + permanent localStorage dismiss (do NOT make it session-scoped). Auto-hide entirely once all 3 timestamps set.
- Steps map 1:1 to timestamps; links to Clients / Today / Invoices pages. "Get set up — free concierge" row stays conditional (see §2 tier gate).
- i18n: reuse `onboarding.*` keys; add any new strings to both en/es; REMOVE keys that become dead (review after build).
- If all 3 complete → "You're rolling. Want a review call?" → concierge flow (gated per §2).
- Dark + light verified.

### 2. Setup-call booking step — tier-gated, fires on login/dashboard mount (not just post-signup)
- **Tier gate in UI (fixes free-tier PII trap):** gate in `ConciergeSetup.jsx` itself — free tier sees upgrade prompt ("Concierge setup is a Solo/Crew perk — upgrade to claim it"), NOT the business-name/CSV form. **Tier allowlist = `solo`, `crew`, `premium` — INCLUDING premium (Compare.jsx:69 advertises "Priority concierge setup — 48h import" as a Premium headline feature). The server gate `concierge-submit.js:58` currently allows only `['solo','crew']` — pre-existing bug (Premium users 403 on a paid feature); THIS BUILD fixes both the client gate AND `concierge-submit.js:58` (`['solo','crew','premium']`).** Server 403 stays as backstop for free tier.
- **Surface rule:** check on Dashboard mount (same pattern as OnboardingChecklist) — covers the email-confirm path that never gets a session at signup (`Login.jsx` `confirmSent` branch) and returning logins. Full-screen, dismissible: "Most crews are set up in 48h — your clients imported, first 30 days pre-scheduled." CTA → concierge flow. Free tier: skip → upgrade prompt only.
- Files: `ConciergeSetup.jsx` (gate), `Dashboard.jsx` (mount check), optionally Login.jsx post-signup branch (best-effort, non-blocking).
- Concierge Discord notification already fires on submit — no new notification work.

### 3. Activation email sequence + win-back #2 — NEW `scripts/mowgo_activation_emails.py` + hermes cron (weekdays, **9:15am CT — staggered from send_sms.py 9:00 slot**)
- DB-backed script (NOT a mirror of send_sms.py's local-JSON-queue architecture — send_sms.py reads TWILIO_* from /opt/data/.env and never touches Supabase; this script reads `profiles` via Supabase REST service role and needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `RESEND_API_KEY`). Share the cron cadence/cap/idempotency-log shape only.
- **Query T1/T2:** profiles where `created_at` in last 14 days AND `cancelled_at IS NULL` AND no touch row for (user, kind).
- **Query win-back #2 — SEPARATE query (fixes rev-1 logic bug):** profiles where `cancelled_at IS NOT NULL` AND `cancelled_at` in last 14 days (NOT tied to created_at window — cancellations happen 14-30+ days after signup) AND no winback2 touch.
- T1 — 24h after signup, no `first_job_at`: "Schedule your first job in 2 minutes" — 3 numbered steps (real UI steps), concierge link, reply line.
- T2 — 72h after signup, no `first_invoice_at`: "Your first invoice is 3 taps" — mark job complete → invoice auto-created → one-tap payment text; Rain-Proof guarantee reminder.
- Win-back #2 — 7 days after `cancelled_at`: "We made it easy to come back" — data export line, annual refund line (unused months refunded), direct reply.
- Send via Resend `invoices@mowgoapp.com` (pattern: `route-audit.js` sendEmail). Cap 20/day. **Failure semantics:** mark `status='failed'` + `attempt_count++` + `last_attempt_at`; retry next run, max 7 attempts (no double-send: status guard).
- No SMS (transactional SMS only after A2P approval — out of scope).
- Idempotency table `activation_touches`: `id, user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, kind text ('t1','t2','winback2'), status text default 'queued', sent_at timestamptz null, attempt_count int default 0, last_attempt_at timestamptz null, created_at timestamptz default now(), UNIQUE(user_id, kind)`. **RLS: enable, ZERO policies, REVOKE ALL on table+functions from anon/authenticated explicitly** (027_revoke_anon_execute precedent). `profiles` cascades from auth.users (001:8) — cascade covers account deletion.

### 4. Weekly activation report (same cron, Monday 9:15am CT)
- Cohort summary, signups last 14 days: N signups, % first_client, % first_job, % first_invoice, median hours-to-first-job, cancellations count.
- Delivery: hermes cron auto-deliver to #🌱mowgo — plain text, English only (cron output rule).
- Hermes-down resilience: script is idempotent (status guard) — missed days self-heal on next run.

## Files
- EDIT `client/src/components/OnboardingChecklist.jsx` (+ i18n en/es, key cleanup)
- EDIT `client/src/components/ConciergeSetup.jsx` (tier gate)
- EDIT `client/src/pages/Dashboard.jsx` (mount check for booking step)
- NEW `supabase/migrations/20260806XXXXXX_activation_touches.sql`
- NEW `scripts/mowgo_activation_emails.py` (+ cron registration)
- DOC: this spec

## Constraints
- No native (iOS/Android) changes in v1. No new npm deps. No invented numbers — email copy from real product steps/pricing only.
- RLS: both new tables service-role only, zero policies, explicit REVOKE from anon/authenticated.
- i18n both locales; dark+light verified; `git diff --check` clean; migration naming: timestamped only (repo convention — 007-018 applied out-of-band, never `supabase db push` blindly).
- Don't double-send: UNIQUE(user_id, kind) + status guard; script safe to re-run.
- Free-tier: no client-count nagging (T1/T2 target job/invoice steps); concierge gated in UI.
- Report: files changed, migration summary, env vars (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/RESEND_API_KEY for the script), deviations.
