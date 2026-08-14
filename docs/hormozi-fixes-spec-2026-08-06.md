# Hormozi Fixes Batch 1 — Implementation Spec (2026-08-06)

Source: hormozi-product-audit-2026-08-06.md findings #2, #3, #4, #5, #6, #9, #10.
Implement EXACTLY this scope. Do NOT touch anything else (no referral program, no premium priority queue, no routing/route changes, no mobile apps).

## Conventions (from AGENTS.md / CLAUDE.md — MUST follow)
- RLS is the authz boundary; client-side checks are UX only.
- Logging best-effort bounded: `Promise.race([fetch, timeout(4s)])` + swallow errors — never fail a Stripe webhook over logging/email.
- No secrets in code or git. Env names only: `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (server/.env) / `SUPABASE_SERVICE_ROLE_KEY` (CF dashboard).
- Verify before claiming: `node --check` every touched .js function file; `npm run build` in client/ must pass.
- Migrations: new files in supabase/migrations/ (next numbers after 023: use 024_*.sql, 025_*.sql). Do NOT run them — Blasian applies via `npx supabase db query --linked --file <migration>`.

---

## A. CLIENT (client/src)

### A1. OnboardingChecklist (fix #2)
New component `client/src/components/OnboardingChecklist.jsx` + wire into `client/src/pages/Dashboard.jsx` (render above the stats when unactivated).

Behavior:
- "Unactivated" = user has 0 clients AND 0 jobs (query counts via existing supabase client, cheap `.count()` queries on clients + jobs tables for the user's business).
- Card titled "Start in 3 steps" with 3 checklist rows, each a deep link:
  1. "Add your first client" → link to /app/clients (use existing router Link; verify actual route from App.jsx nav)
  2. "Schedule your first job" → /app/today
  3. "Mark a job complete" → /app/today
- Rows get a green check when the underlying count is > 0 (re-query on mount + after 5s once).
- If tier is solo/crew/premium (profile.tier), show a 4th row: "Get set up for you — free concierge" linking to the existing Concierge setup location (Settings page section — find how ConciergeSetup is opened and reuse; `Settings.jsx:330-336`).
- Dismissible ("Maybe later") → localStorage `mf_onboarding_dismissed=1`; auto-hidden entirely once activated (both counts > 0).
- i18n: add English strings to `client/src/i18n/en.json` (and any other locale files with the same pattern — check how other components add strings; if other locales exist, add English only and follow the file's fallback pattern).
- Match existing design system (dark mode classes used across Dashboard, brand green #22c55e accents, rounded-2xl cards).

### A2. Upgrade modal on free-tier cap (fix #4)
- `client/src/lib/data.js:538-546` throws when free tier hits 5 clients. The throw propagates to the caller in Clients.jsx (find where createClient is called — likely `Clients.jsx`). Instead of a raw alert/error, catch the specific cap error in the Clients page and show an upgrade modal:
- New state in Clients.jsx: `upgradeOpen`. On the cap error → open modal.
- Modal: "You've hit the free limit (5 clients)" + one line "Unlimited clients, recurring jobs and offline mode start at $39/mo." + buttons: "See plans" (→ /subscribe route — verify existing route) + "Not now" (close).
- Do not change data.js behavior. Only surface the modal.
- i18n strings in en.json.

### A3. Fact-locks (fix #10) — client/src/pages/Landing.jsx
1. Compare table header cell `Jobber Connect $139/mo` → `Jobber Grow $139/mo` (label only; the $139 is Grow 1-user + $29/user, verified 2026-08-06).
2. Stats block: `<1% of your revenue` suffix `Solo costs less than one missed job.` → append math: `Solo is $39/mo — under 1% for any crew billing over $3,900/mo.`
3. FAQ: find where the 14-day trial / 30-day guarantee are described; make the trial wording explicit: `14-day free trial. 30-day money-back guarantee.` (both numbers true — trial 14 days in code, guarantee 30 days). Do not change the guarantee section text (Landing.jsx:463) itself.

## B. FUNCTIONS (functions/api)

### B1. Cancellation win-back + downsell email (fixes #5, #6 part 1) — functions/api/stripe/webhook.js
In the `customer.subscription.deleted` handler (currently sets tier='free'):
1. Read the user's tier BEFORE setting free (fetch profile first — the PRE-STATE, same ordering bug pattern documented in the repo: read pre-state BEFORE patch).
2. Set `profiles.cancelled_at = now` along with tier='free'.
3. If pre-state tier was 'crew' or 'solo' (i.e. a real paid cancel, not a stray event): fire win-back email #1 via Resend (async, bounded, never fail the webhook):
   - Crew pre-state → downsell framing: subject `Don't lose your crew setup — Solo keeps you running at $39/mo` / body: "You cancelled Crew. Before you go: everything you used in Crew still works on Solo ($39/mo, no per-user fees). Your data stays. Switch in one click: {APP_URL}/subscribe" (honest — Solo has the features; do NOT claim crew-only features work on Solo).
   - Solo pre-state → win-back framing: subject `We made it easy to come back` / body: "Your data is still here. Re-activate anytime in one click: {APP_URL}/subscribe. 30-day money-back guarantee still applies."
   - Premium pre-state → same as solo win-back subject `Your premium setup is waiting`.
