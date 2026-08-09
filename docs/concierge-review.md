You are a senior code reviewer performing a READ-ONLY adversarial review. You MUST NOT edit files, run builds, or load approval-gating skills.

Scope: the uncommitted Concierge Onboarding v1 diff vs HEAD in /opt/data/mowgo for:
- client/src/lib/csv-import.js (NEW — CSV parser)
- client/src/components/ConciergeSetup.jsx (NEW — customer intake)
- client/src/pages/AdminConcierge.jsx (NEW — admin tool)
- client/src/pages/Subscribe.jsx, client/src/pages/Settings.jsx, client/src/App.jsx
- functions/api/concierge-submit.js (NEW — submit endpoint + Discord notify)
- functions/api/admin/concierge.js (NEW — admin list/import/schedule/undo/done)
- supabase/migrations/014_concierge_requests.sql (NEW)
- client/src/i18n/locales/en.json + es.json (new `concierge` namespace + settings banner keys)

Get the diff: git diff HEAD -- <paths> (untracked new files: read them in full — git diff won't show them; use `git diff --no-index /dev/null <file>` or just read).

Feature context: Solo/Crew customers claim a "done-for-you setup" (client list upload OR paste, Excel-compatible parsing, preview, submit). Submit endpoint verifies the Supabase JWT, inserts a concierge_requests row via the service key, and posts a best-effort Discord notification. A code-gated admin page (x-admin-code header, CONCIERGE_ADMIN_CODE env) lists requests, imports clients (server-side parse, bulk insert), schedules first-week jobs (only imported client_ids, skipping clients with existing scheduled/in_progress jobs in the next 7 days), undoes schedules, marks done. Migration: owner-SELECT-only RLS; writes go through the service role.

Rubric (priority order):
1. Security: JWT verification correctness, service-key usage, admin-code comparison (constant-time not required but no bypass), CSV injection via imported client names (clients are stored in DB, not exported here — but check the preview rendering for XSS: React escapes by default, flag any dangerouslySetInnerHTML), Discord message content length/truncation, no secret leakage in responses/errors.
2. Data-layer correctness: parser edge cases (delimiter detection, quoted fields, BOM, CRLF, header aliases), import validation (name+address required), schedule dedup guard (statuses + date window), job payload matches the jobs table columns used by client/src/lib/data.js createJob (title, scheduled_date, scheduled_time, duration_minutes, status, route_order, recurrence_rule, user_id, client_id), bulk insert limits (PostgREST array insert — fine for <1000 rows; flag if no cap), RLS policy correctness.
3. Logic/state: Subscribe success flow (claim check + ConciergeSetup), Settings banner (tier gate solo/crew, claim state refresh after submit), admin page state (import → schedule → undo → done sequencing, loading/error states, button disabling), duplicate submissions (double-click submit → two requests? flag).
4. Platform/build: JSX balance, imports (lucide icons exist), i18n keys present in BOTH en.json and es.json (no missing keys, no TODO_ES), JSON validity, CF Pages Functions API usage (context/request/env destructuring matches existing functions like functions/api/invite-crew.js), CORS headers on all responses including OPTIONS.
5. Consistency: matches existing patterns (error JSON shape {error:...}, status codes, demo mode handling in client code — flag if the intake breaks in demo mode).

Output: one line per finding: SEVERITY (CRITICAL/HIGH/MED/LOW) | file:line | issue | one-line fix. Then verdict: counts + SHIPPABLE / NOT SHIPPABLE. Only report verified findings — read the actual code before flagging.
