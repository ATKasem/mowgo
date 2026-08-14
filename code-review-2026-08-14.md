# Pass 2 — MiMo V2.5 Deep Review

**Date**: 2026-08-14
**Reviewer**: MiMo V2.5 (OpenRouter)
**Scope**: React client (key pages + critical libs), Supabase edge functions, CF Pages functions, iOS native (Services + Views)
**Commit**: pre-launch audit fixes (42f1c1d), iOS session hardening (d436a39), weather alert push (fb0ad63)

---

## CRITICAL VERIFICATION CHECKLIST — ALL PASS ✅

| Check | Result | Evidence |
|-------|--------|----------|
| Payment amounts: server-resolved? | ✅ PASS | `create-payment-intent:51` destructures only `{ currency, invoice_id }`; resolves amount from `invoice.amount` via `amountToCents()` at `:85`. `checkout-subscription:38` maps `{ plan, interval }` to server-side price IDs. `confirm-payment:50` verifies `pi.amount_received` against server invoice. |
| `create_invoice_for_job` uses `clients.rate`? | ✅ PASS | Migration `023_create_invoice_for_job_rpc.sql:55-57`: `select rate into v_rate from public.clients where id = v_client;` — ignores client-supplied `p_amount`. |
| Auth: any endpoint skip auth? | ✅ PASS | All edge functions verify via `supabase.auth.getUser()`. CF Pages functions verify Bearer token + origin. `booking.js` is intentionally public (rate-limited). |
| `isSafeWebhookUrl` called as `{ok, reason}` not boolean? | ✅ PASS | `dispatch-webhook.js:84-86`: `const check = await isSafeWebhookUrl(config.url); if (!check.ok)` — correct. |
| Signed URLs for job photos resolve correctly? | ✅ PASS | iOS `signedPhotoURL(for:)` (`SupabaseService.swift:406-447`): resolves storage paths to fresh 1-hour signed URLs. Validates absolute URLs against project Supabase host (`:413-417`). Path traversal defense (`:424`). |
| Invoice `invoices_amount_check` constraint? | ✅ PASS | Migration `025_invoice_amount_check.sql:8-9`: `CHECK (amount > 0 AND amount <= 100000)`. |
| Invoice FK ownership? | ✅ PASS | Migration `026_invoice_fk_ownership.sql`: RLS checks `client_id in (select id from public.clients where user_id = auth.uid())` and `job_id exists in user's jobs`. |

---

## FINDINGS

### HIGH-1: `payments.js:75` — `user` undefined in `resumeCheckoutIntent()`

**File**: `client/src/lib/payments.js:75`
**Severity**: HIGH
**Impact**: The `resumeCheckoutIntent()` function references `user.id` at line 75 but `user` is never declared in this function scope. This throws a `ReferenceError` at runtime when the function is called with a valid intent.

**Exploit path**: An attacker cannot exploit this — it's a functional bug, not a security hole. The effect is that the trial-first no-card checkout flow is broken on web: a user who sets a plan intent (e.g., browses plans, triggers `localStorage.setItem('mowgo_plan_intent', ...)`) and later logs in will have the intent stay in localStorage forever because the function crashes before it can be consumed or cleared.

**Root cause**: The `user` object was likely available in an earlier version via a module-level variable or import that was refactored away.

**Remediation**:
```javascript
// At the start of the valid-intent block (after line 64), add:
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;
if (!user) {
  return { status: 'error', message: 'Not authenticated', retryable: true };
}
```

**Affected callers**: Any page that mounts the app root and calls `resumeCheckoutIntent()` (login, signup, email confirmation return).

---

### MEDIUM-1: `Dashboard.jsx:438` — `tr` in useEffect dependency array

**File**: `client/src/pages/Dashboard.jsx:438`
**Severity**: MEDIUM
**Impact**: The main data-fetching useEffect depends on `[user, retryKey, tr]`. If `useLocalizedText` returns a new `tr` function object on every render, this causes the effect to re-run (clearing all state + re-fetching) on every render cycle, creating an infinite loop of API calls.

**Evidence**: Lines 381-394 reset all state at the top of the effect. If `tr` changes each render, the effect clears state → triggers re-render → `tr` is new → effect runs again → infinite loop.

**Remediation**: Remove `tr` from the dependency array, or ensure `useLocalizedText` returns a memoized `tr`:
```javascript
// Option A: Remove tr from deps (tr is only used for error messages, not data fetching)
}, [user, retryKey]);
// Option B: Use useMemo in the hook to stabilize tr
```

