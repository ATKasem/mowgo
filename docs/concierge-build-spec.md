# MowGo Concierge Onboarding v1 — BUILD SPEC

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement the spec below directly, immediately, in one pass. Do NOT run builds or compilers. Do NOT git commit or push. For es.json add new keys with the literal value `TODO_ES` — the coordinator translates after you finish. Do NOT write real Spanish.

Repo root: /opt/data/mowgo. Scope: web app (`client/`) + one CF Pages Function + one migration. Read `docs/concierge-onboarding-v1-scope.md` first for product context. Follow existing patterns: `client/src/lib/data.js` (Supabase + demo patterns), `client/src/lib/csv.js` (export CSV helper — do NOT modify it), `functions/api/invite-crew.js` (Bearer-token auth + service-key REST pattern), `functions/api/booking.js` (validation style), public-page pattern in `App.jsx` (routes above `RequireAuth`).

## 1. Migration — `supabase/migrations/014_concierge_requests.sql`
```sql
CREATE TABLE IF NOT EXISTS concierge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  business_name text NOT NULL,
  client_count int,
  csv_content text,
  csv_attachment_url text,
  status text NOT NULL DEFAULT 'pending',   -- pending | importing | done | skipped
  claimed_at timestamptz,
  done_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE concierge_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Concierge: owner select own" ON concierge_requests;
CREATE POLICY "Concierge: owner select own" ON concierge_requests
  FOR SELECT USING (auth.uid() = user_id);
```
Service role (used by the CF functions) bypasses RLS — no other policies needed. Users can only READ their own request (the claim check + banner); writes go through the admin function.

## 2. CSV parser — NEW `client/src/lib/csv-import.js`
`export function parseClientCsv(text)` returning `{ rows, errors }`:
- `rows`: array of `{ name, address, phone, email, rate }` (rate as string; empty string when absent).
- `errors`: array of `{ row: <1-based line number>, message }` for rows missing name OR address. Valid rows keep going; invalid rows are skipped from `rows` but reported.
- Delimiter auto-detect on the first non-empty line, counting occurrences OUTSIDE quoted fields: tab `\t` if it appears; else semicolon `;` if it appears and comma count is 0; else comma.
- Strip UTF-8 BOM; split on `\r\n` and `\n`; handle quoted fields (`"a,b"`), escaped quotes (`""` inside quotes).
- Header mapping: if ANY cell in the first row matches (case-insensitive, trimmed) one of the aliases below, treat row 1 as header and map columns by name; otherwise assume column order name, address, phone, email, rate.
  - name: name, client name, client_name, customer name, customer, client
  - address: address, street, location
  - phone: phone, phone number, phone_number, mobile, cell
  - email: email, e-mail, email address
  - rate: rate, price, amount, cost, mow price
- Unknown/extra columns are ignored. Empty lines are skipped.

## 3. Customer intake — NEW `client/src/components/ConciergeSetup.jsx`
- `useLocalizedText('concierge')` i18n. Uses `useAuth()` for the token (same as other pages).
- Layout: card with heading "Your done-for-you setup is included", copy "Tell us about your business and we'll import your clients within 48 hours."
- Business name field (prefilled from the logged-in profile if available — check how Settings.jsx loads profile; if easy, reuse `loadProfile()`; otherwise leave blank).
- Client count number field (optional).
- TWO intake methods side by side (tabs or two cards — pick whichever matches the design system):
  1. **Upload**: file input `accept=".csv,.txt"` (drag-drop + browse). Read via `FileReader` as text.
  2. **Paste**: textarea placeholder "Paste your client list (from Excel or CSV)".
- On parse: show preview — total valid rows, first 5 rows in a small table (name/address/phone/email/rate), and any per-row errors in red. Parse happens live on file select/paste (or on a "Preview" button — live is better; debounce the textarea 400ms).
- Submit button disabled until ≥1 valid row and business name is non-empty. On submit: `POST /api/concierge-submit` with `{ business_name, client_count, csv_content: <raw text> }` and `Authorization: Bearer <supabase access token>`. Show loading state, then success state ("Request received — we'll set you up within 48 hours.").
- Error state: show the API error message.
- Props: `onDone` callback (to tell Subscribe/Settings to refresh the claim state), `defaultOpen` not needed.

## 4. Post-checkout wiring — `client/src/pages/Subscribe.jsx`
In the `status === 'success'` branch, below the existing "You're all set!" card: fetch whether a request exists (`supabase.from('concierge_requests').select('id').eq('user_id', user.id).maybeSingle()`) — if none, render `<ConciergeSetup />` in a card below. If one exists, show a small line "Your setup request is in — we'll be in touch within 48 hours." Use `useLocalizedText('concierge')` keys.

