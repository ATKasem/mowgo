# iOS Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the nine remaining critical, high, and medium findings in `ios-native/codex-review.md`, with one descriptive commit per finding.

**Architecture:** Keep ownership and mutation payload construction in the data/service layer, coordinate data loading with authenticated app state, and make token-refresh requests opt out of recursive automatic refresh. Keep view changes local to presentation state, validation, subscription tier rendering, and currency formatting.

**Tech Stack:** Swift 5.9, SwiftUI, URLSession, Supabase REST, Stripe iOS, Python source-contract regression tests.

## Global Constraints

- Work directly on `main` as explicitly requested.
- Preserve unrelated working-tree changes.
- Commit each of the nine fixes separately with a descriptive message.
- The current Linux environment has no Swift toolchain or Xcode; run executable source-contract tests here and record the native-build limitation.

---

### Task 1: Ownership-safe create payloads

**Files:**
- Modify: `ios-native/MowGo/Services/DataStore.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: `SupabaseService.getCurrentUserId()`, `Client`, and `Job`.
- Produces: private `ClientInsert` and `JobInsert` DTOs whose encoded fields include `user_id`.

- [ ] **Step 1: Write the failing test**

Add a test that requires `createClient` and `createJob` to resolve the current user, encode dedicated insert DTOs, and reject missing authentication or a missing job client.

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest ios-native/tests/test_review_fixes.py -k ownership`

Expected: FAIL because the create methods currently encode full models without resolved ownership.

- [ ] **Step 3: Write minimal implementation**

Define private insert DTOs in `DataStore.swift`. In configured mode, require `getCurrentUserId()`, construct the DTO from the view-supplied domain model, and insert it. Require a client ID for persisted jobs.

- [ ] **Step 4: Run test to verify it passes**

Run the same focused test and expect PASS.

- [ ] **Step 5: Commit**

Commit as `🚑️ fix: include ownership in create payloads`.

### Task 2: Narrow update payloads

**Files:**
- Modify: `ios-native/MowGo/Services/DataStore.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: job status/schedule changes and invoice paid state.
- Produces: `JobStatusPatch`, `JobSchedulePatch`, and `InvoicePaidPatch` payloads without joined `clients`.

- [ ] Write a failing test that rejects full-model job/invoice updates.
- [ ] Run the focused `patch_payloads` test and confirm the expected failure.
- [ ] Route toggle, rain-delay, and paid mutations through operation-specific DTOs while preserving local array updates.
- [ ] Run the focused test and expect PASS.
- [ ] Commit as `🚑️ fix: send narrow job and invoice patches`.

### Task 3: Authentication-gated data loading

**Files:**
- Modify: `ios-native/MowGo/Services/DataStore.swift`
- Modify: `ios-native/MowGo/MowGoApp.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: `AuthService.isLoading`, `isAuthenticated`, and `isDemoMode`.
- Produces: lifecycle-triggered `loadAll()` calls only after auth settles, plus `clear()` on sign-out.

- [ ] Write a failing test proving `DataStore` no longer loads in its initializer and the app triggers/clears it from authenticated state.
- [ ] Run the focused `auth_loading` test and confirm failure.
- [ ] Remove initializer loading, guard configured loads on authentication, and add an app `.task(id:)` coordinator.
- [ ] Run the focused test and expect PASS.
- [ ] Commit as `🐛 fix: load data after authentication settles`.

### Task 4: Expired-session restoration

**Files:**
- Modify: `ios-native/MowGo/Services/SupabaseService.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: persisted access token, refresh token, and expiry.
- Produces: asynchronous `restoreSession() async -> Bool` that refreshes expired credentials and clears invalid sessions.

- [ ] Write a failing test requiring async restoration and refresh-on-expiry.
- [ ] Run the focused `session_restore` test and confirm failure.
- [ ] Restore credentials, return immediately for a valid token, otherwise refresh when possible, and clear credentials on failure.
- [ ] Run the focused test and expect PASS.
- [ ] Commit as `🔒️ fix: refresh expired sessions on restore`.

### Task 5: Non-recursive refresh requests

**Files:**
- Modify: `ios-native/MowGo/Services/SupabaseService.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: shared `request` retry behavior.
- Produces: an `allowsTokenRefresh` request option disabled for sign-in, sign-up, and refresh endpoints.

