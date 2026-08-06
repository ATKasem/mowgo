# SPEC: Speed-to-Lead (signups + route-audit leads) — Efti/Hormozi sales lane

**Date:** 2026-08-06 · **Rev:** 2 (post-Claude-review — fixes from adversarial review) · **Source:** Board review #2

## Goal
Stop the funnel ending at "Start Free". Instant touch on (a) every signup and (b) every route-audit submission; Day-2/Day-7 follow-ups; Blasian alerted on qualified leads immediately. SMS BUILT NOW, GATED on Twilio A2P approval (campaign CMbadd01fd23d5a51b3cd5b00aeb923e40 in review; queue auto-retries daily — send_sms.py pattern).

## Current state (VERIFIED — Claude review pass 08-06)
- Route audit (`functions/api/route-audit.js`): name/email/zip/buckets → `route_audits` + instant report email via Resend (`invoices@mowgoapp.com`). NO phone field, NO follow-up, NO lead alert. `route_audits.email` has NON-unique index (015:12).
- Signups: nothing fires. `profiles.phone` exists but not collected at signup (Login.jsx has no phone field).
- SMS infra: Twilio +1 405-914-5837; `leads/sms_queue.json` + `scripts/send_sms.py` (10/day, weekdays 9:00am CT, cron `3f67268baeb6`). A2P opt-in page + consent copy live (`/#/sms-optin`, `SmsOptIn.jsx` — NOTE: hardcoded English, NOT in i18n).
- Discord pattern in this codebase = BOT TOKEN → `channels/{id}/messages` (`concierge-submit.js:71-77`); NO incoming-webhook usage anywhere.
- `functions/api/leads/public.js` exists — `leads` table tied to per-business `webhook_configs` (quote-request notifications). SEPARATE system from `lead_touches` — naming trap, do not confuse.
- Phone validation pattern exists: `PHONE_RE` in `functions/api/leads/public.js:9`.
- Pricing truth (Compare.jsx:61-62): Solo $39 = single owner; Crew $79 = 2-3 people, no per-user fees. Jobber $139 + $29/extra user (compare page, verified 08-06).

## Build

### 1. Migration — `lead_touches` table + `route_audits.phone` + consent
- NEW `lead_touches`: `id uuid pk, source text ('route_audit'|'signup') (attribution only — NOT part of dedup), user_id uuid null REFERENCES profiles(id) ON DELETE CASCADE, lead_email text not null, lead_phone text null, kind text ('instant'|'day2'|'day7'), channel text ('email'|'sms'), status text default 'queued', sent_at timestamptz null, attempt_count int default 0, last_attempt_at timestamptz null, created_at timestamptz default now()`.
- **Dedup key = `UNIQUE(lead_email, kind)`** (rev-1 bug: per-source dedup allowed 6 touches on the audit→signup path — the PRIMARY conversion path. One funnel per email: max 3 touches total, ever). Index on (status, created_at). Email always stored LOWERCASED (case-insensitive dedup; Postgres unique is case-sensitive).
- ALTER `route_audits`: `phone text null` + `sms_consent boolean not null default false`.
- RLS: enable, ZERO policies, explicit `REVOKE` from anon/authenticated (027 precedent). Retention: purge `lead_touches` rows older than 90 days with no action (script §4).
- Migration naming: timestamped only (repo convention).

