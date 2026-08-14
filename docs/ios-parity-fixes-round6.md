# iOS Parity — Review Round 6 Fixes

**Status:** 🆕 — Aug 4, 2026
**Why:** Final confirmation review (Codex) found 2 issues in the rain delay / undo rollback paths (1 HIGH, 1 MEDIUM). Fix both. CI is the compiler. No local builds.

## Fixes

### R6-1. Rain-delay rollback calls removePendingMutations for server-synced jobs → false dequeue-failure error (DataStore ~1076)
The rollback path (non-network failure mid-loop) removes pending `job:schedule` mutations for ALL succeeded jobs — but server-synced jobs have NO queued mutation, so `removePendingMutations` returns false ("no matching mutation") and the R5-2 error message is set spuriously.
**Fix:** track which succeeded jobs were actually queued during the loop (the loop already computes `queuedJobIds` from `updateJobSchedule`'s return value). In the rollback, call `removePendingMutations` ONLY for the queued jobs (payload filter: scheduledDate == targetDate). Server-synced jobs are handled by the existing server-side rollback (update back to original date). If a queued job's removal fails → set the R5-2 error message (that's now a genuine failure).

### R6-2. Undo: offline-queued restores excluded from `restored` → partial state on later failure (DataStore ~1145)
In `undoRainDelay`, `updateJobSchedule` returning false (queued offline) only adds the job to `restoredIds`, not `restored`. If a LATER job fails with a non-network error, the rollback reverts only `restored` — the queued jobs stay locally-restored + queued while the method throws, leaving inconsistent partial state.
**Fix:** track sync state per restored job: `var restored: [(Job, String, wasQueued: Bool)]` (or two separate arrays). For queued jobs (return false) AND network-error jobs (catch path), append with wasQueued=true. Rollback:
- wasQueued == true → `removePendingMutations(operation: "job:schedule", entityId: job.id, payloadMatches: scheduledDate == originalDate)`; if removal fails → set error (best-effort, continue).
- wasQueued == false → server rollback via `updateJobSchedule(current, scheduledDate: entry.targetDate)` as today.
Also verify the rain-delay method's rollback uses the same distinction (queued → dequeue only, synced → server rollback) and apply the R6-1 fix there consistently.

## Constraints
- Only touch `/opt/data/mowgo/ios-native/MowGo/`.
- Read rainDelay (~1055-1090) and undoRainDelay (~1125-1190) first; follow existing patterns.
- Do NOT build locally. CI compiles on push.
- Report: files changed, per-fix notes, compile risks, deviations.
