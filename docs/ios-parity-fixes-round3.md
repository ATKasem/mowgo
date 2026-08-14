# iOS Parity — Review Round 3 Fixes (final gate findings)

**Status:** 🆕 — Aug 4, 2026
**Why:** Final cumulative review (Codex) found 6 remaining issues (4 HIGH, 2 MEDIUM). Fix all. CI is the compiler (ios-ci.yml). No local builds.

## HIGH

### R3-1. Replayed `lead:create` is non-idempotent → FIFO queue can block permanently (DataStore ~432)
The replay handler decodes the Lead and inserts it. If the original create actually committed server-side but the client saw a network failure (ambiguous outcome), replaying inserts the same UUID again → unique violation → the pending-mutation replay loop throws → FIFO queue permanently blocked behind this mutation.
**Fix:** in the `lead:create` replay case, catch the unique-violation error (or check existence first): `if (try await sb.fetchLead(id:)) != nil { return }` — treat "already exists" as success and continue the queue. Use the same idempotency guard the job/client replay handlers use (check how `job:create`/`client:create` replay handles this; mirror it, or if they lack it, add the existence check only for lead:create — do not expand scope).

### R3-2. `rain.delay.applied` fires even when some job updates only queued offline (DataStore ~1058)
`fullySynced` is checked once before the loop, but `updateJobSchedule` can swallow a network failure and enqueue. The webhook then fires claiming success while server state is unchanged.
**Fix:** track per-job outcomes in the rain delay loop: `synced` (server update succeeded) vs `queued` (enqueued offline). Fire `rain.delay.applied` ONLY when the loop completes with ZERO queued jobs (all server-synced). If any job was queued, skip the webhook (best-effort semantics, consistent with R2-2).

### R3-3. Rain-delay rollback leaves queued target-date mutations → failed delay reapplies later (DataStore ~1069)
On a non-network failure mid-loop, already-moved jobs are rolled back, but their `job:schedule` mutations were already enqueued (if the first updates went offline) — replay later re-applies the delay despite the method reporting failure.
**Fix:** on the rollback path, also DEQUEUE the pending schedule mutations for the rolled-back jobs. Add `Persistence.removePendingMutations(operation: "job:schedule", entityId:)` (and wire the same removal for any operation string used by updateJobSchedule's enqueue). Verify the operation string updateJobSchedule uses when enqueueing, and remove exactly that.

### R3-4. Conversion rollback does not cancel a queued `client:create` → orphan client after replay (DataStore ~1481)
convertLeadToClient: if `createClient` enqueued a `client:create` (network fallback) and a LATER step fails and rolls back by deleting the client server-side, the queued `client:create` replays later and recreates the orphan.
**Fix:** on the conversion rollback path, if the client creation was queued (not synced), remove the queued `client:create` mutation for that client id instead of (or in addition to) deleting server-side. If it was synced, delete server-side (existing behavior). Mirror R3-3's dequeue approach.

## MEDIUM

### R3-5. Network-failed lead deletion still throws after enqueue (DataStore ~1463)
Consistency fix: on network error, after successful enqueue, set `self.error = "Saved offline — will sync when connected"` and RETURN (do not throw) — matching the R2-7 lead:update behavior. Non-network errors rollback + throw as today.

### R3-6. `lead.status.updated` payload missing `client_id` (WebhookService ~94)
The conversion/status webhook omits the linked client; canonical web payload includes it.
**Fix:** include `client_id` (and keep the rest of the payload snake_case + matching the web's `lead.status.updated` payload shape: lead_id, name, status, source, client_id when present).

## Constraints
- Only touch files under `/opt/data/mowgo/ios-native/MowGo/`.
- Follow existing patterns (await actor props, Task<Void,Never>, no context.rollback()).
- Do NOT build locally. CI compiles on push.
- Report: files changed, per-fix notes, compile risks, deviations.