---

### MEDIUM-2: `cancel-subscription/index.ts:15-19` — stale ALLOWED_ORIGINS

**File**: `ios-native/edge-functions/cancel-subscription/index.ts:15-19`
**Severity**: MEDIUM
**Impact**: Still includes `https://mowgo.pages.dev` and `http://localhost:5173` in ALLOWED_ORIGINS. AGENTS.md hard rule: "pages.dev: gone from all clients (mowgoapp.com only)." The `pages.dev` domain could be reassigned or compromised, allowing cross-origin requests from an attacker-controlled page to cancel subscriptions.

**Remediation**:
```typescript
const ALLOWED_ORIGINS = [
  "https://mowgoapp.com",
];
```
Also remove `http://localhost:5173` from production edge functions.

---

### LOW-1: `create-payment-intent` and `confirm-payment` — wildcard CORS

**Files**:
- `ios-native/edge-functions/create-payment-intent/index.ts:13`
- `ios-native/edge-functions/confirm-payment/index.ts:13`
**Severity**: LOW
**Impact**: Both functions set `Access-Control-Allow-Origin: *`. Auth is still required (Bearer token verified via `supabase.auth.getUser()`), so this is not exploitable. However, it's inconsistent with the CF Pages functions (checkout-subscription, etc.) which restrict CORS to `mowgoapp.com`. Defense-in-depth: restrict to the production origin.

**Remediation**: Replace `"*"` with `"https://mowgoapp.com"` in both edge functions.

---

### LOW-2: `send-rain-delay-sms` — localhost in ALLOWED_ORIGINS

**File**: `supabase/functions/send-rain-delay-sms/index.ts:20`
**Severity**: LOW
**Impact**: `http://localhost:5173` is in ALLOWED_ORIGINS for a production edge function. This allows local development requests but shouldn't ship in production.

---

### LOW-3: `weather-push/index.ts:8` — hardcoded Supabase URL fallback

**File**: `supabase/functions/weather-push/index.ts:8`
**Severity**: LOW
**Impact**: `Deno.env.get("SUPABASE_URL") || "https://vqgiynfrpsqddjrayczc.supabase.co"` — hardcoded fallback. If the env var is missing in a non-production environment, the function silently connects to the production database. Fail-closed would be safer.

**Remediation**: Remove the fallback; return 503 if `SUPABASE_URL` is not set.

---

### LOW-4: `send-push` — FCM access token cached in module scope

**File**: `supabase/functions/send-push/index.ts:229`
**Severity**: LOW
**Impact**: `let cachedFcmAccessToken` is a module-level variable. On Supabase Edge Functions (Deno Deploy), module scope is per-isolate. If the isolate is recycled, the cache is lost and the next call re-authenticates — this is fine. No actual bug in current deployment, but worth documenting the assumption.

---

## iOS NATIVE REVIEW

### SupabaseService.swift — PASS
- Actor-based, thread-safe ✅
- Token refresh deduplication via `refreshTask` (`:307-357`) ✅
- Keychain migration from UserDefaults is crash-safe (`:237-297`) ✅
- `signedPhotoURL(for:)` validates absolute URLs against project host ✅
- Path traversal defense present ✅
- `ensureAuthenticated()` retries once before failing ✅

### DataStore.swift — PASS
- `loadGeneration` counter prevents stale updates from cancelled tasks ✅
- `loadTask?.cancel()` + `await loadTask?.value` properly serializes in-flight loads ✅
- Offline caching via Persistence layer with per-user scoping ✅
- `syncPendingMutations()` replays offline changes in FIFO order ✅
- `generateJobsFromRecurring()` runs even offline (templates in memory) ✅
- `JobEditPatch` uses custom `encode(to:)` to send `null` for cleared optional fields (lines 82-99) — correct fix for SwiftData's `encodeIfPresent` footgun ✅

### StripeService.swift — PASS
- `createPaymentIntent` sends `{ amount, currency, invoice_id }` but server resolves amount from invoice (confirmed above) ✅
- `isLoading` guard prevents concurrent operations ✅
- Checkout URL validated against `checkout.stripe.com` host (`:113-115`) ✅
- Portal URL validated against `billing.stripe.com` host (`:128-129`) ✅
- Idempotency key per invoice prevents duplicate charges (`:90-104`) ✅