### 2. Route audit → instant touch + lead alert (extend `functions/api/route-audit.js`)
- Add optional `phone` (validate with the EXISTING `PHONE_RE` pattern from `leads/public.js:9` — do not invent a new regex) + SMS consent checkbox (RouteAudit.jsx). Consent copy: mirror sms-optin language, MARKETING-ONLY + campaign-scoped + STOP; **add es translation — SmsOptIn.jsx is hardcoded English, so this build adds the first es strings for consent (scope it explicitly; keep English byte-identical).** No phone/consent → email-only.
- Normalize email to lowercase before insert/dedup lookups.
- On success: `lead_touches` inserts — instant email (the report email IS the instant touch → mark `sent`), day2/day7 queued (email); sms variants queued ONLY if phone+consent, status 'queued' until A2P gate opens. On insert conflict (23505) → treat as success (existing `concierge-submit.js:63-67` pattern).
- Qualified lead alert (lawns 10–25 or 25–50 AND crew solo/2–3): **bot-token pattern** (`concierge-submit.js:71-77`): POST `channels/{DISCORD_LEADS_CHANNEL_ID}/messages` with `DISCORD_BOT_TOKEN`. **NEW env var: `DISCORD_LEADS_CHANNEL_ID` (the #🌱mowgo-leads channel id — declare in CF Pages env; no incoming webhook).** Message: "🔔 New route audit lead: {name} — {bucket} lawns/wk · ~${monthly}/mo impact · {email}". Rate-limit: existing 5/15min per-IP stands.
- Report email CTA unchanged ("Book your free setup call" → signup).

### 3. Signup → instant touch — NEW `functions/api/lead-touch.js` (CF Pages function)
- POST after successful auth: `{ email }`; verify Bearer token via `/auth/v1/user` (concierge-submit pattern). Rate limit 20/15min per user+IP.
- Lowercase email; insert `lead_touches` rows: instant (source='signup', user_id from token) **PLUS queued day2 + day7 (email-only — signup collects no phone; sms variants only ever exist for route-audit leads with consent)** + fire welcome email via Resend (waitUntil): "Welcome to MowGo — 3 steps to your first scheduled job" + "Want us to set you up? Reply and we'll import your clients (Solo/Crew, 48h)". Without the day2/day7 inserts the nurture cron (§4) has nothing to send for direct signups — the Goal's "every signup gets Day-2/Day-7" would silently not happen.
- **Cross-source rule (rev-1 dedup fix):** if instant already exists for that email (e.g. route-audit first), skip — no additional touches. 23505 on insert → return success (concierge-submit pattern).

### 4. Day-2 / Day-7 nurture — NEW `scripts/lead_nurture.py` + hermes cron (weekdays **9:30am CT — staggered from send_sms.py 9:00 and activation emails 9:15; two SMS senders must not stack in one window**)
- Reads `lead_touches` due by kind/day-offset, status='queued'. Caps: 20/day email, 10/day SMS; `attempt_count`/`last_attempt_at` used so retries don't double-count against caps; max 7 attempts then status='failed'.
- **Day-2 (email + sms-if-approved):** value + honest objection (Efti):
  - "Jobber is $139/mo + $29 per extra crew member. MowGo is $79 flat for crews — whole crew included, no per-user fees. Solo is $39 for single operators." (rev-1 fix: Solo=$39 is single-owner; the crew comparison is $79. ALL figures from Compare.jsx:61-62, verified 08-06.)
- **Day-7 (email + sms-if-approved):** concierge pitch + real scarcity: "We onboard 20 new businesses a week — reply to grab a setup slot." → signup link.
- SMS ≤160 chars; STOP honored (Twilio opt-out; reply poller still TODO post-approval — dependency noted).
- A2P gate: same approval check as send_sms.py — SMS rows stay 'queued', attempt_count++, never dropped.
- Retention: purge rows older than 90 days (no action) — no orphaned PII (signup rows cascade via user_id FK; audit rows purged here).

## Files
- EDIT `client/src/pages/RouteAudit.jsx` (+ i18n en/es incl. first-ever es consent strings)
- EDIT `functions/api/route-audit.js` (phone/consent, lowercase, lead_touches, Discord bot-token alert)
- NEW `functions/api/lead-touch.js` (CF Pages function)
- NEW `supabase/migrations/20260806XXXXXX_lead_touches.sql`
- NEW `scripts/lead_nurture.py` (+ cron registration)
- DOC: this spec

## Constraints
- No native changes in v1. No new npm deps (fetch + Resend pattern only).
- A2P gate is HARD: no SMS before campaign approval — queued only. Email not gated.
- No invented numbers: every claim traceable to Compare.jsx/pricing (verified 08-06).
- RLS: service-role only, zero policies, explicit REVOKE from anon/authenticated.
- Consent text: marketing-only, campaign-scoped, STOP language; English byte-identical to sms-optin; es added in this build.
- Dedup: UNIQUE(lead_email, kind) + lowercase — max 3 touches per email, ever, across both funnels.
- i18n both locales; dark+light; `git diff --check` clean.
- Report: files changed, env vars (DISCORD_BOT_TOKEN reuse + NEW DISCORD_LEADS_CHANNEL_ID), migration summary, deviations.
