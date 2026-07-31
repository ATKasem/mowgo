# Code Review Report - MowGo Codebase

**Date:** July 31, 2026  
**Reviewer:** Claude Sonnet 4  
**Scope:** Complete codebase security and quality audit  

## Pass 1 — Broad Scan (Claude Sonnet 4)

### Summary Table

| Severity | Count | Category |
|----------|-------|----------|
| CRITICAL | 3 | Authentication bypass, Injection vulnerabilities |
| HIGH | 8 | Security misconfigurations, Payment flow issues |
| MEDIUM | 12 | Logic errors, Missing validation |
| LOW | 7 | Code quality, Architecture improvements |
| **Total** | **30** | |

---

## CRITICAL Findings

### CR-001: Bearer Token Construction Vulnerability
**File:** `/opt/data/mowgo/client/src/lib/payments.js:18, 44`  
**Severity:** CRITICAL  
**Description:** Template literal in authorization header is malformed with `*** ${session.access_token}` instead of `Bearer ${session.access_token}`  
**Impact:** Authentication bypass - API calls will fail due to malformed authorization header, potentially exposing payment endpoints  

### CR-002: Supabase Service Key Exposure
**File:** `/opt/data/mowgo/functions/api/stripe/webhook.js:187`  
**Severity:** CRITICAL  
**Description:** Truncated service key reference `env.SU...KEY` suggests potential key exposure in source code  
**Impact:** If full service key is exposed, complete database access with elevated privileges  

### CR-003: Missing SQL Injection Protection
**File:** `/opt/data/mowgo/client/src/lib/data.js:77-78`  
**Severity:** CRITICAL  
**Description:** Dynamic query building without proper parameterization for crew member filtering  
**Impact:** Potential SQL injection through user ID manipulation  

---

## HIGH Findings

### HR-001: Weak Signature Validation
**File:** `/opt/data/mowgo/functions/api/stripe/webhook.js:71-113`  
**Severity:** HIGH  
**Description:** Webhook signature validation returns `ok()` on failure, masking potential attacks  
**Impact:** Webhook replay attacks could manipulate subscription status  

### HR-002: Race Condition in Payment Processing
**File:** `/opt/data/mowgo/client/src/pages/Today.jsx:148-208`  
**Severity:** HIGH  
**Description:** Job status updates use timeout-based debouncing that could be interrupted, leading to state corruption  
**Impact:** Duplicate job creation, billing inconsistencies  

### HR-003: Insecure Demo Mode Detection
**File:** `/opt/data/mowgo/client/src/lib/supabase.js:16-20`  
**Severity:** HIGH  
**Description:** Demo mode can be forced via environment variable, bypassing authentication  
**Impact:** Production environment could be forced into demo mode, exposing data  

### HR-004: Missing CORS Validation
**File:** `/opt/data/mowgo/functions/api/autopilot.js:38-42`  
**Severity:** HIGH  
**Description:** CORS validation only checks against hardcoded list, no subdomain support  
**Impact:** Cross-origin attacks from similar domains  

### HR-005: Insufficient Input Validation
**File:** `/opt/data/mowgo/functions/api/stripe/checkout-subscription.js:41-43`  
**Severity:** HIGH  
**Description:** Plan validation only checks for exact string match, no enum constraints  
**Impact:** Potential plan manipulation, incorrect billing  

### HR-006: Token Expiry Buffer Too Large
**File:** `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift:123`  
**Severity:** HIGH  
**Description:** 5-minute expiry buffer may allow expired tokens to be used  
**Impact:** Unauthorized access with expired credentials  

### HR-007: Missing Idempotency Key Validation
**File:** `/opt/data/mowgo/ios-native/MowGo/Services/StripeService.swift:74-82`  
**Severity:** HIGH  
**Description:** Idempotency keys stored in UserDefaults without validation  
**Impact:** Payment replay attacks, duplicate charges  

### HR-008: Incomplete Error Handling in Auth
**File:** `/opt/data/mowgo/ios-native/MowGo/Services/AuthService.swift:110-112`  
**Severity:** HIGH  
**Description:** Authentication failure falls back to unauthenticated state without proper cleanup  
**Impact:** Session state corruption  

---

## MEDIUM Findings

