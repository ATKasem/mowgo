# iOS Parity — Review Round 4 Fixes (confirmation pass)

**Status:** 🆕 — Aug 4, 2026
**Why:** Round-4 confirmation review (Codex) of the round-3 delta found 3 HIGH + 1 MEDIUM, all in the new rollback/removal code. Mimo's cumulative review also flagged 2 small items. Fix all listed. CI is the compiler. No local builds.

## HIGH

### R4-1. Removal helper predicate omits userId (`MowGo/Services/Persistence.swift` ~178)
The new `removePendingMutations` helper filters only by operation + entityId. A rollback for user A can delete user B's queued mutation for the same shared entity id (jobs/clients ids are UUIDs, not user-scoped).
**Fix:** add `userId == currentUserId` to the predicate (mirror `loadPendingMutations` which already scopes by userId). Signature must accept the userId (or read it the same way loadPendingMutations does from the caller).

### R4-2. Rollback removes ALL queued job:schedule mutations for the job, including pre-rain-delay edits (DataStore ~1074)
If the owner manually rescheduled a job offline earlier (queued `job:schedule` with their own target date), then a rain delay for that job fails and rolls back, the current removal deletes BOTH mutations — silently discarding the earlier offline edit.
**Fix:** only remove the rain-delay's own queued mutations: filter the pending mutations by payload — remove `job:schedule` entries for the job whose decoded payload `scheduledDate` equals the rain delay's target date (the value this rain delay enqueued). Preserve any mutations with different target dates. If the Persistence helper needs a payload filter, extend it with an optional `payloadMatches: (Data) -> Bool` closure parameter; default nil = no payload filter.

### R4-3. Conversion rollback swallows server-side client deletion failure (DataStore ~1499)
On convert failure rollback, `deleteClientOnServer` failure is ignored — orphan server client remains while the local client is removed, leaving inconsistent state.
**Fix:** check the delete result; on failure, set `self.error` with a clear message ("Converted client cleanup failed — delete client manually") and do NOT remove the local client (keep local consistent with server). Non-failure path unchanged.

## MEDIUM

### R4-4. `clear()` doesn't persist empty rain history (DataStore ~347) — Mimo M2
Sign-out clears the in-memory array but UserDefaults still holds the old entries under the user's key.
**Fix:** call `persistRainDelayHistory()` after `rainDelayHistory = []` in `clear()`.

### R4-5. Dead `isNetworkError` branch in convertLeadToClient (DataStore ~750) — Mimo M3
`updateLead` no longer throws network errors (it enqueues + returns), so the `isNetworkError` branch in the convert catch block is unreachable.
**Fix:** remove the dead branch; keep the non-network rollback path (delete client server-side + restore lead + rethrow). If the surrounding logic makes the branch harmless-but-confusing, simplify to a comment.

## Accepted (do NOT change)
- ISO8601DateFormatter static let: MainActor-mitigated, accepted.
- Leads not persisted to offline SwiftData cache: v1 trade-off (matches recurringJobs), tracked.
- `client_id` omitted when nil in lead webhook payload: correct optional-field behavior.

## Constraints
- Only touch files under `/opt/data/mowgo/ios-native/MowGo/`.
- Follow existing patterns (await actor props, Task<Void,Never>, no context.rollback()).
- Do NOT build locally. CI compiles on push.
- Report: files changed, per-fix notes, compile risks, deviations.