### AuthService.swift — PASS
- `loadProfile()` has retry logic (2 attempts with 1s backoff) ✅
- Signs out on permanent auth failure (401/403) ✅
- `grantTrial()` is idempotent (server-side one-shot) ✅

### PaymentView.swift — PASS
- `amountCents` computed from `Decimal * 100` with `NSDecimalRound` (not `Double`) ✅
- PaymentSheet presented from topmost view controller (handles nested sheets) ✅
- `confirmPayment` verifies server-side, not trusting client callback (`:109-111`) ✅

---

## REACT CLIENT REVIEW

### Today.jsx — PASS
- All useEffect dep arrays are correct (empty `[]` for mount-only, `[date]` for date-dependent) ✅
- `toggleStatus` uses callback ref pattern to avoid stale closures ✅
- `jobsRef.current` pattern prevents stale closure in `createJobHandler` ✅
- Drag-and-drop reorder is date-scoped and has rollback on persist failure ✅
- Route optimization has undo + snapshot pattern ✅

### Dashboard.jsx — See MEDIUM-1 (tr in dep array)

### Invoices.jsx — PASS
- `useCallback` handlers have correct dep arrays ✅
- Manual invoice creation goes through `createInvoice` RPC (server-resolved rate) ✅
- Void invoice properly surfaces error state per-invoice ✅

### Settings.jsx — PASS
- Location geocoder has cancellation support ✅
- Profile save handles concurrent location changes via generation counter ✅
- Team member invite properly validates owner role + tier ✅

### Clients.jsx — PASS
- Live lead refresh on unread count increase ✅
- Duplicate phone detection across clients + leads ✅
- Rate review section properly scoped to owner ✅

### Home.jsx — PASS
- Weather fetch uses AbortController for cleanup ✅
- Geolocation with timeout + OKC fallback ✅

---

## CF PAGES FUNCTIONS REVIEW

### stripe/webhook.js — PASS
- HMAC-SHA256 signature verification with timestamp tolerance (5 min) ✅
- Event dedup via `webhook_events` table (fast-path check, then mark AFTER processing) ✅
- `updateProfile` resolves by primary key after matching, preventing multi-row patches ✅
- Referral credit: atomic claim-before-Stripe pattern prevents double-credit ✅
- `claimWinback` uses atomic compare-and-swap (`winback_sent_at IS NULL -> now()`) ✅

### stripe/checkout-subscription.js — PASS
- Origin validation against `ALLOWED_ORIGINS` ✅
- Bearer token verified against Supabase `/auth/v1/user` ✅
- Existing active subscription check prevents double-billing ✅
- Price ID resolved server-side from plan+interval ✅
- Stripe customer creation has rollback-on-save-failure ✅

### invite-crew.js — PASS
- Owner identity verified via `/auth/v1/user` ✅
- Rate limiting by owner ID + IP ✅
- Tier check (crew/premium required) ✅
- Data-existence check prevents converting business owners to crew ✅
- HTML escape on user-controlled `business_name` in email ✅

### booking.js — PASS
- Public endpoint, rate-limited by IP (5/15min) ✅
- UUID validation on business_id (prevents injection) ✅
- Date validation (14-day window) + time slot whitelist ✅
- Duplicate booking detection (pre-query + unique constraint catch) ✅
- Phone/name/address length validation ✅

### weather-alerts.js — PASS
- Public GET endpoint (weather data is not sensitive) ✅
- Coordinates validated via `parseCoordinates` ✅

### webhook-dispatch.js — PASS
- `isSafeWebhookUrl` called correctly (returns `{ok, reason}`) ✅
- HMAC-SHA256 signature on outgoing webhooks ✅
- 10-second delivery timeout ✅

---

## EDGE FUNCTIONS REVIEW

### create-payment-intent — PASS
- Destructures only `{ currency, invoice_id }` — no client-supplied amount ✅
- Amount resolved from `invoice.amount` via `amountToCents()` ✅
- Invoice ownership verified (`.eq("user_id", user.id)`) ✅
- Idempotency key per user+invoice ✅

### confirm-payment — PASS
- Verifies PaymentIntent with Stripe (not trusting client) ✅
- Amount comparison: `pi.amount_received` vs `amountToCents(invoice.amount)` ✅
- Metadata verification (`invoice_id` + `user_id` match) ✅
- Payment intent ID match check ✅

### cancel-subscription — See MEDIUM-2 (stale origins)

### create-customer-portal — Not reviewed (simple passthrough to Stripe)

### create-checkout-session — Not reviewed (symlinked to iOS edge functions)