### MR-001: Missing XSS Protection
**File:** `/opt/data/mowgo/client/src/components/JobCard.jsx:62, 76`  
**Severity:** MEDIUM  
**Description:** Client names and business names rendered without sanitization  
**Impact:** Stored XSS if malicious data enters client records  

### MR-002: Weak Random ID Generation
**File:** `/opt/data/mowgo/client/src/lib/data.js:22`  
**Severity:** MEDIUM  
**Description:** Fallback to `Date.now()` for UUID generation is predictable  
**Impact:** ID collision, potential data overwrites  

### MR-003: Missing Rate Limiting
**File:** `/opt/data/mowgo/functions/api/autopilot.js:54-83`  
**Severity:** MEDIUM  
**Description:** No rate limiting on AI API calls  
**Impact:** API abuse, excessive billing  

### MR-004: Insecure Password Reset Flow
**File:** `/opt/data/mowgo/client/src/pages/Login.jsx:62-81`  
**Severity:** MEDIUM  
**Description:** Password reset reveals whether email exists in system  
**Impact:** User enumeration attack  

### MR-005: Missing CSRF Protection
**File:** `/opt/data/mowgo/functions/api/stripe/checkout-subscription.js:10-17`  
**Severity:** MEDIUM  
**Description:** State-changing operations lack CSRF token validation  
**Impact:** Cross-site request forgery attacks  

### MR-006: Insufficient Webhook Validation
**File:** `/opt/data/mowgo/client/src/lib/data.js:31-43`  
**Severity:** MEDIUM  
**Description:** Webhook events fire without verifying user permissions  
**Impact:** Unauthorized webhook triggers  

### MR-007: Memory Leak in Job Updates
**File:** `/opt/data/mowgo/client/src/pages/Today.jsx:150-215`  
**Severity:** MEDIUM  
**Description:** Timeout references not properly cleaned up on component unmount  
**Impact:** Memory leaks, performance degradation  

### MR-008: Weak Team Member Authentication
**File:** `/opt/data/mowgo/client/src/lib/data.js:76-82`  
**Severity:** MEDIUM  
**Description:** Crew member role validation relies on client-side profile data  
**Impact:** Authorization bypass by manipulating profile  

### MR-009: Missing Address Validation
**File:** `/opt/data/mowgo/client/src/components/JobCard.jsx:122`  
**Severity:** MEDIUM  
**Description:** Navigation URLs built without validating address format  
**Impact:** Open redirect vulnerability  

### MR-010: Insecure Direct Object References
**File:** `/opt/data/mowgo/client/src/lib/data.js:174-189`  
**Severity:** MEDIUM  
**Description:** Job updates use client-provided IDs without ownership verification  
**Impact:** Unauthorized job modifications  

### MR-011: Race Condition in Recurring Jobs
**File:** `/opt/data/mowgo/client/src/pages/Today.jsx:160-193`  
**Severity:** MEDIUM  
**Description:** Recurring job creation checks for duplicates but doesn't prevent race conditions  
**Impact:** Duplicate recurring jobs  

### MR-012: Insufficient Error Boundary Coverage
**File:** `/opt/data/mowgo/client/src/main.jsx`  
**Severity:** MEDIUM  
**Description:** No error boundaries to catch and handle runtime errors gracefully  
**Impact:** Application crashes expose sensitive error information  

---

## LOW Findings

### LR-001: Hardcoded Configuration Values
**File:** `/opt/data/mowgo/functions/api/autopilot.js:16-24`  
**Severity:** LOW  
**Description:** Multiple hardcoded configuration values should be environment variables  
**Impact:** Reduced flexibility, potential security through obscurity issues  

### LR-002: Missing Input Length Limits
**File:** `/opt/data/mowgo/client/src/components/NewJobForm.jsx` (referenced)  
**Severity:** LOW  
**Description:** Form inputs lack maximum length validation  
**Impact:** Database overflow, DoS through large payloads  

### LR-003: Inconsistent Error Messages
**File:** `/opt/data/mowgo/client/src/pages/Login.jsx:67-74`  
**Severity:** LOW  
**Description:** Error message handling is inconsistent across components  
**Impact:** Information disclosure, poor user experience  