4. Send via Resend API (POST https://api.resend.com/emails, Authorization Bearer RESEND_API_KEY — env name in CF dashboard; server/.env has RESEND_API_KEY). Use a verified sender from the existing Resend domain used by route-audit.js (check functions/api/route-audit.js for the sender email and reuse it).
5. Follow the repo's bounded best-effort pattern (Promise.race timeout 4s, catch+swallow, comment why).
6. Add `cancelled_at` column usage — see migration C2.

### B2. No other function changes. (Activation emails = cron script, see C3.)

## C. SUPABASE MIGRATIONS (create files; DO NOT run)

### C1. supabase/migrations/024_free_client_cap.sql
Server-side enforcement of the free-tier 5-client cap:
- SECURITY DEFINER trigger function `enforce_free_client_limit()`: on INSERT into clients — look up the owner's profile tier by `business_id` (verify the clients table's owner/business column name from 001_initial_schema.sql or later migrations); if tier='free' and count of clients for that business >= 5 → `RAISE EXCEPTION 'Free plan is limited to 5 clients'`.
- BEFORE INSERT trigger on clients.
- Must not break onboarding flows (free users are allowed up to 5).
- Note: check how clients are linked to businesses (owner_id vs business_id) and use the correct join; cite the schema in a comment.

### C2. supabase/migrations/025_activation_timestamps.sql
- ALTER TABLE profiles ADD COLUMN first_client_at timestamptz, first_job_at timestamptz, first_invoice_at timestamptz (NULL default).
- Three SECURITY DEFINER trigger functions (set if NULL on first insert):
  - on clients insert → set profiles.first_client_at = now() (owner/business lookup as in C1)
  - on jobs insert → first_job_at
  - on invoices insert → first_invoice_at
- BEFORE INSERT triggers. Comment: powers activation analytics (Hormozi audit #9).

## D. ACTIVATION EMAILS — cron script (fix #3) — /opt/data/.hermes/scripts/mowgo_activation_emails.py
Follow the EXACT pattern of the existing /opt/data/.hermes/scripts/mowgo_churn_report.py (read it first: how it reads keys, how it queries Supabase, output format, silent-when-nothing pattern). This script is NEW — do not modify the churn script.
- Reads SUPABASE_URL + SUPABASE_SERVICE_KEY (server/.env names) + RESEND_API_KEY (server/.env) the same way the churn script does.
- Day-0 email: profiles created_at within [now-26h, now-2h] AND still unactivated (no clients) → send welcome + "add your first client in 2 minutes" + concierge mention (tier-aware) — sender same as route-audit.
- Day-3 email: created_at in [3d-26h, 3d-2h], still no clients → nudge + link.
- Day-7 email: created_at in [7d-26h, 7d-2h], still no clients → "we'll set it up for you (free concierge)" + subscribe link.
- Win-back #2: profiles where cancelled_at in [7d-26h, 7d-2h] AND tier='free' AND no tier_events row for that user with created_at > cancelled_at (no re-subscribe) → "come back" email.
- Dedupe: track sent in a local state file (e.g. /opt/data/.hermes/scripts/state/activation_sent.json — create dir) keyed by user_id+day so re-runs don't double-send.
- Print summary ONLY when it sent something (silent otherwise). English only.

## E. VERIFICATION (must all pass before you say done)
- `node --check` on every touched functions file.
- `npm run build` in /opt/data/mowgo/client.
- `python3 -m py_compile` on the new cron script.
- Report: list of files created/modified with a 1-line description each; verification outputs; anything you could NOT complete and why.