### weather-push — PASS
- Cron secret verification with constant-time comparison ✅
- Event dedup via `reserve_weather_push_event` RPC ✅
- Reservation-based flow prevents duplicate sends ✅
- Fail-open on dedup check (matches repo convention) ✅

### send-push — PASS
- Dual auth: user JWT (self-send only) or service-role (server-triggered) ✅
- Per-user rate limit on server-triggered path ✅
- FCM token cleanup on UNREGISTERED/INVALID_ARGUMENT ✅
- Constant-time secret comparison ✅

### send-rain-delay-sms — See LOW-2

### sms-inbound — PASS
- Twilio signature validation (HMAC-SHA1) before any routing ✅
- Constant-time comparison ✅
- Cross-tenant guard: narrows thread candidates to businesses with matching `clients` rows first ✅
- Fallback to global thread lookup logged as warning ✅

### get-conversion-kpi — PASS
- Dual auth: admin code (timing-safe) + user JWT allowlist ✅
- All metrics computed server-side via RPC ✅

---

## RLS POLICIES REVIEW

- `001_initial_schema.sql`: Base RLS on profiles, clients, jobs, invoices ✅
- `002_crew_features.sql`: Business-scoped policies via `current_business_id()` SECURITY DEFINER function ✅
  - Crew members can SELECT clients and UPDATE assigned jobs ✅
  - Invoices remain owner-only (no crew access) ✅
- `020_storage_photo_rls.sql`: Photo access gated by uploader or same-business membership ✅
- `026_invoice_fk_ownership.sql`: Invoice INSERT/UPDATE verifies client_id and job_id belong to caller's business ✅
- `027_revoke_anon_execute.sql`: RPCs restricted from anonymous users ✅

## Pass 3 — Qwen3 Coder Code Quality Review

### React Code Quality Issues

#### Today.jsx
1. **Missing Cleanup in useEffect** (MEDIUM)
   - Line 377: The `rainDelayHistoryKey` function uses `_currentDemoUserId()` but this helper function is not defined in the file. This could lead to reference errors.
   - Line 233: In the `ensureClientCoords` function, there's no cleanup for the setTimeout delays if the component unmounts.

2. **Potential Stale Closure** (MEDIUM)
   - Line 304: The `jobsRef.current` reference in the `handleOptimize` function might not capture the latest state if jobs are updated rapidly via drag-and-drop or other interactions.

3. **Inline Object Creation in Render** (LOW)
   - Line 249: The `TEAM_MEMBER_COLORS` array is mapped in the render method, creating new objects on each render which could impact performance with many team members.
   - Line 1169-1178: The navigation app options are recreated on every render.

4. **Missing Error Boundaries** (LOW)
   - Several complex components like `JobCard` and `PhotoUpload` don't have explicit error boundaries, which could lead to unhandled exceptions breaking the UI.

#### Dashboard.jsx
1. **Missing Cleanup in useEffect** (MEDIUM)
   - Line 378-389: The dashboard fetchStats useEffect doesn't properly handle cleanup for async operations that might complete after component unmount.
   - Line 443-465: The weather loading useEffect has a potential race condition if profile changes rapidly.

2. **Inconsistent Dependency Arrays** (LOW)
   - Line 378: The useEffect dependency array includes `user, retryKey, tr` but uses `mounted` variable which might not accurately reflect all dependencies.

3. **Potential Memory Leaks** (LOW)
   - Line 845: The `subscribeToNewLeads` function creates intervals that might not be properly cleaned up in all scenarios.

### Swift Code Quality Issues

#### DataStore.swift
1. **Double for Currency** (HIGH)
   - Multiple instances of using `Double` for monetary values throughout the file. In several places like payment calculations and rate handling, this could lead to precision errors.
   - Line 2084: The `tipAmount` is handled as a Double without proper rounding, which can cause precision issues.

2. **Force Unwrapping** (MEDIUM)
   - Line 1548: Force unwrapping of `tipAmount` with `!` can cause crashes if the value is nil.
   - Line 1750: Force unwrapping of `change` in payment processing.

3. **Magic Numbers** (LOW)
   - Line 2154: The value `60.0` for converting minutes to hours is used without a named constant.

4. **Race Conditions** (MEDIUM)
   - Lines 540-570: The invoice creation flow has potential race conditions when checking for existing invoices and creating new ones, as multiple operations may attempt to process the same job simultaneously.

