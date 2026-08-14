# iOS Parity — Review Round 5 Fixes (final closes)

**Status:** 🆕 — Aug 4, 2026
**Why:** Mimo round-4 delta review found 2 remaining LOW issues (its MEDIUM is already fixed by R4-5, verified). Close both. CI is the compiler. No local builds.

## Fixes

### R5-1. TOCTOU: rain delay webhook can fire despite queued jobs (DataStore ~1062-1064)
`canSyncBeforeUpdate` is checked before `updateJobSchedule`, but that method re-checks canSync() internally. If the network drops between the two checks, a job is queued offline while `queuedJobIds` stays empty → `rain.delay.applied` fires claiming full sync.
**Fix:** make `updateJobSchedule(_:scheduledDate:)` return `Bool` (true = server-synced, false = queued offline), annotated `@discardableResult` (it has other call sites that may ignore the value). In the rain delay loop AND the undo loop, use the RETURN value to decide `queuedJobIds`/`restored` membership instead of the pre-check. Remove the now-redundant `canSyncBeforeUpdate` pre-check (or keep only for the early fully-offline short-circuit if it exists).

### R5-2. Rollback ignores `removePendingMutations` failure (DataStore ~1074-1076)
If the dequeue fails (save error), the stale target-date mutation replays later and silently undoes the rollback.
**Fix:** check the return value in the rollback path; on `false`, set `self.error = "Could not remove queued rain delay changes — verify your schedule"` (best-effort, don't throw; the rollback itself continues).

## Constraints
- Only touch `/opt/data/mowgo/ios-native/MowGo/`.
- Read the cited sections first; follow existing patterns (await actor props, Task<Void,Never>, no context.rollback()).
- Do NOT build locally. CI compiles on push.
- Report: files changed, per-fix notes, compile risks, deviations.
