# MowGo Concierge Fix — schedule only imported clients

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement directly, immediately, in one pass. Do NOT run builds. Do NOT git commit or push.

Repo root: /opt/data/mowgo. Two files.

## Problem
The admin "Schedule first week" action currently schedules EVERY client belonging to the request's user, not just the clients created by the import — and pressing it twice creates duplicate jobs.

## Fix 1 — `functions/api/admin/concierge.js`
In the `schedule` action (currently loads `clients` via `.../clients?select=id,name,address&user_id=eq.${item.user_id}`):
- Accept an OPTIONAL `client_ids` array in the body. Validate: if present, it must be a non-empty array of UUIDs (use the existing `UUID_RE`; return 400 `{error:'Valid client_ids are required'}` otherwise).
- If `client_ids` present: filter the fetched clients to only those whose `id` is in the set (`clients.filter(c => clientIds.includes(c.id))`). If absent: keep current behavior (all clients) for backwards compatibility.
- Add a duplicate guard: before creating jobs, fetch existing jobs for the user with `status=in.(scheduled,in_progress)` and `scheduled_date=gte.<today ISO date>` (`/rest/v1/jobs?select=client_id&user_id=eq.<uid>&status=in.(scheduled,in_progress)&scheduled_date=gte.<YYYY-MM-DD>`), build a Set of client_ids, and skip those clients when creating jobs. If ALL clients are skipped, return `{jobs: [], skipped: <count>}` (200).

## Fix 2 — `client/src/pages/AdminConcierge.jsx`
- Keep the created client ids from the import response in the per-request state (the import response already returns `{ created, clients: [{id,...}], skipped }` — store the ids: e.g. `state.import.clientIds = result.clients.map(c => c.id)`).
- When calling the schedule action, pass `{ action: 'schedule', request_id: item.id, client_ids: state.import?.clientIds || [] }` (look at how `run(item, 'schedule')` builds the body and extend it — if `clientIds` is empty, omit `client_ids` so the function keeps working).
- After a successful schedule, disable the "Schedule first week" button for that request (add a per-item flag, e.g. `state.scheduled` set on success; button `disabled` when set; "Undo schedule" already appears and resets it on success).

## Done criteria
Exactly these two files changed. No builds, no commits, no pushes.