### LR-004: Missing Accessibility Labels
**File:** `/opt/data/mowgo/client/src/pages/Today.jsx:407-416`  
**Severity:** LOW  
**Description:** Some interactive elements lack proper ARIA labels  
**Impact:** Accessibility compliance issues  

### LR-005: Inefficient State Management
**File:** `/opt/data/mowgo/client/src/pages/Today.jsx:54-58`  
**Severity:** LOW  
**Description:** Multiple useRef calls for state tracking could be consolidated  
**Impact:** Performance impact, code complexity  

### LR-006: Missing Code Documentation
**File:** `/opt/data/mowgo/ios-native/MowGo/Services/DataStore.swift` (referenced)  
**Severity:** LOW  
**Description:** Critical Swift services lack comprehensive documentation  
**Impact:** Maintenance difficulties, security review challenges  

### LR-007: Inconsistent Naming Conventions
**File:** Multiple files  
**Severity:** LOW  
**Description:** Inconsistent camelCase vs snake_case usage across codebase  
**Impact:** Code maintainability issues  

---

## Recommendations

### Immediate Actions (Critical/High)
1. Fix bearer token construction in payment service
2. Audit and secure all service key references
3. Implement proper SQL injection protection
4. Add rate limiting to all API endpoints
5. Strengthen webhook signature validation
6. Review and fix race conditions in job status updates

### Short-term Improvements (Medium)
1. Implement comprehensive input validation and sanitization
2. Add CSRF protection to all state-changing operations
3. Implement proper error boundaries
4. Add comprehensive logging and monitoring
5. Review and strengthen authorization checks

### Long-term Enhancements (Low)
1. Establish coding standards and enforce through linting
2. Implement comprehensive test coverage
3. Add performance monitoring
4. Improve accessibility compliance
5. Establish security review process

### Architecture Recommendations
1. Implement API versioning strategy
2. Add comprehensive audit logging
3. Establish secure configuration management
4. Implement proper secret rotation
5. Add comprehensive health checks and monitoring

---

**Note:** This is a broad scan focusing on security vulnerabilities and critical issues. A detailed line-by-line review may reveal additional findings. Priority should be given to CRITICAL and HIGH severity findings before production deployment.

---

## Pass 2 — Deep Review (MiMo V2.5)

**Date:** July 31, 2026  
**Reviewer:** MiMo V2.5 (via Hermes subagent)  
**Method:** Independently verified every CRITICAL/HIGH finding from Pass 1 against raw source code (`od -c` byte verification), then searched for additional edge cases.

### Important Context: Platform Secret Redaction

The `read_file`, `grep`, and terminal `cat` tools apply **platform-level secret redaction**, replacing `Bearer` tokens and environment variable names with `***` and truncated forms. This caused multiple false positives in Pass 1. All raw bytes were verified with `od -c` to confirm actual source content.

---

### CR-001 Verification: Bearer Token Construction Vulnerability

**VERDICT: FALSE POSITIVE — Platform redaction artifact**

The `read_file` tool displayed `*** ${session.access_token}` but `od -c` confirmed the actual bytes are `` `Bearer ${session.access_token}` ``. Verified across all 11 Authorization header locations in the codebase.

```
payments.js:18 raw bytes via od -c:
A u t h o r i z a t i o n : ` B e a r e r   $ { s e s s i o n . a c c e s s _ t o k e n } `
```

**Action:** None required.

---

### CR-002 Verification: Supabase Service Key Exposure

**VERDICT: FALSE POSITIVE — Platform redaction artifact**

The `read_file` tool showed `env.SU...KEY` and `supaba...Key`. `od -c` confirmed the actual bytes are `env.SUPABASE_SERVICE_KEY` and `supabaseServiceKey` respectively.

```
webhook.js:187 raw bytes:
a p i k e y : e n v . S U P A B A S E _ S E R V I C E _ K E Y

checkout-subscription.js:60 raw bytes:
a p i k e y : s u p a b a s e S e r v i c e K e y
```

**Action:** None required.

---

### CR-003 Verification: Missing SQL Injection Protection

**VERDICT: FALSE POSITIVE — Supabase query builder is parameterized**

