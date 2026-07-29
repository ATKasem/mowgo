# MowGo iOS Offline Sync Queue — Codex Review Pass 2

**Date:** 2026-07-29
**Reviewer:** Codex (gpt-5.6-sol)
**Context:** Second review pass after first round found 16 issues (all fixed)
**Diff:** /tmp/mowgo-offline-sync-diff.patch (616 lines)

---

## Findings: 8 remaining issues

### 1. Critical — connectivity failure permanently latches the app offline
**Location:** SupabaseService.swift:75
`isOnline` is included in `isConfigured`. After a request sets `isOnline = false`, `loadAll`, replay, authentication, and mutations stop making requests because they first guard on `isConfigured`. Only a successful request can restore `isOnline`, but those guards prevent one. Recovery requires restarting the app. Configuration and reachability must be separate concepts.

### 2. High — the first mutation encountering an outage is not queued
**Location:** DataStore.swift:480
`isOnline` remains true until the request fails, so the operation takes the online branch, throws, and receives neither the optimistic local update nor a queue entry. Only subsequent operations see offline mode. Network errors from the actual write need to enter the enqueue path, with ambiguity-safe retry semantics.

### 3. High — the pseudo-upsert can silently discard creates
**Location:** DataStore.swift:325
Treats every insert error—network timeout, authentication, validation, FK failure, or 5xx—as a duplicate and issues a PATCH. SupabaseService.swift:390 does not verify affected rows, so PATCHing a nonexistent ID can return 2xx; replay then deletes the queue entry despite creating nothing. Use a real database upsert, or fall back only for a confirmed duplicate-key response and require exactly one updated row.

### 4. High — replay does not preserve FIFO after a retryable failure
**Location:** DataStore.swift:220
Continues through the snapshot after every failure. If `client:create` times out, a later `client:update` can produce a successful zero-row PATCH and be removed. The next replay creates the client without its update. Stop at the first retryable failure, or maintain per-entity dependency chains and verify affected rows.

### 5. High — durable sequence ordering resets on every launch
**Location:** Persistence.swift:110
Initializes `nextSequence` to zero even when persisted mutations already exist. New mutations reuse sequence numbers, while loading sorts only by that non-unique field at Persistence.swift:129. A later update/delete can consequently replay before its older create. Derive the next value from persisted state transactionally or use a durable ordered identifier.

### 6. High — `clear()` can race an in-flight replay
**Location:** DataStore.swift:461
Resets `isSyncing` but does not cancel the replay task. Because `@MainActor` methods are reentrant across `await`, the old replay can resume after sign-out, repopulate arrays/cache, or overlap a second replay using the same entries. Track and cancel a sync task, and validate a generation plus authenticated user after every suspension before deleting entries or writing state.

### 7. Medium — refresh erases optimistic state for mutations still pending
**Location:** DataStore.swift:172, DataStore.swift:236
`loadAll` replaces local state with the server snapshot. After partial replay, the same replacement happens again. If one mutation succeeds and another remains queued, the failed mutation's local status/payment/create disappears from the UI and cache. Reapply the remaining queue as a local projection after refresh, or avoid replacing entities with pending mutations.

### 8. Medium — permanent queue errors are retried forever
**Location:** DataStore.swift:225
Removes only `DecodingError`. However, invalid status values and unknown operations throw `PendingMutationError` at DataStore.swift:265 and DataStore.swift:319. Despite the comment saying these are skipped, they remain queued indefinitely. Explicitly quarantine or remove all classified permanent failures.
