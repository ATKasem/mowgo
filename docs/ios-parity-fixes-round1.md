# iOS Parity — Review Round 1 Fixes

**Status:** 🆕 — Aug 4, 2026
**Why:** Dual adversarial review (Mimo + Codex) of the iOS Leads + Rain Delay v2 parity commit found 4 criticals and ~14 high/medium issues. Fix all listed items. CI is the compiler (ios-ci.yml); no local builds.

## Critical fixes

### C1. Lead model decoder key mismatch (`MowGo/Models/Models.swift`, struct Lead ~line 186)
`init(from:)` decodes with `DynamicCodingKey("userId")`, `DynamicCodingKey("clientId")`, `DynamicCodingKey("createdAt")`, etc. (camelCase) but the struct's `CodingKeys` encode snake_case (`user_id`, `client_id`, `created_at`, `updated_at`). Every decode of a Lead (offline queue replay, Supabase fetch) fails.
**Fix:** replace the DynamicCodingKey decoder with `container(keyedBy: CodingKeys.self)` and decode via the snake_case CodingKeys (mirror how Client does it in the same file). If the DynamicCodingKey type becomes unused, remove it or leave only if other models use it (check first).

### C2. convertLeadToClient partial failure (`MowGo/Services/DataStore.swift`)
`createClient(client)` then `updateLead(...)` — if updateLead throws, an orphaned client remains in Supabase with no linked lead and the lead stays non-won.
**Fix:** wrap: on updateLead failure, best-effort delete the created client server-side (reuse the client delete server path; ignore delete errors), restore lead status, then rethrow. Demo path unchanged.

### C3. Rain delay history not user-scoped (`MowGo/Services/DataStore.swift`, loadRainDelayHistory ~1095)
UserDefaults key is literally "rainDelayHistory" — any account sees/undoes another account's history.
**Fix:** key = `"rainDelayHistory_\(currentUserId?.uuidString ?? "anonymous")"`. Reload history in `loadAll()` AFTER currentUserId is set (it currently loads only in init before auth). Clear `rainDelayHistory = []` in `clear()`/sign-out path.

### C4. Offline rain delay treats swallowed enqueue failure as success (DataStore ~834)
If `safeEnqueue` fails (persistence unavailable), the code still records history + fires push + reports success although nothing will ever sync.
**Fix:** check the enqueue result. On enqueue failure: set error, do NOT record history, do NOT report success, throw. On successful enqueue: keep current behavior.

## High fixes

### H1-H3. Offline lead mutations report success after swallowed enqueue failure (create ~1245, update ~1292, delete ~1318)
Same class as C4 for leads: if `safeEnqueue` returns failure, the mutation must not claim success (throw + set error; lead stays in original state).

### H4. Network-failed lead creation queues AND throws → duplicate enqueue on retry (DataStore ~1267)
**Fix:** for lead create: on network error, enqueue + set `self.error = "Saved offline — will sync when connected"` and RETURN (do not throw). The lead is already in the local array. Only non-network errors throw (after removing the local lead).

### H5. Rain-delay rollback excludes network-failed-but-queued jobs (DataStore ~852)
updateJobSchedule can throw after locally applying + enqueueing; rain delay rollback re-syncs but that job still moves later despite reported failure.
**Fix:** in rainDelay, when a job's update throws with a network error (isNetworkError), treat the job as "pending offline" — include it in the success count, exclude it from rollback, and note it in the history entry (jobCount reflects actually-moved jobs). Non-network errors roll back as today.

### H6. Post-replay refresh omits leads (DataStore ~325)
After `syncPendingMutations` completes, the refresh path must reload leads too.
**Fix:** ensure the post-replay refresh calls `loadLeads()` (or the same load path loadAll uses for leads). Verify loadAll() itself fetches leads and keep that.

### H7. Replayed lead:update fires webhook with stale/pre-replay status (DataStore ~439)
**Fix:** in the lead:update replay handler, decode the LeadPatch from the mutation payload and fire `lead.status.updated` with the PATCHED status (not a stale snapshot). For offline-created leads absent from the snapshot, skip firing (or fire with the patch status — prefer patch status).

### H8. Concurrent undo/apply interleaving (DataStore ~1068)
**Fix:** add an `isUndoingRainDelay` guard flag (mirror isRainDelaying): undo returns early while another undo/apply is in flight. Set/defer around the whole undo loop.

### H9. Undo overwrites jobs without verifying target date (DataStore ~1072)
**Fix:** before restoring a job's original date, verify the job's CURRENT scheduled date still equals the history entry's targetDate. If not (job was manually rescheduled after the delay), skip that job. If ANY job is skipped: keep the history entry (do NOT delete it), set `self.error` explaining the partial undo, and report partial in the toast path.

### H10. Demo mode doesn't invalidate authenticated load/poller (MowGoApp.swift ~99)
**Fix:** when switching INTO demo mode: bump the load generation, cancel the polling task, and clear current data before loading demo data (mirror the sign-out hygiene pattern).

### H11. Skipped rain delay still reports success + stale undo (RainDelaySheet.swift ~78)
**Fix:** `rainDelay(for:to:)` should return `Bool` (true = applied, false = skipped because no pending jobs or already in flight). The sheet records history + shows toast ONLY on true. Add a cancel/error path when false (no-op silently is acceptable but no history entry).

### H12. `rain.delay.applied` webhook advertised but never fired (IntegrationsView.swift:18 + DataStore)
**Fix:** after a successful rain delay (non-demo), fire the `rain.delay.applied` webhook (payload: count, date, targetDate — snake_case) via the existing WebhookService pattern. Demo mode: no-op.

## Medium fixes

### M1. Undo silently skips missing jobs and deletes entry (DataStore ~1072) — folded into H9 (keep entry on partial).

### M2. Undo controls enabled during execution (RainDelaySheet.swift ~111)
**Fix:** add `@State private var isUndoing = false`; disable undo buttons (`.disabled(isUndoing)`) while an undo Task runs.

### M3. PushNotificationService strong reference removed (MowGoApp.swift)
The batch removed `@StateObject private var push = PushNotificationService.shared`. The service is `ObservableObject` with `@Published isRegistered/permissionGranted` and is likely the UNUserNotificationCenter delegate.
**Fix:** keep a strong reference as a plain property: `private let push = PushNotificationService.shared` (no @StateObject — singleton, ownership semantics wrong) so the delegate/published state stays alive. Do not re-add @StateObject.

### M4. ISO8601DateFormatter allocated per decode (Models.swift ~91)
**Fix:** `private static let isoFormatter = ISO8601DateFormatter()` and reuse in the Lead decoder.

## Verified non-issues (do NOT change)
- DataStore is `@MainActor` — UserDefaults access in init is fine (reviewer flagged, verified safe).
- WeatherService called with nil coordinates → dormant banner is BY DESIGN (profile location feature is a separate card; web shipped it, iOS location field comes later).
- createLead offline throw-after-local-save matches the existing client create convention — BUT H4 changes it to return success for network errors; keep consistent with H4.

## Constraints
- Only touch files under `/opt/data/mowgo/ios-native/MowGo/`. Never touch web/Android/server.
- Follow existing patterns (await actor props, Task<Void,Never>, no context.rollback()).
- Do NOT build locally. CI compiles on push.
- Report: files changed, how each fix was implemented, compile risks.