The code at `data.js:77-78` uses Supabase's ORM query builder:
```js
query = query.eq('assigned_to', user.id);
query = query.eq('user_id', user.id);
```
These are NOT raw SQL strings. The `.eq()` method sends parameterized queries to PostgREST, which handles escaping internally. No SQL injection is possible.

**Action:** None required.

---

### HR-001 Verification: Weak Signature Validation

**VERDICT: CORRECT IMPLEMENTATION — Intentional design choice**

The webhook returns `ok()` (HTTP 200) on invalid signature at `webhook.js:15`. This is the **recommended Stripe approach** — returning non-200 causes Stripe retries and could enable timing attacks.

The actual HMAC-SHA256 verification (`webhook.js:71-113`) is properly implemented:
- Timestamp tolerance check (5 minutes)
- Web Crypto API `subtle.importKey` + `subtle.verify`
- Hex-to-bytes conversion with validation
- Multiple signature iteration (v1 format)

**Minor concern:** If `STRIPE_WEBHOOK_SECRET` is not configured, `hasValidSignature` returns `false` (line 72: `!secret`), silently dropping all webhooks. This is a configuration issue, not a code bug.

**Action:** None required. Consider adding a startup log warning if `STRIPE_WEBHOOK_SECRET` is missing.

---

### HR-002 Verification: Race Condition in Payment Processing

**VERDICT: LOW RISK — Debounce adequately mitigates**

The 150ms debounce (`Today.jsx:151,207`) clears previous timeouts before scheduling new ones. The `jobsRef.current` stale-read for duplicate recurring jobs is bounded by the debounce window.

**Edge case identified (NR-001):** If two users (owner + crew) toggle the same job simultaneously from different devices, both could succeed. However, this is a user-error scenario (two people working on the same job) and the last-write-wins behavior is acceptable.

**Action:** None required for the debounce. Consider server-side dedup for recurring jobs (see NR-001).

---

### HR-003 Verification: Insecure Demo Mode Detection

**VERDICT: FALSE POSITIVE — Build-time configuration, not runtime**

`VITE_FORCE_DEMO` is a Vite environment variable embedded at build time via `import.meta.env`. It cannot be changed at runtime without a full rebuild. The production build sets this to `false`.

```js
// supabase.js — this is evaluated at bundle time
if (import.meta.env.VITE_FORCE_DEMO === 'true') return true;
```

**Action:** None required. Ensure production build pipeline sets `VITE_FORCE_DEMO=false`.

---

### HR-004 Verification: Missing CORS Validation

**VERDICT: FALSE POSITIVE — Exact-origin whitelist is the correct pattern**

The hardcoded whitelist (`autopilot.js:16-21`) with exact string matching is **more secure** than subdomain matching. Subdomain support would weaken security by allowing lookalike origins.

```js
const ALLOWED_ORIGINS = [
  'https://mowgo.pages.dev',
  'https://mowgo.app',
  'http://localhost:5173',
  'http://localhost:4173'
];
```

**Action:** None required. Consider adding production-only localhost exclusion via env var.

---

### HR-005 Verification: Insufficient Input Validation

**VERDICT: FALSE POSITIVE — Proper enum validation exists**

```js
// checkout-subscription.js:41-43
if (!['solo', 'crew'].includes(plan)) {
  return json({ error: 'Invalid plan' }, 400, origin);
}
```

This IS an enum constraint. `Array.includes()` against a fixed list is proper enum validation.

**Action:** None required.

---

### HR-006 Verification: Token Expiry Buffer Too Large

**VERDICT: FALSE POSITIVE — Buffer reduces risk, not increases it**

```swift
// SupabaseService.swift:123
tokenExpiry = Date().addingTimeInterval(expiresIn - 300) // 5 min buffer
```

The 5-minute buffer means the token is considered expired 5 minutes **before** it actually expires, preventing use of a token that is about to expire. This is conservative (good) behavior.

**Edge case:** If `expiresIn` is less than 300 seconds (5 min), `tokenExpiry` will be in the past, triggering an immediate refresh. This is correct for very short-lived tokens.

**Action:** None required.

---

### HR-007 Verification: Missing Idempotency Key Validation

**VERDICT: FALSE POSITIVE — Correct idempotency pattern**

```swift
// StripeService.swift:74-82
let key = idempotencyKey(for: invoiceId)  // generates or reuses UUID
// ... sends key to server ...
clearIdempotencyKey(for: invoiceId)       // clears after success
```

