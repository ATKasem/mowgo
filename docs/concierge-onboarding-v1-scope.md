# MowGo Concierge Onboarding v1 — Scope

Status: IMPLEMENTED. Purpose: define the machinery behind the paid-plan promise to import clients and prepare the first operating week within 48 hours.

## What the offer promises (landing copy, live)
- On eligible paid plans, we import the customer's client list and prepare their first operating week within 48 hours.
- No numeric weekly-cap claim is published or enforced.

## Reality check (what "we" means operationally)
The concierge service is executed by Aaron (and agent-assisted tooling), not by software alone. Software's job:
1. **Intake** — capture the request + the client list in a structured way.
2. **Import** — turn their client list into MowGo clients (and optionally first-week jobs) with minimal manual data entry.
3. **Tracking** — a queue so request status and the 48h turnaround are visible.
4. **Communication** — confirmation + done notifications.

## v1 scope (small, no new infrastructure)

### A. Concierge request flow (web, after Solo checkout OR from landing Solo card)
- The Solo card CTA ("Start Free Trial") stays. AFTER a successful Solo subscription (Subscribe.jsx success state), show a "Get your free setup" step:
  - Copy: "Your done-for-you setup is included. Tell us about your business and we'll import your clients within 48 hours."
  - Form: business name (prefilled from profile), client count, and BOTH intake options presented side by side (user picks either):
    1. **Upload** — file input accepting `.csv` and `.txt` (drag-drop + browse).
    2. **Paste** — a textarea where they paste CSV or copy-pasted spreadsheet cells (Excel copy-paste of a range is TAB-separated — the parser must handle tabs).
  - Submit → creates a `concierge_requests` row (see C) + sends an email to the MowGo inbox (mowgo.app@gmail.com) and a Discord ping to #🌱mowgo (agent channel) with the parsed client list.
  - Also reachable later: Settings → "Free setup included" banner for Solo/Crew users who haven't claimed it (check `concierge_requests` for user_id).

### B. CSV parsing requirements (Excel-compatible, lenient)
Shared parser used for BOTH upload and paste (one function, two input sources):
- Auto-detect delimiter among comma `,`, semicolon `;`, and TAB (count occurrences in the first non-empty line, outside quotes; semicolon wins when comma count is 0 — covers German/European Excel exports).
- Strip UTF-8 BOM; handle CRLF and LF line endings.
- Respect quoted fields: `"field, with comma"`, escaped quotes `""` inside quoted fields.
- **Header mapping:** if the first row looks like a header (any cell matches known aliases: name/client name/customer name, address, phone, email, rate/price/amount), map columns by name (case-insensitive); unknown columns are ignored. If no header match (raw paste), assume column order: name, address, phone, email, rate.
- Validation: name + address required per row; phone optional (format: US digits, lenient); rate numeric-or-empty. Rows with missing name+address are reported per-row in an import preview, not silently dropped.
- Preview step: after parse, show a table preview (first 5 rows + total count + per-row errors) before the request is submitted — the customer confirms what they're sending.
- NOT in v1: `.xlsx` files (needs a parsing dependency; CSV covers Excel "Save As CSV" and copy-paste, which is what real operators use). Revisit if it becomes a complaint.

### C. Import tool (web, agent/admin side)
- Agent-facing page (route `/admin/concierge` protected by both the admin code and a valid Supabase session whose user ID is in `CONCIERGE_ADMIN_USER_IDS`; the code is kept in memory only) that:
  - Lists pending requests (oldest first), shows 48h deadline.
  - "Import clients" button per request → parses the pasted/uploaded CSV → creates clients under the user's account via the existing `createClient` path (bulk insert via supabase insert with user_id) → shows per-row errors (bad phone, missing address) for manual fix.
  - "Schedule first week" helper: for imported clients, auto-create the first job (today + next 6 days, one per client, staggered times) using the existing job creation pattern — with an "undo" (delete created jobs) in case of mistakes.
  - Mark request "done" → sends confirmation email to the customer.

### C. Data model (migration `014_concierge_requests.sql`)
- Table `concierge_requests`: id uuid PK, user_id uuid FK profiles, business_name text, client_count int, csv_content text (the parsed/raw pasted content), csv_attachment_url text (nullable, storage bucket `concierge-csv` for the uploaded file), status text ('pending'/'importing'/'done'/'skipped'), claimed_at timestamptz, done_at timestamptz, notes text.
- RLS: owner-only read/write on their own row (like leads), public insert NOT needed (form runs authenticated — the user is logged in after checkout). Insert via authenticated path.
- Storage bucket `concierge-csv` (private) for the uploaded file, stored alongside the parsed content so the agent can diff against the original.

### D. Notifications
- On submit: email to mowgo.app@gmail.com with the pasted CSV + business info; Discord webhook to #🌱mowgo (the agent channel) with a compact summary. (Both exist already: Gmail SMTP + Discord webhook patterns are in place.)
- On done: email to the customer ("Your MowGo setup is ready — 12 clients imported, first jobs scheduled").

## Explicitly NOT in v1
- Auto-import into iOS/Android (import happens on web; data syncs to native apps automatically via Supabase).
- Scheduling intelligence (recurring rules, route optimization) — first week is simple one-off jobs.
- Self-serve CSV import for ALL users (that's a separate feature — this is concierge-only; a general Settings → Import CSV can be a v1.1 follow-up and would reuse the same parser).
- Any AI involvement (per product rule).
- Localization of the internal `/admin/concierge` operator console. The customer status surface is localized in English and Spanish; the restricted operator console is intentionally English-only in v1.

## Success criteria
- A Solo customer can claim the setup in under 2 minutes; the request lands in the agent inbox; import of 20 clients takes under 15 minutes of agent time; customer gets confirmation.
- The paid-plan gate, request queue, import flow, and first-week scheduling helper are implemented; there is no enforced numeric weekly cap.

## Open questions for Aaron (RESOLVED Aug 4, 2026)
1. Paste-only vs CSV upload for v1? → **BOTH, side by side** (upload .csv/.txt OR paste; parser shared, Excel-compatible, tab-aware).
2. First-week auto-schedule start date? → **Import date, next 7 days, staggered times**, with Undo.
3. Admin route protection? → **Layered operator auth** (`CONCIERGE_ADMIN_CODE` plus a valid Supabase session allowlisted by `CONCIERGE_ADMIN_USER_IDS`; the page keeps the code in memory only, and every mutation stores the operator user ID).
