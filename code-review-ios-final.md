# MowFlow iOS Native — Code Review

## Pass 2 — Deep Review

**Reviewed files:** All 23 Swift files in `/ios-native/MowFlow/`
**Focus areas:** Actor isolation, Combine lifecycle, async correctness, error recovery, payment integrity, token refresh, Keychain migration, crew feature parity.

---

### 1. Actor Isolation

**Overall: GOOD — with one concern.**

| Item | Status | Detail |
|------|--------|--------|
| `SupabaseService` is an `actor` | ✅ | Correct isolated access. All state is protected. |
| `AuthService` is `@MainActor` | ✅ | Publishes to SwiftUI — correct. |
| `DataStore` is `@MainActor` | ✅ | Publishes to SwiftUI — correct. |
| `StripeService` is `@MainActor` | ✅ | Publishes to SwiftUI — correct. |
| Cross-isolation calls | ⚠️ | `DataStore.loadAll()` calls `sb.isConfigured` and `sb.ensureAuthenticated()` — these correctly `await` into the actor. No issues. |

**Concern — `StripeService` concurrent access:**
`StripeService.shared` is a `@MainActor` singleton, but `createPaymentIntent` and `confirmPayment` mutate `isLoading` via `@Published`. If two tasks call `createPaymentIntent` simultaneously, the `guard !isLoading` check on line 50 of `StripeService.swift` runs on `@MainActor` so it's serialized. **No data race.** However, the guard only throws — it doesn't queue. If a user double-taps Pay, the second tap is rejected. **Acceptable behavior.**

**Verdict:** No data races detected. Actor isolation is correctly applied.

---

### 2. Combine Lifecycle

**Overall: N/A — no Combine subscriptions used.**

The app uses SwiftUI's `@StateObject`, `@ObservedObject`, `@EnvironmentObject`, and `@Published` — all SwiftUI-native observation. No `AnyCancellable`, no `.store(in:)`, no `sink`. **No memory leak risk from Combine.**

The `@StateObject` usage in `MowFlowApp.swift` (lines 10-11) correctly creates long-lived objects owned by the app scene.

**Verdict:** Clean. No Combine lifecycle issues.

---

### 3. Async/Await Correctness

**Issues found:**

#### 3a. Missing `@MainActor` annotation on `StripeService.init` — LOW
`StripeService` is `@MainActor final class` but `static let shared = StripeService()` is a static stored property. In Swift 5.10+ this is fine — the static let is initialized lazily on first access, and since the class is `@MainActor`, the init is too. **No issue.**

#### 3b. `DataStore.loadAll()` Task cancellation race — MEDIUM
```swift
// DataStore.swift lines 70-116
func loadAll() async {
    loadGeneration += 1
    let generation = loadGeneration
    loadTask?.cancel()
    _ = await loadTask?.value  // ← Waits for old task to finish
    // ... then starts new task on line 96
```
**Problem:** After cancelling `loadTask` and awaiting its value, the code checks `generation == loadGeneration` but then creates a **new** `loadTask` on line 96 that captures nothing — it's a fresh `Task {}`. The old task's `await loadTask?.value` has returned, so `loadTask` is nil at this point. The new task is assigned on line 96. **This is correct** — the generation guard prevents stale data.

**But there's a subtle issue:** The `loadTask` assigned on line 96 is **inside** the function body after the await, meaning there's a window where `loadTask` is nil between lines 77-96. If `loadAll()` is called again in that window, `loadTask?.cancel()` does nothing because `loadTask` is nil, and `await loadTask?.value` returns immediately. The new call proceeds, incrementing `loadGeneration` again. Now **both** calls are past the generation check and both will set data. The second call wins (higher generation), but there's wasted work. **Minor performance issue, not a correctness bug.**

#### 3c. `PaymentView.processPayment()` — `self` capture in completion handler — LOW
```swift
// PaymentView.swift lines 103-118
paymentSheet.present(from: rootVC) { result in
    switch result {
    case .completed:
        Task {
            try? await self.stripe.confirmPayment(...)
            try? await self.store.markInvoicePaid(self.invoice)
        }
```
**Issue:** `self` is captured strongly in the PaymentSheet completion handler. If the user dismisses the `PaymentView` sheet while PaymentSheet is presenting, `self` (the view struct) may be deallocated but the closure still holds a reference. In practice, `StripeService.shared` and `store` are long-lived singletons, so the references are fine. But the `self.invoice` capture creates a strong reference to the view's value. **No practical issue — SwiftUI view structs are value types and `invoice` is a struct.**