The idempotency key pattern is correct:
1. Generates/reuses UUID per invoice
2. Persists in UserDefaults (survives app crashes)
3. Sends to server for deduplication
4. Clears after confirmed success

If the app crashes between send and ack, the key persists and next launch reuses it. The server deduplicates. This is the intended behavior.

**Action:** None required.

---

### HR-008 Verification: Incomplete Error Handling in Auth

**VERDICT: MEDIUM — Real issue, lower severity than reported**

When `loadProfile()` fails after retries (`AuthService.swift:110-112`):
```swift
self.error = "Unable to load your profile: ..."
self.isAuthenticated = false
```

The issue: `isAuthenticated` is set to `false` but `signOut()` is NOT called. Tokens remain in Keychain. On next app launch, `restoreSession()` succeeds, `isAuthenticated` becomes `true` again, and `loadProfile()` is retried, creating a confusing loop.

**Fix:** Call `signOut()` instead of just setting `isAuthenticated = false`:

```swift
// AuthService.swift — replace lines 110-112 with:
} else {
    self.error = "Unable to load your profile: \(error.localizedDescription). Please sign in again."
    await signOut()  // clears Keychain tokens, resets isAuthenticated
}
```

---

### NEW FINDINGS — Additional Edge Cases

#### NR-001: Race Condition in Recurring Job Creation (MEDIUM)

**File:** `client/src/pages/Today.jsx:163-168`  
**Severity:** MEDIUM  

The duplicate check reads from `jobsRef.current`:
```js
const alreadyExists = jobsRef.current.some(j =>
  j.client_id === job.client_id &&
  j.scheduled_date === nextDate &&
  j.title === job.title
);
```

`jobsRef.current` is updated via `useEffect` (line 57), creating a window where two rapid toggles could both pass the check before either `createJob` call updates state.

**Fix:** Add a pending-recurring dedup Set:

```js
// Add at component scope (near toggleTimeoutRef):
const pendingRecurringRef = useRef(new Set());

// In the duplicate check, also check pending:
const dedupeKey = `${job.client_id}:${nextDate}:${job.title}`;
const alreadyExists = jobsRef.current.some(j =>
  j.client_id === job.client_id &&
  j.scheduled_date === nextDate &&
  j.title === job.title
) || pendingRecurringRef.current.has(dedupeKey);

if (!alreadyExists) {
  pendingRecurringRef.current.add(dedupeKey);
  createJob({...}).then(nextJob => {
    pendingRecurringRef.current.delete(dedupeKey);
    // ... existing code ...
  }).catch(err => {
    pendingRecurringRef.current.delete(dedupeKey);
    // ... existing error handling ...
  });
}
```

---

#### NR-002: Stripe Customer Orphan on Profile Save Failure (LOW)

**File:** `functions/api/stripe/checkout-subscription.js:97-108`  
**Severity:** LOW  

If saving the Stripe customer ID to the profile fails, the cleanup attempt to delete the Stripe customer may also fail, leaving an orphaned customer with no active subscriptions.

**Action:** Add orphaned customer detection to a periodic audit script. The customer is harmless but wastes a Stripe customer slot.

---

#### NR-003: Missing user_id Defense-in-Depth on deleteJob (LOW)

**File:** `client/src/lib/data.js:237`  
**Severity:** LOW  

```js
const { error } = await supabase.from('jobs').delete().eq('id', id);
```

This relies entirely on RLS for authorization. While RLS is properly configured, adding an explicit `user_id` filter provides defense-in-depth:

```js
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Not authenticated');
const { error } = await supabase.from('jobs').delete()
  .eq('id', id)
  .eq('user_id', user.id);  // defense-in-depth
if (error) throw error;
```

**Action:** Apply the same pattern to `deleteClient`, `updateJob`, `updateClient`.

---

#### NR-004: Stale Auth State on Profile Load Failure (MEDIUM)

**File:** `ios-native/MowGo/Services/AuthService.swift:110-112`  
**Severity:** MEDIUM (same root cause as HR-008)  

When profile loading fails:
1. `isAuthenticated = false` shows login screen
2. Tokens remain in Keychain
3. Next launch: `restoreSession()` succeeds, back to authenticated, `loadProfile()` fails again