#### AuthService.swift
1. **Session Handling** (MEDIUM)
   - Line 470: Force unwrapping of `auth` object could crash if initialization fails.
   - Line 519: Force unwrapping of `uid` after casting could cause crashes.

2. **Error Handling** (LOW)
   - Line 427: Generic error catching without specific handling for different failure types.

3. **Thread Safety** (LOW)
   - Lines 591-603: Profile update operations without explicit synchronization which could lead to race conditions in concurrent access scenarios.

#### PaymentView.swift
1. **Double for Currency** (HIGH)
   - Line 155: Multiple Double values used for currency amounts without explicit rounding controls.
   - Line 209: Payment calculations performed with Double precision which may cause display inaccuracies.

2. **Force Unwrapping** (MEDIUM)
   - Line 190: Force unwrapping of optional values in payment processing.

### Edge Functions Code Quality Issues

#### send-push/index.ts
1. **Error Handling Patterns** (MEDIUM)
   - Line 93: Broad error catching without specific handling for different error types.
   - Line 316: Generic error messages that don't provide actionable debugging information.

2. **Async/Await Correctness** (LOW)
   - Lines 194-208: Async operations in push notification sending without explicit timeout handling.

3. **Type Safety** (LOW)
   - Several instances of using `any` type that could be more specifically typed for better safety.

#### webhook.js
1. **Error Handling Patterns** (MEDIUM)
   - Line 235: Broad error catching that may mask underlying issues.
   - Line 197: Generic error messages without specific context for debugging.

2. **Async/Await Correctness** (LOW)
   - Lines 327-344: Multiple await operations without proper error boundaries.

### General Code Quality Issues

#### Data Layer (data.js)
1. **Anti-patterns** (MEDIUM)
   - Line 1095: Manual invoice creation bypasses some validation that might be handled by database constraints.

2. **Inconsistent Patterns** (LOW)
   - Demo mode implementations don't fully mirror production behavior in all cases, particularly around error handling.

3. **Fix Correctness** (LOW)
   - Some error handling paths in demo mode return different data shapes than production mode.

#### Overall
1. **Missing Memoization** (LOW)
   - Several components could benefit from `useMemo` or `useCallback` to optimize re-renders.

2. **Inconsistent Error Handling** (LOW)
   - Error messages are sometimes user-facing while others are developer-focused without clear distinction.

These findings focus specifically on code quality patterns as requested, avoiding re-verification of security/auth findings covered in Pass 2.

## Pass 4 — Codex CLI Verification

**Verdict:** SHIP. No CRITICAL findings were reported. Two real defects were fixed; all HIGH and MEDIUM claims were verified against the current source. `PASS` means a real bug was fixed, `FALSE` means the reported bug is not present, and `SKIP` means a LOW-priority suggestion was deferred.

**Build verification:** `npm run build 2>&1 | tail -5` — exit 0 (`✓ built in 686ms`).

