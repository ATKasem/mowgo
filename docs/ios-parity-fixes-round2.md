# iOS Parity — Review Round 2 Fixes

**Status:** 🆕 — Aug 4, 2026
**Why:** Round-2 adversarial review (Codex) of the round-1 fix delta found 9 issues, including 2 round-1 fixes that did not fully land (updateLead stale index, deleteLead full-array restore). Fix all items. CI is the compiler (ios-ci.yml). No local builds.

## High fixes

### R2-1. Persistence.enqueueMutation: failed save leaves ghost mutation (`MowGo/Services/Persistence.swift` ~141)
`context.insert(mutation); try context.save()` — if save throws, the inserted PendingMutation stays in the context and a later successful save persists an operation the caller rolled back.
**Fix:** wrap the save: on failure, `context.delete(mutation)` (SwiftData has no rollback) BEFORE rethrowing, so a later save can't persist it.

### R2-2. Offline rain delay drops `rain.delay.applied` webhook (`MowGo/Services/DataStore.swift` ~1087)
When rain delay happens offline (jobs enqueued), the webhook fires anyway and fails silently — the event is permanently lost.
**Fix:** fire `rain.delay.applied` ONLY when the operation was actually synced (canSync was true and server updates succeeded), not on the offline-queued path. Offline path: skip the webhook (it will not be queued — document as accepted best-effort loss).

### R2-3. Undo network-failure rollback incomplete (`MowGo/Services/DataStore.swift` ~1109-1118)
In undoRainDelay, if a job's restore update hits a network error: the code enqueues + locally applies the change before throwing, but that job is missing from the `restored` set → the rollback path treats it as not-restored and reverts it, leaving the local state wrong.
**Fix:** mirror the rain-delay H5 pattern: when a network error occurs during undo, treat that job as restored (add to `restored`, exclude from rollback), enqueue the update, and continue/complete — do not throw for network errors mid-undo. Non-network errors roll back the already-restored jobs and rethrow.

### R2-4. Partial undo retry deadlock (`MowGo/Services/DataStore.swift` ~1109-1123)
When undo is partial (some jobs skipped because their current date != targetDate), the entry keeps ALL original jobIds, so every retry skips the already-restored ones again and the entry can never complete or be removed.
**Fix:** on partial undo, REMOVE the successfully restored job ids from the entry's originalDates/jobIds and persist the updated entry. If originalDates becomes empty, remove the entry entirely. Retry then only processes the remaining jobs.

### R2-5. updateLead stale index on rollback (`MowGo/Services/DataStore.swift` ~1364-1383) — ROUND-1 FIX DID NOT FULLY LAND
`leads[index] = original` in the catch/guard paths uses the index captured before the async `sb.update` call. Actor reentrancy (polling/refresh) can shift the array → wrong lead overwritten or out-of-bounds trap.
**Fix:** in EVERY rollback/restore site inside updateLead, re-find the index by id first: `if let idx = leads.firstIndex(where: { $0.id == id }) { leads[idx] = original }` (or `updated` for the offline-applied path). Do the same for any other lead method that restores by captured index.

### R2-6. deleteLead full-array restore (`MowGo/Services/DataStore.swift` ~1391-1413) — ROUND-1 FIX DID NOT FULLY LAND
`leads = original` on failure clobbers concurrent reloads/inserts/edits made during the async window.
**Fix:** capture the removed element (`let removed = leads.first(where: { $0.id == id })`) and on failure re-insert it by id at the original position if still absent: find current index of any lead with the same id; if none, insert `removed` back (position: min(originalIndex, leads.count)). Never assign the whole array.

### R2-7. Convert rollback vs queued lead:update referencing deleted client (`MowGo/Services/DataStore.swift` ~1431-1438)
In convertLeadToClient, updateLead can throw AFTER enqueueing (network-failed path still throws per current pattern). The rollback then deletes the created client while a queued `lead:update` (with client_id set) will sync later → dangling reference / FK issue.
**Fix:** in convertLeadToClient, only delete the created client on NON-network updateLead failures. On network failure (update was enqueued): do NOT delete the client — keep it, set the local lead to won+clientId (already applied), and return success (consistent with R2-3/R2-8 semantics). Also remove the throw on the network-queued path of updateLead: after a successful enqueue on network error, set `self.error = "Saved offline — will sync when connected"` and RETURN (do not throw) — this matches the round-1 H4 change applied to lead create and prevents duplicate enqueues + the convert inconsistency. Non-network errors still rollback + throw.

### R2-8. createClient offline paths ignore enqueue failure (`MowGo/Services/DataStore.swift` ~1453-1456, ~1483-1486)
Both the offline path and the network-fallback path of createClient ignore the safeEnqueue result and report success → convert can link a lead to a client that will never sync (and locally the client is non-durable).
**Fix:** in BOTH createClient paths, check safeEnqueue's result; on failure remove the locally added client + throw `DataStoreError.persistenceUnavailable` (mirror the lead methods' guard pattern).

## Constraints
- Only touch files under `/opt/data/mowgo/ios-native/MowGo/`.
- Follow existing patterns (await actor props, Task<Void,Never>, no context.rollback()).
- Do NOT build locally. CI compiles on push.
- Report: files changed, per-fix implementation notes, compile risks, deviations.