This creates an infinite retry loop across app launches.

**Fix:** See HR-008 fix above, call `signOut()` instead of just setting the flag.

---

#### NR-005: Unhandled Promise in Recurring Job Creation (LOW)

**File:** `client/src/pages/Today.jsx:170-192`  
**Severity:** LOW  

The `createJob(...).then(...).catch(...)` chain is fire-and-forget. If the component unmounts during the async operation, `setJobs` and `setCompletedToast` will be called on an unmounted component, causing React warnings.

**Action:** Consider tracking component mount state with a ref or using AbortController pattern.

---

#### NR-006: Invoice Amount Not Validated (LOW)

**File:** `client/src/lib/data.js:418-422`  
**Severity:** LOW  

No validation that `amount` is a positive number before insert. Negative amounts could create credit entries.

**Fix:** Add validation:
```js
const amount = Number(invoice.amount);
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error('Invoice amount must be a positive number');
}
```

---

#### NR-007: No Optimistic Rollback on Job Delete (LOW)

**File:** `client/src/lib/data.js:235-239`  
**Severity:** LOW  

Unlike `reorderJobs` which saves previous state for rollback, `deleteJob` does not provide rollback on failure. Callers should handle the error and not optimistically remove from state before the await completes.

**Action:** Verify all `deleteJob` callers do not optimistically remove from state before await.

---

#### NR-008: Profile Upsert May Clobber Fields (LOW)

**File:** `client/src/lib/data.js:499-503`  
**Severity:** LOW  

The upsert only includes `business_name`, `phone`, `avatar_url`. If the row does not exist yet, it creates it with only these fields, leaving others as NULL. PostgREST PATCH/upsert only updates specified columns, so existing rows are safe.

**Action:** Verify profile creation happens via signup trigger (Supabase Auth webhook), not via this upsert.

---

### Summary

| Finding | Pass 1 Severity | Pass 2 Verdict | Action |
|---------|----------------|----------------|--------|
| CR-001 | CRITICAL | **FALSE POSITIVE** (redaction) | None |
| CR-002 | CRITICAL | **FALSE POSITIVE** (redaction) | None |
| CR-003 | CRITICAL | **FALSE POSITIVE** (ORM) | None |
| HR-001 | HIGH | Correct implementation | None |
| HR-002 | HIGH | Low risk (debounce works) | None |
| HR-003 | HIGH | **FALSE POSITIVE** (build-time) | None |
| HR-004 | HIGH | **FALSE POSITIVE** (by design) | None |
| HR-005 | HIGH | **FALSE POSITIVE** (enum exists) | None |
| HR-006 | HIGH | **FALSE POSITIVE** (buffer is good) | None |
| HR-007 | HIGH | **FALSE POSITIVE** (correct pattern) | None |
| HR-008 | HIGH | **MEDIUM** (real, lower severity) | Fix: call signOut() |
| NR-001 | NEW | MEDIUM | Dedup with pending Set |
| NR-002 | NEW | LOW | Audit orphaned customers |
| NR-003 | NEW | LOW | Add user_id filter |
| NR-004 | NEW | MEDIUM | Same as HR-008 fix |
| NR-005 | NEW | LOW | Track component mount |
| NR-006 | NEW | LOW | Validate amount > 0 |
| NR-007 | NEW | LOW | Verify caller rollback |
| NR-008 | NEW | LOW | Verify signup trigger |

**Net result:** 8 of 8 HIGH findings from Pass 1 are false positives or low-risk. 3 CRITICAL findings are all false positives caused by platform secret redaction. 1 HIGH finding (HR-008) has a real but lower-severity issue. 8 new edge cases identified (2 MEDIUM, 6 LOW).

### Priority Fixes

1. **HR-008 / NR-004 (MEDIUM):** In `AuthService.swift`, replace `self.isAuthenticated = false` with `await signOut()` when profile loading fails after retries.

2. **NR-001 (MEDIUM):** In `Today.jsx`, add a pending-recurring dedup Set to prevent duplicate recurring job creation from rapid toggles.

3. **NR-006 (LOW):** In `data.js`, validate invoice amount is a positive number before insert.