| Finding | Severity | Verdict | Verification |
|---|---:|:---:|---|
| Pass 2 HIGH-1 — undefined `user` in `resumeCheckoutIntent` | HIGH | PASS | `payments.js` dereferenced undeclared `user` in the valid-intent path. Added authenticated-user lookup and a retryable unauthenticated result before the profile query. |
| Pass 2 MEDIUM-1 — unstable `tr` dependency | MEDIUM | FALSE | `useLocalizedText.js:17-20` wraps `tr` in `useCallback([section, t])`; the reference is stable while its inputs are stable. Keeping `tr` in the effect dependencies is correct. |
| Pass 2 MEDIUM-2 — stale cancel-subscription origins | MEDIUM | PASS | The file contained both `https://mowgo.pages.dev` and localhost. Removed both; only `https://mowgoapp.com` remains. |
| Pass 2 LOW-1 — wildcard CORS in payment functions | LOW | SKIP | Defense-in-depth suggestion; authenticated functions were not shown exploitable. |
| Pass 2 LOW-2 — localhost in rain-delay SMS origins | LOW | SKIP | Low-priority production-hardening suggestion deferred. |
| Pass 2 LOW-3 — weather-push production URL fallback | LOW | SKIP | Low-priority fail-closed hardening deferred. |
| Pass 2 LOW-4 — module-scope FCM token cache | LOW | FALSE | The report itself notes per-isolate caching is valid and loss on isolate recycle only causes re-authentication. |
| Today — undefined `_currentDemoUserId` / timer cleanup | MEDIUM | FALSE | The cited code is in `data.js`, not `Today.jsx`; `_currentDemoUserId` exists at `data.js:1253`. The 100 ms delay is awaited inside `ensureClientCoords` and does not schedule a component state update. Line references are inaccurate. |
| Today — stale `jobsRef.current` | MEDIUM | FALSE | `jobsRef` is synchronized from `jobs` at `Today.jsx:96`; handlers intentionally read `.current` at execution time to avoid stale closures. |
| Today — inline render allocations | LOW | SKIP | Performance suggestion without demonstrated impact. |
| Today — missing error boundaries | LOW | SKIP | Architectural suggestion, not a verified defect in the cited components. |
| Dashboard — fetch effect lacks cleanup | MEDIUM | FALSE | The effect sets `mounted = false` in cleanup and checks it after awaits and before every relevant state update. |
| Dashboard — weather effect race | MEDIUM | FALSE | The effect sets `active = false` in cleanup and guards both resolved updates and the final loading update. |
| Dashboard — dependency-array inconsistency | LOW | FALSE | `mounted` is an effect-local lifecycle flag, not a dependency; `tr` is memoized. |
| Dashboard — lead interval leak | LOW | FALSE | `subscribeToNewLeads` returns cleanup that removes the channel and clears `pollTimer` (`data.js:845-848`); `App.jsx` returns that cleanup from its effect. The cited Dashboard line is inaccurate. |
| DataStore — `Double` currency / `tipAmount` | HIGH | FALSE | Currency models use `Decimal`; Double is limited to the JSON/RPC boundary and rounded to cents by `centsDouble`. Reported line 2084 is an invoice-status guard, not `tipAmount`; no `tipAmount` exists in the file. |
| DataStore — force unwraps at 1548/1750 | MEDIUM | FALSE | Line 1548 closes a catch block and line 1750 inserts a lead. Neither is a force unwrap; the claimed symbols do not occur. |
| DataStore — invoice creation race | MEDIUM | FALSE | The cited lines are queued mutation replay, and invoice creation uses the idempotent `create_invoice_for_job` RPC with database conflict handling. A local pre-check is not the integrity boundary. |
| DataStore — magic `60.0` | LOW | SKIP | Low-priority naming/style suggestion; cited line does not match the claim. |
| AuthService — force unwraps at 470/519 | MEDIUM | FALSE | `AuthService.swift` is only 240 lines and contains no force unwraps of `auth` or `uid`; both cited lines are impossible. |
| AuthService — generic catch | LOW | SKIP | Low-priority error-handling suggestion; cited line is outside the file. |
| AuthService — profile-update thread safety | LOW | FALSE | The class is `@MainActor`, so its mutable state and profile update methods are actor-isolated. Cited lines are outside the file. |
| PaymentView — Double currency | HIGH | FALSE | `PaymentView` uses `invoice.amountCents`; the model derives cents from `Decimal` using `NSDecimalRound`. Lines 155/209 are plan-card display fields/UI, not currency arithmetic. |
| PaymentView — force unwrap at 190 | MEDIUM | FALSE | Line 190 closes a computed property; there is no optional force unwrap in the payment flow. |
| send-push — broad catches / generic errors | MEDIUM | FALSE | Line 93 imports an APNS key and line 316 builds an FCM notification. Failures retain provider status/detail and are logged; the cited lines do not support the claim. |
| send-push — missing async timeout | LOW | FALSE | FCM uses `AbortSignal.timeout(10_000)` and APNS also uses an explicit timeout. |
| send-push — `any` types | LOW | SKIP | General type-quality suggestion without a specific defect. |
| Stripe webhook — broad catches / generic errors | MEDIUM | FALSE | Line 197 begins signature verification; malformed signatures correctly fail closed. Line 235 is whitespace before configuration validation. The cited lines do not support masking a processing failure. |
| Stripe webhook — awaits lack error boundaries | LOW | FALSE | The cited helper catches fetch failures and returns the documented no-match result; top-level event processing has its own error response path. |
| `data.js` — manual invoice validation bypass | MEDIUM | FALSE | Line 1095 creates an **estimate**, not an invoice. It validates client presence and a finite positive amount at 1085-1086; invoice creation elsewhere uses the RPC/DB constraints. |
| Demo-mode behavior/data-shape differences | LOW | SKIP | Broad low-priority consistency suggestions without a concrete failing path. |
| General missing memoization | LOW | SKIP | Broad performance suggestion without evidence of a regression. |
| General inconsistent error handling | LOW | SKIP | Broad style suggestion without a specific actionable defect. |