- [ ] Write a failing test requiring auth token requests to disable automatic refresh and requiring refresh failures to propagate.
- [ ] Run the focused `refresh_deadlock` test and confirm failure.
- [ ] Add the request option, use it for auth endpoints, and replace swallowed refresh errors with explicit propagation before one retry.
- [ ] Run the focused test and expect PASS.
- [ ] Commit as `🔒️ fix: prevent recursive token refresh`.

### Task 6: Payment single-flight guard

**Files:**
- Modify: `ios-native/MowGo/Services/StripeService.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: async Stripe service operations.
- Produces: `isLoading` set before suspension and reset with `defer`, with duplicate submissions rejected.

- [ ] Write a failing test proving payment-intent creation owns loading state and guards duplicates.
- [ ] Run the focused `payment_guard` test and confirm failure.
- [ ] Add a service error for an in-progress operation and wrap payment-intent creation in a single-flight guard.
- [ ] Run the focused test and expect PASS.
- [ ] Commit as `🐛 fix: guard duplicate payment submissions`.

### Task 7: Visible form errors

**Files:**
- Modify: `ios-native/MowGo/Views/Clients/NewClientFormView.swift`
- Modify: `ios-native/MowGo/Views/Today/NewJobFormView.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: existing form `error` state.
- Produces: alerts for validation/save failures, trimmed required values, and required job client selection.

- [ ] Write a failing test requiring alerts and trimmed validation in both forms.
- [ ] Run the focused `form_errors` test and confirm failure.
- [ ] Bind an alert to error presence, trim required text, validate before saving, and preserve input after failure.
- [ ] Run the focused test and expect PASS.
- [ ] Commit as `🚸 fix: show actionable form errors`.

### Task 8: Current subscription tier

**Files:**
- Modify: `ios-native/MowGo/Views/Settings/SettingsView.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: `auth.user?.tier`.
- Produces: `SubscriptionView(currentTier:)` and tier-derived `isCurrent` values.

- [ ] Write a failing test rejecting hard-coded current-plan booleans.
- [ ] Run the focused `subscription_tier` test and confirm failure.
- [ ] Pass the authenticated tier into the sheet and compare each plan tier to the normalized current tier.
- [ ] Run the focused test and expect PASS.
- [ ] Commit as `🐛 fix: show the authenticated subscription tier`.

### Task 9: Currency formatting without truncation

**Files:**
- Modify: `ios-native/MowGo/Models/Models.swift`
- Modify: `ios-native/MowGo/Views/Invoices/InvoicesView.swift`
- Modify: `ios-native/MowGo/Views/Clients/ClientsView.swift`
- Modify: `ios-native/MowGo/Views/Components/ReusableViews.swift`
- Modify: `ios-native/MowGo/Views/Components/JobCardView.swift`
- Modify: `ios-native/MowGo/Views/Home/HomeView.swift`
- Test: `ios-native/tests/test_review_fixes.py`

**Interfaces:**
- Consumes: stored numeric amounts and integer invoice cents.
- Produces: `FormatStyle.currency(code: "USD")` displays and integer-cent invoice totals.

- [ ] Write a failing test that finds legacy dollar interpolation through `Int`.
- [ ] Run the focused `currency_formatting` test and confirm failure.
- [ ] Sum invoice cents, format cents as decimal dollars with currency `FormatStyle`, and format rates without integer truncation.
- [ ] Run the focused test and expect PASS.
- [ ] Commit as `🐛 fix: preserve cents in currency displays`.

### Final verification

- [ ] Run `python3 -m unittest discover -s ios-native/tests -v`.
- [ ] Run source scans for full-model PATCH calls, hard-coded subscription state, initializer data loading, and truncated currency interpolation.
- [ ] Run `git status --short`, `git diff --check`, and inspect the nine fix commits.
- [ ] Report that native Xcode compilation was unavailable in this Linux environment.