## 5. Settings banner — `client/src/pages/Settings.jsx`
In the Business Profile card area (or right below it, matching card styles): if `profile.tier` is `'solo'` or `'crew'` AND no `concierge_requests` row exists for the user (check on load, same query as #4), show a banner card: "Free setup included: we'll import your clients and pre-schedule your first 30 days." + button "Claim it" that expands/renders `<ConciergeSetup />` inline (or navigates — inline section is fine). After `onDone`, hide the banner. Skip in demo mode.

## 6. Submit endpoint — NEW `functions/api/concierge-submit.js` (repo-root `functions/`)
- `onRequestPost`: parse JSON body; require `business_name` (non-empty, ≤200 chars) and `csv_content` (non-empty, ≤100_000 chars). `client_count` optional integer.
- Auth: `Authorization: Bearer <token>` → verify with the SAME pattern as `functions/api/invite-crew.js` (fetch `${SUPABASE_URL}/auth/v1/user` with the token; 401 `{"error":"Invalid token"}` on failure; CORS headers on all responses incl. OPTIONS).
- Insert: `POST ${SUPABASE_URL}/rest/v1/concierge_requests` with headers `apikey: SUPABASE_SERVICE_ROLE_KEY`, `Authorization: Bearer <service key>`, `Content-Type: application/json`, body `{ user_id: <verified user id>, business_name, client_count, csv_content, status: 'pending' }`, `Prefer: return=representation`. Return `{ id }` 201.
- Discord notification (BEST-EFFORT — never fail the request because Discord is down; wrap in try/catch): `POST https://discord.com/api/v10/channels/<DISCORD_CHANNEL_ID>/messages` with `Authorization: Bot <DISCORD_BOT_TOKEN>`, body `{ content: "🧹 New concierge request\n**Business:** <name>\n**Clients:** <count>\n**User:** <user_id>\n**At:** <ISO time>\n```<csv_content truncated to 1500 chars>```" }`. Content must be < 2000 chars total — truncate the code block accordingly.
- Env vars (do NOT hardcode): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`. Return 500 `{"error":"Server misconfigured"}` if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` missing (mirror the existing functions' env-check style).

## 7. Admin tool — NEW `functions/api/admin/concierge.js` + NEW `client/src/pages/AdminConcierge.jsx`
### Function (repo-root `functions/`)
- Every request requires header `x-admin-code` === env `CONCIERGE_ADMIN_CODE` → else 401 `{"error":"Unauthorized"}`. CORS on all responses incl. OPTIONS.
- `GET ?action=list` → `GET ${SUPABASE_URL}/rest/v1/concierge_requests?select=*&order=created_at.asc` with service key → `{ requests }`.
- `POST` body `{ action: 'import', request_id }`: load the request; parse `csv_content` with a SERVER-SIDE copy of the parser rules (delimiter auto-detect comma/semicolon/tab, BOM strip, CRLF, quoted fields, header aliases — same behavior as the client parser; write it inline in the function, ~60 lines); validate name+address; bulk insert clients: `POST ${SUPABASE_URL}/rest/v1/clients` with array of `{ user_id: <request.user_id>, name, address, phone, email, rate }` (omit null/empty fields; rate: parse float or omit) and `Prefer: return=representation`; set request status → 'importing' (PATCH `{ status: 'importing' }`). Return `{ created: <client count>, clients: [{id, name, address}] }` plus `{ skipped: [{row, message}] }` for invalid rows.
- `POST` body `{ action: 'schedule', request_id }`: load the request; fetch its clients (`GET /rest/v1/clients?select=id,name,address&user_id=eq.<request.user_id>`); create one job per client over the next 7 calendar days starting today, staggered times 08:00–17:00 (rotate: `(index % 10)` slots, one client per slot per day; if clients > 10, continue same times on the next days — keep it simple, one job per client, `scheduled_date` = today + (i % 7) days, `scheduled_time` = `08:00` + (i % 10) * 60min formatted HH:MM, `status: 'scheduled'`, `user_id: <request.user_id>`; check the jobs table columns in `client/src/lib/data.js` createJob and match them). Bulk insert via `POST /rest/v1/jobs` array + `Prefer: return=representation`. Return `{ jobs: [{id, scheduled_date, scheduled_time}] }`.
- `POST` body `{ action: 'undo_schedule', job_ids: [] }` → delete those job ids via service key (`DELETE /rest/v1/jobs?id=in.(...)` — build the `in` list; if empty, 400).
- `POST` body `{ action: 'done', request_id }` → PATCH `{ status: 'done', done_at: <ISO now> }`. Return `{ success: true }`.
### Page (`AdminConcierge.jsx`, route `/admin/concierge` in App.jsx public routes — NO nav link, NO i18n needed, English literals)
- If no `conciergeAdminCode` in sessionStorage: code entry screen (password input + "Enter"). Store code in sessionStorage. (Server re-checks on every call — this is UX only.)
- Main screen: "Concierge queue" — list of requests (oldest first) from `GET /api/admin/concierge?action=list` with `x-admin-code` header: business name, client count, status badge, created time, and for pending ones a 48h deadline indicator (red if overdue).
- Per request actions:
  - "Preview" — shows parsed rows client-side (reuse the csv-import parser on csv_content) in a table (cap 50 rows shown).
  - "Import clients" → POST action=import → shows created count + skipped errors.
  - "Schedule first week" (enabled after import) → POST action=schedule → shows created job count; "Undo schedule" button appears → POST action=undo_schedule with the returned job ids.
  - "Mark done" → POST action=done → status badge updates.
- Loading states per action; errors shown inline.

## 8. App.jsx route + i18n
- Add `AdminConcierge` route `/admin/concierge` in the public routes block (above `RequireAuth`), same pattern as other public pages.
- i18n: new `concierge` namespace in `en.json` + `es.json` (es = `TODO_ES`): all customer-facing strings in ConciergeSetup + Subscribe success line + Settings banner. Admin page = English literals, no i18n. Follow the existing key convention (snake_case of the English text).

## Done criteria
- Files created/changed: migration, csv-import.js, ConciergeSetup.jsx, Subscribe.jsx, Settings.jsx, AdminConcierge.jsx, App.jsx, functions/api/concierge-submit.js, functions/api/admin/concierge.js, en.json, es.json.
- No builds, no commits, no pushes, no real Spanish. Existing code untouched except the listed files.