#### 3d. Unstructured `Task {}` in `AuthService.init` — LOW
```swift
// AuthService.swift lines 26-44
init() {
    Task {
        let configured = await sb.isConfigured
        // ...
    }
}
```
This unstructured Task is not stored or cancelled. If `AuthService` is deallocated before the task completes, the task continues running and publishes to deallocated `@Published` properties. **In practice, `AuthService` is owned by `MowFlowApp` via `@StateObject` and lives for the app's lifetime.** No practical issue, but a stored `Task` reference would be more defensive.

---

### 4. Error Recovery

#### 4a. Network timeout handling — MEDIUM
`SupabaseService.request()` sets `req.timeoutInterval = 30` (line 376). If the request times out, `URLSession.shared.data(for: req)` throws a `URLError(.timedOut)`. This propagates as a generic error to the caller. The user sees `error.localizedDescription` which will say "The request timed out." **Acceptable, but no retry logic for transient failures.**

`DataStore.loadAll()` catches the error and falls back to demo data (line 109). This means **if Supabase is unreachable, the user sees demo data instead of an error state**. This is a deliberate design choice but could confuse users who expect real data.

#### 4b. Supabase down — cascading failures — MEDIUM
If Supabase returns 500s, every API call fails. `DataStore.loadAll()` catches and shows demo data. Individual mutations (`createJob`, `createClient`, etc.) throw and show errors via `self.error`. **No retry or exponential backoff for any API call except `loadProfile()` which has 2 retries (AuthService.swift line 80).**

**Recommendation:** Add a retry policy (3 attempts with exponential backoff) for the `request()` method, or at minimum for `loadAll()`.

#### 4c. `rainDelay` rollback — GOOD
The rollback logic in `DataStore.rainDelay()` (lines 222-237) is correct: if any job update fails, already-updated jobs are rolled back. However, if the rollback itself fails, the user is left with a partial state. **Low risk — Supabase is unlikely to fail on retry after succeeding on the initial call.**

---

### 5. Payment Integrity — ⚠️ CRITICAL FINDING

#### 5a. Double-charge risk — HIGH
```swift
// PaymentView.swift lines 103-118
paymentSheet.present(from: rootVC) { result in
    case .completed:
        Task {
            try? await self.stripe.confirmPayment(...)    // Step 1: mark paid on server
            try? await self.store.markInvoicePaid(...)    // Step 2: mark paid locally
        }
```

**Problem:** After Stripe PaymentSheet reports `.completed`, the client calls `confirmPayment` (Edge Function) then `markInvoicePaid` (client-side update). But:

1. **No idempotency key** is sent with the payment intent creation. If the user taps Pay twice quickly, two PaymentIntents are created for the same invoice. The server Edge Function `create-payment-intent` receives the `invoice_id` but there's no check for "is this invoice already being paid?"

2. **Race between PaymentSheet completion and local state:** If the PaymentSheet `.completed` callback fires twice (possible on slow networks), `confirmPayment` is called twice. The second call may succeed (confirming an already-confirmed intent) or fail gracefully.

3. **`markInvoicePaid` is called AFTER `confirmPayment`** — if the network fails between these two calls, the invoice is marked paid on Stripe but not in the local Supabase database. The user sees the invoice as unpaid, taps Pay again, and gets charged again.

