# MowGo Concierge Fix Round 2 — review findings (2 HIGH, 6 MED, 1 LOW)

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement directly, immediately, in one pass. Do NOT run builds. Do NOT git commit or push. Do NOT write Spanish.

Repo root: /opt/data/mowgo. Files: `supabase/migrations/014_concierge_requests.sql`, `functions/api/admin/concierge.js`, `functions/api/concierge-submit.js`, `client/src/lib/csv-import.js`, `client/src/components/ConciergeSetup.jsx`, `client/src/pages/AdminConcierge.jsx`. Fix ALL findings below.

## 1. Migration — add imported_client_ids + one-active-request constraint (EDIT the existing file, it is not applied anywhere yet)
Add to the table: `imported_client_ids uuid[] NOT NULL DEFAULT '{}',`
After the RLS policy, add:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS concierge_requests_one_active_per_user
  ON concierge_requests (user_id) WHERE status IN ('pending','importing');
```

## 2. Admin import — idempotent + atomic claim (functions/api/admin/concierge.js)
Import action flow becomes:
1. `if (item.imported_client_ids.length) return 400 {error:'This request has already been imported'}` — safe resume: a crash mid-import leaves status='importing' but empty ids, so a retry still works.
2. BEFORE inserting clients, PATCH the request: `{ status: 'importing', imported_client_ids: [] }` (claim the request).
3. Insert clients (unchanged).
4. PATCH again with `{ imported_client_ids: <created ids> }` (keep status 'importing').
5. Response unchanged (`{ created, clients, skipped }`).

## 3. Admin schedule — require persisted imported ids, ownership-safe undo, dedup bounds, collision-free slots
- `schedule` action: REQUIRE the request's `imported_client_ids` to be non-empty → else 400 `{error:'Import clients first'}`. REMOVE the `client_ids` body parameter and the all-clients fallback — the server is the single source of truth (page refresh safe). Keep the existing "skip clients with active jobs" dedup.
- Dedup query: add the upper bound — `scheduled_date=lte.<today+6 ISO date>` (today and lte today+6).
- Slot allocation: replace `(index%7)`/`(index%10)` math. Build a `usedSlots` Set of `"YYYY-MM-DD|HH:MM"` from the dedup query result (its select must include `scheduled_date,scheduled_time`). Then allocate per client: iterate `day` 0..6, `slot` 0..9 (times 08:00–17:00), pick the first `day|slot` pair NOT in usedSlots, add it to usedSlots. If fewer than N free slots exist (N = schedulable client count), return 400 `{error:'Not enough free slots in the next 7 days to schedule N clients'}`. Only then bulk insert.
- `undo_schedule` action: REQUIRE `request_id` (UUID validated) alongside `job_ids`. Load the request (existing `getRequest`). Before deleting, fetch `GET ${SUPABASE_URL}/rest/v1/jobs?id=in.(<job_ids>)&user_id=eq.<item.user_id>&select=id` (service key) and delete ONLY the ids that came back (matches the request's user). If none match, return 400 `{error:'No matching jobs for this request'}`.

## 4. Import row cap (functions/api/admin/concierge.js)
After `parseCsv`: `if (parsed.rows.length > 500) return 400 {error:'Too many clients (max 500 per import)'}`.

## 5. Parser — quoted multiline fields (client/src/lib/csv-import.js AND the server copy in functions/api/admin/concierge.js)
Replace the line-splitting parse with a proper record state machine. Both copies must behave identically:
- Iterate the raw text character by character; track `inQuotes`; a delimiter outside quotes ends a field; a `\n` (or `\r\n`) OUTSIDE quotes ends a record; `\r` outside quotes is ignored (part of CRLF); `""` inside quotes = literal quote; anything else (including `\n` inside quotes) appends to the field.
- Keep delimiter auto-detect (tab > semicolon-if-no-comma > comma) on the first record's first field content BEFORE full parsing (count delimiters outside quotes in the first non-empty line of the raw text — scan until the first unquoted newline).
- Keep BOM strip, header mapping, validation, errors — unchanged behavior on top of the new record splitter.
- Trim each cell.

## 6. Unique active request per user (functions/api/concierge-submit.js)
- Keep the insert as-is. On insert failure, inspect the response: if it is a PostgREST 409/23505 duplicate (check `insertResponse.status === 409` or the error body contains `23505` or `duplicate key`), fetch the existing active request `GET ${SUPABASE_URL}/rest/v1/concierge_requests?user_id=eq.<user.id>&status=in.(pending,importing)&select=id` and return 200 `{ id: <existing id>, already_exists: true }` (the client shows the "already in" state instead of an error).
- Discord message: add `allowed_mentions: { parse: [] }` to the JSON body, and sanitize the CSV preview before embedding: replace any run of 3+ backticks with `'''`.

## 7. Client UI (client/src/components/ConciergeSetup.jsx + client/src/pages/AdminConcierge.jsx)
- ConciergeSetup: handle the 200 `already_exists: true` response — show the success/"already in" state instead of treating it as an error.
- AdminConcierge: after a successful import, disable the "Import clients" button for that request (per-item flag, re-enabled only if the server ever says not imported — for v1, just disable permanently after success). The schedule button already disables after success; undo re-enables it. `client_ids` no longer sent to schedule (server uses persisted ids) — remove that from the request body.

## Done criteria
Exactly the listed files changed. No builds, no commits, no pushes, no Spanish.