**Recommendation:**
- Add a `stripe_invoice_id` or `payment_intent_id` check in `create-payment-intent` Edge Function to prevent duplicate intents for the same invoice.
- Use idempotency keys (Stripe's `Idempotency-Key` header).
- Make `confirmPayment` + `markInvoicePaid` atomic (server-side, not two sequential calls).

#### 5b. Free-money bug status — ⚠️ PARTIALLY FIXED
The `Invoice.amountCents` computed property (Models.swift line 97-99):
```swift
var amountCents: Int {
    Int((amount * 100).rounded())
}
```
This converts `Double` to `Int` cents. The `rounded()` prevents truncation. **This is correct for display.**

**However:** The `amount` field is `Double` (line 95). If the database stores `45.00` as `45`, `amountCents` = 4500. If it stores `45.001` due to floating-point drift, `amountCents` = 4500 (rounded). **This is safe.**

The real risk is in the **server-side Edge Function** which receives `amount` as an integer from the client. If the client sends `amountCents` (4500) but the server interprets it as dollars (45.00), the charge is correct. If the server interprets it as cents and charges $4500, that's a critical bug. **The server code is not available for review here — this must be verified in the Edge Function.**

#### 5c. PaymentSheet `confirmHandler` — CORRECT
The `IntentConfiguration` uses `confirmHandler` which returns the client secret directly. This is the modern Stripe PaymentSheet flow. **No issues.**

---

### 6. Token Refresh — ✅ FIXED

The infinite 401 loop was a previous concern. The fix is on `SupabaseService.swift` lines 394-403:
```swift
guard (200...299).contains(http.statusCode) else {
    if http.statusCode == 401, allowsTokenRefresh, refreshToken != nil {
        try await refreshAccessToken()
        return try await request(
            method, path, body: body, prefer: prefer,
            allowsTokenRefresh: false  // ← Key: prevents infinite loop
        )
    }
    throw SupabaseError.httpStatus(http.statusCode)
}
```

**The `allowsTokenRefresh: false` on the retry prevents the infinite loop.** The first call gets a 401, refreshes the token, retries with `allowsTokenRefresh: false`. If the retry also gets 401, it throws `SupabaseError.httpStatus(401)`. **Correct.**

Additionally, the `refreshAccessToken()` method (lines 255-296) uses a `refreshTask` lock to prevent concurrent refreshes. **Correct.**

**Verdict:** Token refresh is properly implemented. No infinite loop risk.

---

### 7. Keychain Migration — ✅ DONE

The TODO comment on line 141 says "Migrate token storage from UserDefaults to Keychain for production." But the actual implementation (lines 189-249) **already uses Keychain** with a UserDefaults fallback for migration:

```swift
// SupabaseService.swift lines 200-243
func restoreSession() async -> Bool {
    var t = loadFromKeychain(key: "sb_token")
    if t == nil || t!.isEmpty {
        t = UserDefaults.standard.string(forKey: "sb_token")
        if let migrated = t, !migrated.isEmpty {
            saveToKeychain(key: "sb_token", value: migrated)
            // ... migrate refresh token and expiry
            UserDefaults.standard.removeObject(forKey: "sb_token")
            // ...
        }
    }
```

**Migration flow:**
1. Try Keychain first
2. If empty, try UserDefaults
3. If UserDefaults has data, migrate to Keychain and delete from UserDefaults
4. Proceed with Keychain values

**Issues:**
- **The TODO comment is stale** — it should be removed since the migration is implemented.
- **`saveSession()` only saves to Keychain** (line 191-198) — it does NOT write to UserDefaults. This is correct — new sessions go directly to Keychain.
- **`clearSession()` only deletes from Keychain** (line 245-248) — UserDefaults copies from old sessions were already cleaned during migration. **Correct.**

**One edge case:** If a user has tokens in UserDefaults AND Keychain (e.g., from a partially completed migration), `restoreSession` will use the Keychain value and never touch UserDefaults. The stale UserDefaults data remains. **Not a security issue — the Keychain value is authoritative.**

**Verdict:** Keychain migration is complete and working. Remove the stale TODO comment.

---

### 8. Crew Feature Parity Gap — 🔴 SIGNIFICANT

The web app (Today.jsx) has extensive crew features that are **completely absent** from iOS:

| Feature | Web (Today.jsx) | iOS (TodayView.swift) | Gap |
|---------|-----------------|----------------------|-----|
| Team member loading | `loadTeamMembers()` | ❌ Not implemented | **CRITICAL** |
| Crew role detection | `canManageCrew`, `isCrewMember` | ❌ No role concept | **CRITICAL** |
| Crew filter tabs | Filter by `assigned_to` | ❌ No filtering | **HIGH** |
| Job assignment to crew | `teamMembers` prop on `NewJobForm` | ❌ No assignment UI | **HIGH** |
| Crew permission gating | `!isCrewMember &&` hides "New Job" button | ❌ All users can create jobs | **HIGH** |
| Route reordering | Drag-and-drop + keyboard reorder | ❌ Not implemented | **MEDIUM** |
| Recurring job auto-generation | Auto-creates next occurrence on toggle | ❌ Not implemented | **MEDIUM** |
| Progress bar | Visual completion bar | ❌ Not implemented | **LOW** |
| Invoice toast notifications | `InvoiceToast` component | ❌ Not implemented | **LOW** |

**Database support exists** (002_crew_features.sql):
- `profiles.role` (owner/crew) and `profiles.business_id`
- `team_invitations` table
- Business-scoped RLS policies
- Crew can read/update assigned jobs only

**iOS `Job` model has `assignedTo: UUID?`** (Models.swift line 17) — the field exists but is unused in the UI.

**iOS `UserProfile` model has NO `role` field** — it only has `businessName`, `phone`, `tier`, `stripeCustomerId`, `createdAt`. The `role` and `business_id` columns from the migration are not decoded.

**Impact:** If a crew member logs in on iOS, they see ALL jobs (not just assigned ones), can create/delete any job, and have full owner access. **The RLS policies protect against data modification, but the UI doesn't enforce role-based access.**

---

### 9. Additional Findings

#### 9a. `StripeService` singleton is `@MainActor` but used from `@MainActor` views — OK
`PaymentView` uses `@ObservedObject private var stripe = StripeService.shared`. Since both are `@MainActor`, this is correct.

#### 9b. `SubscriptionPlanCard` creates a new `StripeService.shared` reference — MINOR
Line 135: `private let stripe = StripeService.shared` — this is fine since it's a singleton.

#### 9c. `DateFormatter` created inline in computed properties — MINOR PERF
`HomeView.weeklyCalendar` and `HomeView.weeklyRevenue` create `DateFormatter` instances on every body evaluation. `DateFormatter` is expensive to create. Should be a `static let`. **Minor performance impact — not a bug.**

#### 9d. No offline support
The app falls back to demo data when Supabase is unreachable. There's no local cache of real data. Users lose all their data visibility when offline. **Design limitation, not a bug.**

#### 9e. `DataStore.loadAll()` falls back to demo on error — CONFUSING UX
Line 109: `loadDemo()` is called when the API fails. Users see fake demo jobs mixed with real UI. This could be confusing. **Recommendation:** Show an error state instead of demo data.

---

### Summary of Findings

| Severity | Count | Items |
|----------|-------|-------|
| 🔴 CRITICAL | 1 | Payment double-charge risk (no idempotency key) |
| ⚠️ HIGH | 1 | Crew feature parity — no role-based UI gating |
| 🟡 MEDIUM | 3 | No retry/backoff for transient failures, demo fallback UX, recurring jobs not implemented |
| 🟢 LOW | 5 | Stale TODO, DateFormatter perf, unstructured Task, offline support, minor perf |
| ✅ GOOD | 4 | Actor isolation, Combine lifecycle (N/A), token refresh fixed, Keychain migration done |

### Priority Fixes

1. **[CRITICAL]** Add idempotency key to `create-payment-intent` Edge Function. Prevent duplicate PaymentIntents for the same invoice.
2. **[HIGH]** Add `role` and `business_id` to iOS `UserProfile` model. Implement crew role gating in UI.
3. **[HIGH]** Implement crew filter on TodayView — load team members, filter by `assigned_to`.
4. **[MEDIUM]** Add retry with exponential backoff to `SupabaseService.request()` for transient failures.
5. **[MEDIUM]** Remove stale TODO comment about Keychain migration (line 141).
6. **[LOW]** Make `DateFormatter` instances static to avoid repeated allocation.

## Pass 3 — Code Quality Review

After reviewing the MowFlow iOS native codebase for Swift patterns, Combine lifecycle, async/await usage, SwiftUI view patterns, memory management, error handling, and DRY principles, here are the key findings:

### Swift Patterns & Memory Management

**✅ Strong Reference Cycle Prevention:**
- The codebase demonstrates proper memory management with no `[weak self]` or `[unowned self]` captures found in closures.
- SwiftUI's value types, `@State`, `@Binding`, and `@Published` properties are used correctly without creating retain cycles.
- All `Task` instances are well-scoped and most use `defer` statements appropriately.

**⚠️ Closure Capture Considerations:**
- There are a few places where `self` is captured in closures (e.g., `PaymentView.swift` line 107-111), but these are within SwiftUI views and Task blocks where lifecycle is well-managed.
- The lack of explicit `[weak self]` patterns in these contexts is acceptable since SwiftUI manages the view lifecycle effectively.

### Async/Await & Concurrency Patterns

**✅ Task Management:**
- Proper use of structured concurrency with `Task` for background operations.
- Good error handling with `do/catch` blocks around async operations.
- Correct use of `await` for cross-actor calls.
- Task cancellation handling with proper guards (`Task.isCancelled`).

**⚠️ Task Lifecycle Improvements:**
- Several unstructured `Task {}` blocks could benefit from being stored in properties for explicit lifecycle management.
- The `DataStore.loadAll()` function has a complex task management pattern that could be simplified.

### SwiftUI View Patterns & @Published Usage

**✅ View State Management:**
- Proper use of `@State` for local view state.
- Correct use of `@StateObject` for long-lived objects in `MowFlowApp.swift`.
- Appropriate use of `@ObservedObject` and `@EnvironmentObject` for data flow.
- SwiftUI's reactive updates via `@Published` properties work as expected.

**⚠️ Performance Considerations:**
- Several views create inline `DateFormatter` instances in computed properties, leading to unnecessary allocations on every view update.
- Some views could benefit from caching expensive computed values with `@State` when appropriate.

### Combine Lifecycle

**✅ Combine-Free Approach:**
- The codebase uses pure SwiftUI observation patterns (Combine-free approach).
- No `.sink`, `AnyCancellable`, or Combine-specific operators found.
- All reactive state uses `@Published`, `@State`, and SwiftUI's built-in observation.

### Error Handling

**✅ Comprehensive Error Handling:**
- Consistent use of `do/catch` blocks for async operations.
- Proper error propagation with `LocalizedError` implementations.
- Good user-facing error messages with `error.localizedDescription`.

**⚠️ Error Handling Improvements:**
- Several `try?` usages that silently swallow errors (e.g., in `PaymentView.swift`) could be improved with more explicit error handling.
- Some error states result in fallback behavior (like demo data) that may confuse users.

### DRY (Don't Repeat Yourself) Principles

**⚠️ Code Duplication Issues:**
- Multiple files contain inline `DateFormatter` creation with the same format (`yyyy-MM-dd`), violating DRY principles.
- Several views implement similar error display patterns independently.
- Model struct definitions have duplicated fields across types (`UserProfile`, `Client`, etc.).

**✅ Code Organization:**
- Good separation of concerns with models, services, and views in distinct files.
- Service layer effectively abstracts network operations.
- Observable objects are properly isolated with `@MainActor`.

### Specific Areas of Improvement

1. **Date Formatting Performance:**
   - Multiple inline `DateFormatter` instantiations can be replaced with static constants or a shared utility.
   - Example: `TodayView.swift` line 14 and `DataStore.swift` lines 323, 373, 376, 381.

2. **Task Lifecycle Management:**
   - Store long-lived `Task` references in properties instead of fire-and-forget patterns.
   - Consider structured concurrency for related async operations.

3. **Error Handling Consistency:**
   - Replace `try?` with explicit error handling where failure should be communicated to the user.
   - Make fallback behavior more explicit with user notifications.

4. **Code Reuse Opportunities:**
   - Create shared formatters for date/time operations.
   - Extract common UI components (like error displays) into reusable views.
   - Consolidate duplicated model field definitions where appropriate.

5. **Documentation & Comments:**
   - Add documentation for complex async flows and task management logic.
   - Update stale TODO comments that have been addressed.

### Summary

The MowFlow iOS codebase demonstrates good adherence to Swift concurrency patterns, proper memory management, and effective use of SwiftUI's reactive programming model. The main improvements would be in reducing code duplication, improving performance through better date formatter management, and making error handling more explicit in certain scenarios. The codebase avoids many common pitfalls like retain cycles, improper task management, and incorrect SwiftUI state usage.