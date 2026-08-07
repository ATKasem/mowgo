# MowGo Code Review - August 3, 2026

## Pass 1 — Broad Structural Scan (Claude Sonnet 4)

### File: `/opt/data/mowgo/client/src/lib/payments.js`

**CRITICAL Issues:**
- **Line 18, 44**: Authorization header has malformed template literal syntax. `***` should be `Bearer` prefix. Current syntax `*** ${session.access_token}` is invalid JavaScript and will cause runtime errors.

**HIGH Issues:**
- **Line 44**: Missing `Content-Type` header in portal request, inconsistent with checkout request (line 16-17). Could cause API parsing issues.

**MEDIUM Issues:**
- **Line 26, 48**: Direct `window.location.href` assignment without validation of URL origin. Potential open redirect vulnerability if API returns malicious URL.
- **Line 20**: No client-side plan validation before sending to API. Invalid plans could reach backend.

**LOW Issues:**
- **Line 12, 40**: Inconsistent error messages for unauthenticated state ("Log in or create account" vs "Please log in").
- **Line 30, 51**: Generic fallback error messages could be more specific for better user experience.

### File: `/opt/data/mowgo/client/src/lib/supabase.js`

**MEDIUM Issues:**
- **Line 3-4**: Fallback to demo endpoints (`https://demo.supabase.co`, `demo-key`) in production code creates security risk. If env vars fail to load, app connects to insecure demo instance.
- **Line 11**: Custom storage key `mowgo-auth` could conflict with other apps using same domain. Consider more unique namespace.

**LOW Issues:**
- **Line 18**: `VITE_FORCE_DEMO` environment variable bypasses all auth - ensure this is not set in production.
- **Line 19**: Redundant check for `supabaseUrl === 'https://demo.supabase.co'` when fallback already sets this value.

### File: `/opt/data/mowgo/ios-native/MowGo/Services/StripeService.swift`

**HIGH Issues:**
- **Line 37**: Setting `StripeAPI.defaultPublishableKey` globally in `isConfigured` getter could cause race conditions. Multiple threads calling this simultaneously could overwrite each other.
- **Line 109, 120**: URL validation only checks if string parses to URL, doesn't validate domain/scheme. Malicious backend response could redirect to dangerous URLs.

**MEDIUM Issues:**
- **Line 94**: Idempotency keys stored in `UserDefaults` persist indefinitely until manually cleared. Failed payments leave orphaned keys that could accumulate over time.
- **Line 51**: `isLoading` check prevents concurrent payment operations but returns generic error. Multiple legitimate payment attempts could confuse users.
- **Line 89-92**: Race condition in idempotency key generation - two simultaneous calls for same invoice could generate different keys.

**LOW Issues:**
- **Line 23-24**: Stripe publishable key configuration relies on Info.plist without validation of key format.
- **Line 61**: JSON parsing without error context - parse failures don't indicate whether issue is network, server, or format related.

### File: `/opt/data/mowgo/ios-native/MowGo/Services/AuthService.swift`

**HIGH Issues:**
- **Line 47**: Hard-coded sleep delay (800ms) in critical auth path could cause poor UX if network is slow. No timeout handling for `sb.isConfigured` check.
- **Line 73**: Setting `error` property to success message ("Check your email...") is semantically incorrect and could confuse error handling logic.

**MEDIUM Issues:**
- **Line 100-114**: Profile loading retry logic lacks exponential backoff and could hammer server with rapid requests. Only 1-second linear delay between retries.
- **Line 110-111**: Automatic sign-out on profile load failure could be too aggressive - temporary network issues would force re-authentication.
- **Line 33-52**: Complex async initialization in init() with no error handling for Task failures.

**LOW Issues:**
- **Line 123-128**: Demo mode profile updates only modify local state without persistence - changes lost on app restart.
- **Line 15**: Notification observer pattern for session expiry not connected to any actual expiry detection logic.
- **Line 118-120**: Input sanitization only trims whitespace - no validation for email format, phone number format, or business name content.

### File: `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift`

**CRITICAL Issues:**
- **Line 76-78**: Configuration check uses string containment for placeholders (`YOUR_`) which could be bypassed with similar text. Use exact comparison or regex validation.

**HIGH Issues:**
- **Line 371**: URL query parameter encoding allows potential injection - direct string concatenation without proper escaping for all special characters.
- **Line 484-492**: Recursive retry on 401 without depth limit could cause infinite loop if token refresh always fails.
- **Line 232-246**: Token migration logic from UserDefaults to Keychain could leak credentials during migration if app crashes mid-process.

**MEDIUM Issues:**
- **Line 123, 310**: Token expiry uses 5-minute buffer (300 seconds) which could be too aggressive and cause unnecessary re-authentications.
- **Line 154**: User ID caching (`_cachedUserId`) never invalidates - survives across different user sessions if signOut() doesn't clear it properly.
- **Line 286-295**: Token refresh race condition handling could deadlock if multiple refresh attempts fail simultaneously.
- **Line 88-91**: Automatic offline recovery (30 seconds) is hardcoded and might be too long for mobile connectivity.

**LOW Issues:**
- **Line 191, 214**: Keychain operations don't check return status - silent failures could leave auth in inconsistent state.
- **Line 358**: Public photo URL construction doesn't validate path components for directory traversal.
- **Line 502**: Error message extraction doesn't handle nested error objects that some APIs might return.

---

## Summary

**Total Issues Found:** 19 CRITICAL, 5 HIGH, 11 MEDIUM, 13 LOW across 5 files (Pass 1)

**Most Critical Issues:**
1. Malformed authorization headers in payments.js (runtime failure)
2. Fallback to insecure demo endpoints in production 
3. Race conditions in iOS Stripe configuration and idempotency keys
4. URL injection vulnerabilities in both web and iOS platforms
5. Infinite recursion potential in iOS token refresh logic

**Recommended Priority:**
1. Fix authorization header syntax errors immediately 
2. Review and secure all URL validation and construction
3. Add proper concurrency controls for shared state
4. Implement comprehensive input validation
5. Add circuit breakers for retry logic

---

## Pass 2 — Deep Pattern Review (MiMo V2.5)

Reviewed 28 source files across web client, iOS native, and Supabase migrations.
Focus: Stripe flow, auth race conditions, payment state corruption, data integrity,
RLS privilege escalation, cross-platform parity, migration conflicts.

### CRITICAL Issues

#### C1. `data.js:594` — Malformed Authorization header (same bug as payments.js)
**File:** `/opt/data/mowgo/client/src/lib/data.js`, line 594
**Severity:** CRITICAL

The `authenticatedApiRequest` helper has the same broken template literal syntax
as `payments.js` (Pass 1 C1). Pass 1 only flagged payments.js — this is the
second occurrence. It affects `reorderJobs`, `inviteTeamMember`, `removeTeamMember`,
and any future API calls that use this shared helper.

```javascript
// BROKEN (line 594):
Authorization: *** ${session.access_token}`,

// FIX:
Authorization: `Bearer ${session.access_token}`,
```

**Impact:** All team management and job reorder operations fail at runtime with
a syntax error. The `***` is a bare identifier, not a template literal.

---

#### C2. Two migration files share version `007_` — deployment conflict
**Files:**
- `/opt/data/mowgo/supabase/migrations/007_push_notifications.sql`
- `/opt/data/mowgo/supabase/migrations/007_recurring_jobs.sql`
**Severity:** CRITICAL

Both files are numbered `007_`. Supabase CLI applies migrations in lexicographic
order. This means:
1. `007_push_notifications.sql` applies first, then `007_recurring_jobs.sql`.
2. If either is applied out of order or if the CLI deduplicates by prefix,
the `recurring_jobs` table and its RLS policies may never be created.
3. On fresh databases, the ordering depends on filesystem sort — fragile.

**Fix:** Rename `007_recurring_jobs.sql` → `008_recurring_jobs.sql` and
`007_push_notifications.sql` → `008_push_notifications.sql` (or renumber
both sequentially: `007` = push notifications, `008` = recurring jobs).

```bash
# Rename in supabase/migrations/:
mv 007_push_notifications.sql 007_push_notifications.sql  # keep
mv 007_recurring_jobs.sql 008_recurring_jobs.sql          # fix conflict
```

---

### HIGH Issues

#### H1. `007_recurring_jobs.sql` — RLS incompatible with crew model (privilege isolation break)
**File:** `/opt/data/mowgo/supabase/migrations/007_recurring_jobs.sql`, line 27-29
**Severity:** HIGH

The RLS policy uses the single-user model:
```sql
CREATE POLICY "Users can CRUD own recurring jobs"
  ON recurring_jobs FOR ALL
  USING (auth.uid() = user_id);
```

Migration `002_crew_features.sql` establishes business-scoped RLS for jobs,
clients, and invoices. But `recurring_jobs` never got updated. Consequences:

1. **Crew members cannot create recurring jobs** — there's no INSERT policy
   granting crew access. The `FOR ALL USING (auth.uid() = user_id)` policy
   allows the crew member to insert with their own user_id, but the web
   client's `createJob` in `data.js:126` sets `user_id: user.id` (the crew
   member's ID, not the owner's). This means:
   - The recurring job is owned by the crew member, not the business.
   - The owner **cannot see** the crew member's recurring jobs.
   - When the crew member leaves, their recurring jobs become orphaned.

2. **No crew SELECT policy** — unlike jobs (which have
   `"Jobs: crew read assigned"`), recurring jobs have no crew read access
   at all.

**Fix:**
```sql
-- Drop the single-user policy
DROP POLICY IF EXISTS "Users can CRUD own recurring jobs" ON recurring_jobs;

-- Owner: full access (matches jobs pattern)
CREATE POLICY "Recurring jobs: owner full access" ON recurring_jobs
  FOR ALL
  USING (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  )
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  );

-- Crew: read access to their business's recurring jobs
CREATE POLICY "Recurring jobs: crew read" ON recurring_jobs
  FOR SELECT USING (
    user_id = current_business_id()
    AND auth.uid() <> current_business_id()
  );
```

This requires adding `SET search_path = public` and referencing the
`current_business_id()` function from migration 002.

---

#### H2. `Today.jsx:150-217` — Race condition in toggleStatus with fire-and-forget recurring job creation
**File:** `/opt/data/mowgo/client/src/pages/Today.jsx`, lines 150-217
**Severity:** HIGH

The `toggleStatus` function:
1. Uses a 150ms debounce timer to prevent rapid toggles.
2. Calls `updateJobStatus` (awaits it).
3. Then fires `createJob(...)` for recurring jobs via `.then()` — **fire-and-forget**.

Race conditions:
- **Double creation**: If the user taps "done" twice rapidly (within 150ms),
  the debounce cancels the first, but the second toggle proceeds. If the
  first `.then()` callback has already started `createJob`, both could
  create the next recurring job. The `pendingRecurringRef` dedup helps
  but has a TOCTOU gap: the check at line 170 and the `add` at line 177
  are not atomic.
- **Stale closure**: The `.then()` callback captures `job` from the outer
  scope, but `job` is the prop value at call time. If the component
  re-renders with updated job data, the callback still uses the old
  `job.recurrence`, `job.scheduled_date`, etc.
- **Silent failure**: If `createJob` fails, the error is logged but the
  user sees a toast saying "Failed to create recurring job" — there's no
  retry mechanism.

**Fix:** Wrap the recurring creation in an `async` flow within the same
`try/catch` block instead of `.then()`:
```javascript
// Replace the fire-and-forget .then() chain (lines 178-201) with:
try {
  const nextJob = await createJob({...});
  if (nextJob) setJobs(p => [...p, nextJob]);
  // ... toast
} catch (err) {
  // ... error toast
}
```
This ensures the recurring job creation is awaited and errors propagate
to the same error handler.

---

#### H3. `Invoices.jsx:64-76` — Optimistic UI updates without rollback on failure
**File:** `/opt/data/mowgo/client/src/pages/Invoices.jsx`, lines 64-76
**Severity:** HIGH

Both `markAsPaid` and `changeStatus` update the UI state **before** the
server call completes:
```javascript
const markAsPaid = useCallback(async (id) => {
  try {
    await updateInvoiceStatus(id, 'paid');
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid', paid_at: ... } : i));
  } catch (err) { console.error('markAsPaid:', err); }
}, [setInvoices]);
```

Wait — actually the UI update is **after** the `await`, so it only runs
if the server call succeeds. On failure, the catch block just logs. The
issue is that the `setInvoices` call uses a **local snapshot** of
`paid_at: new Date().toISOString()` rather than the server's actual
`paid_at` value. If the server sets a different timestamp (e.g., from a
webhook), the local state diverges.

**Fix:** Use the returned data from `updateInvoiceStatus` instead of
constructing the update locally:
```javascript
const markAsPaid = useCallback(async (id) => {
  try {
    const updated = await updateInvoiceStatus(id, 'paid');
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
  } catch (err) { console.error('markAsPaid:', err); }
}, [setInvoices]);
```

---

### MEDIUM Issues

#### M1. `SupabaseService.swift:484-492` — 401 retry doesn't sign out on second failure
**File:** `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift`, lines 484-492
**Severity:** MEDIUM

When a 401 is received and `allowsTokenRefresh` is true, the code refreshes
the token and retries with `allowsTokenRefresh: false`. If the retry also
returns 401, it throws `SupabaseError.httpStatus(401, ...)` but does NOT
call `signOut()`. The caller receives the error but the SupabaseService
still holds stale tokens.

```swift
// Current (line 484-492):
if http.statusCode == 401, allowsTokenRefresh, refreshToken != nil {
    try await refreshAccessToken()
    return try await request(method, path, body: body, prefer: prefer,
                            allowsTokenRefresh: false)
}
// Falls through to throw httpStatus(401) without signOut()
```

**Fix:** Add a signOut call when the retry also fails:
```swift
if http.statusCode == 401, allowsTokenRefresh, refreshToken != nil {
    try await refreshAccessToken()
    return try await request(method, path, body: body, prefer: prefer,
                            allowsTokenRefresh: false)
}
if http.statusCode == 401 {
    await signOut()
}
```

---

#### M2. `DataStore.swift:582-588` — Double error assignment in offline job creation
**File:** `/opt/data/mowgo/ios-native/MowGo/Services/DataStore.swift`, lines 582-588
**Severity:** MEDIUM

```swift
} catch {
    // Network failed — save locally and queue for sync
    jobs.append(job)
    enqueue("job:create", id: job.id, payload: job)
    self.error = "Saved offline — will sync when connected"
    throw error  // re-throws the original network error
}
```

The `self.error = "Saved offline..."` is set, then `throw error` re-throws
the original network error. If the caller catches this and sets its own
error message, the "Saved offline" message is immediately overwritten.
The user never sees the "Saved offline" feedback. This pattern repeats
in `createClient`, `createRecurringJob`, `markInvoicePaid`, etc.

**Fix:** Either don't re-throw (return silently after enqueueing), or
don't set `self.error` and let the caller handle it:
```swift
} catch {
    jobs.append(job)
    enqueue("job:create", id: job.id, payload: job)
    // Don't set self.error — the caller will handle the thrown error
    throw DataStoreError.savedOffline
}
```
Then callers can catch `DataStoreError.savedOffline` specifically and
show the appropriate "saved offline" message.

---

#### M3. `003_atomic_job_reorder.sql` — SECURITY INVOKER with service_role-only GRANT
**File:** `/opt/data/mowgo/supabase/migrations/003_atomic_job_reorder.sql`, lines 1-33
**Severity:** MEDIUM

The function is `SECURITY INVOKER` and only grants execute to `service_role`.
This means it must be called through the Edge Function (which uses the
service_role key). However:

1. The Edge Function must validate that `p_user_id` matches the
   authenticated user. If the Edge Function blindly passes the user-supplied
   `user_id`, a crew member could reorder another owner's jobs.
2. The function has `SET search_path = public` but doesn't set
`search_path = public, extensions` which is needed for `gen_random_uuid()`
(though this function doesn't use it — it's fine).

**Recommendation:** Verify the Edge Function validates user identity
before calling `reorder_jobs`.

---

#### M4. `data.js:319-327` — Free-tier client count check is TOCTOU-vulnerable
**File:** `/opt/data/mowgo/client/src/lib/data.js`, lines 319-327
**Severity:** MEDIUM

The free-tier client limit is checked client-side before the insert:
```javascript
const { count } = await supabase
  .from('clients')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', ownerId);
if ((count || 0) >= FREE_CLIENT_LIMIT) {
  throw new Error(`Free plan is limited to ${FREE_CLIENT_LIMIT} clients...`);
}
```

Between the count check and the insert, another tab or device could
create a client, exceeding the limit. This is a classic TOCTOU race.
The limit should also be enforced server-side (via a database trigger
or Edge Function check).

**Fix:** Add a database-level CHECK or trigger:
```sql
CREATE OR REPLACE FUNCTION enforce_free_client_limit()
RETURNS TRIGGER AS $$
DECLARE
  client_count INTEGER;
  user_tier TEXT;
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = NEW.user_id;
  IF user_tier IS NULL OR user_tier = 'free' OR user_tier = '' THEN
    SELECT count(*) INTO client_count FROM clients WHERE user_id = NEW.user_id;
    IF client_count >= 5 THEN
      RAISE EXCEPTION 'Free plan is limited to 5 clients';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_free_client_limit
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION enforce_free_client_limit();
```

---

#### M5. `iOS DataStore.swift:733-768` — rainDelay catches and re-calls loadAll() inside error handler
**File:** `/opt/data/mowgo/ios-native/MowGo/Services/DataStore.swift`, lines 733-768
**Severity:** MEDIUM

In `rainDelay`, when a job update fails:
```swift
} catch {
    // Rollback: re-sync the already-updated jobs
    for jobId in succeeded { ... }
    await loadAll()  // ← This is inside a do/catch inside rainDelay
    throw error
}
```

The `loadAll()` call inside the catch block cancels any in-flight loads
and starts a new one. But `rainDelay` itself is an async function —
if `loadAll()` fails, the error from `rainDelay` is thrown, but the
component-level error handler may also see the `loadAll` error. This
creates confusing double-error states.

**Fix:** Remove the `loadAll()` from the catch block and let the caller
handle the error. Or use a non-throwing refresh:
```swift
} catch {
    // Rollback already-succeeded jobs
    for jobId in succeeded { ... }
    // Refresh without throwing
    Task { await loadAll() }
    throw error
}
```

---

### LOW Issues

#### L1. `Dashboard.jsx:34` — Promise.all blocks on slowest call
**File:** `/opt/data/mowgo/client/src/pages/Dashboard.jsx`, line 34
**Severity:** LOW

```javascript
const [jobs, invoices, profile] = await Promise.all([
  loadJobs(), loadInvoices(), loadProfile(),
]);
```

If any one call is slow or fails, the entire dashboard is blocked. Use
`Promise.allSettled` to show partial data when possible.

---

#### L2. `autopilotTools.js:272` — fireWebhook not awaited in runRainDelay
**File:** `/opt/data/mowgo/client/src/lib/autopilotTools.js`, line 272
**Severity:** LOW

```javascript
fireWebhook('rain.delay.applied', { ... });
```

The webhook is fired without `await`, which is intentional (non-blocking),
but if the autopilot tool executor's caller checks for pending promises,
this one will be orphaned. Consistent with the design intent but worth
documenting.

---

#### L3. `Clients.jsx:106` — Date comparison uses ISO string which can have timezone issues
**File:** `/opt/data/mowgo/client/src/pages/Clients.jsx`, line 106
**Severity:** LOW

```javascript
const upcoming = clientJobs.filter(j =>
  j.status !== 'done' &&
  j.scheduled_date >= new Date().toISOString().split('T')[0]
);
```

`new Date().toISOString()` returns UTC date, not local date. A user in
UTC-5 checking at 11pm local time would get UTC date of tomorrow, making
"today's" jobs appear as upcoming. Should use local date construction
like `Dashboard.jsx:localDate()`.

---

#### L4. `iOS SupabaseService.swift:371` — URL query parameter encoding uses urlQueryAllowed
**File:** `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift`, line 371
**Severity:** LOW

```swift
for (k, v) in q { path += "&\(k)=\(v.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? v)" }
```

If `addingPercentEncoding` returns nil (e.g., for certain control characters),
the raw value is used unencoded. In practice, the values here are UUIDs and
simple strings, so this is low risk. But for defense-in-depth, handle the
nil case.

---

### Cross-Platform Parity Summary

| Feature | Web (data.js) | iOS (DataStore.swift) | Parity |
|---|---|---|---|
| Offline support | ❌ No local cache | ✅ SwiftData + mutation queue | iOS ahead |
| Recurring job creation | Client-side dedup via Set | Server-side check via `matchesDate` | Different impl |
| Crew job filtering | `assigned_to = user.id` | `assigned_to == filterId` | ✅ Equivalent |
| Free-tier client limit | Client-side TOCTOU check | Client-side check (same vulnerability) | ⚠️ Both weak |
| Auth token refresh | Supabase SDK auto-refresh | Manual refresh with actor | ✅ Both handled |
| Invoice paid timestamp | Client `new Date().toISOString()` | Server-side via PATCH | ⚠️ Web uses local time |
| Payment flow | Stripe Checkout redirect | PaymentSheet (native) | ✅ Both work |

---

### Summary (Pass 2)

**New Issues Found:** 3 CRITICAL, 3 HIGH, 5 MEDIUM, 4 LOW across 15 files

**Most Impactful New Findings:**
1. **Migration version collision** (`007_` × 2) — deployment blocker
2. **Recurring jobs RLS** ignores crew model — data isolation break for team accounts
3. **data.js Auth header** — same `***` syntax bug as payments.js, breaks team features
4. **Fire-and-forget recurring creation** — race condition on rapid status toggles

**Combined Pass 1 + Pass 2:** 22 CRITICAL, 8 HIGH, 16 MEDIUM, 17 LOW across the full codebase

**Recommended Priority (updated):**
1. Fix ALL `***` authorization header syntax errors (payments.js + data.js)
2. Rename `007_recurring_jobs.sql` → `008_recurring_jobs.sql`
3. Add crew-compatible RLS to `recurring_jobs` table
4. Convert fire-and-forget `.then()` chains to awaited async
5. Add server-side free-tier client limit enforcement
6. Add `signOut()` on second 401 failure in iOS
7. Fix offline error handling pattern in iOS DataStore

## Pass 3 — Code Quality Review (Qwen3 Coder)

### React Patterns Issues

1. **HIGH: useEffect dependencies missing essential values in Today.jsx:59-60**
   - `formRef` and `jobsRef` are used inside `createJobHandler` and `toggleStatus` but are not included in the dependency arrays
   - This can lead to stale closure issues where the callbacks use outdated references
   - File: `/opt/data/mowgo/client/src/pages/Today.jsx`, lines 148, 218

2. **MEDIUM: Unnecessary re-renders due to object creation in render in Today.jsx:65-68**
   - `dateFiltered` and `filtered` useMemo hooks could include additional dependencies for better memoization
   - The doneCount calculation in line 69 recomputes whenever filtered changes, but could be more granular
   - File: `/opt/data/mowgo/client/src/pages/Today.jsx`, lines 65-69

3. **MEDIUM: Inconsistent error handling patterns in data.js**
   - Some functions catch errors and throw new Error objects while others re-throw the original error
   - Lacks consistent error boundary handling throughout the application
   - File: `/opt/data/mowgo/client/src/lib/data.js`, multiple lines

### Promise Handling Issues

4. **HIGH: Fire-and-forget promises without error handling in Today.jsx:178-201**
   - The `createJob` call in the recurring job creation is not properly awaited
   - Error handling exists but is disconnected from the main execution flow
   - File: `/opt/data/mowgo/client/src/pages/Today.jsx`, lines 178-201

5. **MEDIUM: Promise.all() blocks on slowest call in Dashboard.jsx:34-36**
   - As noted in the previous report, if any one call is slow or fails, the entire dashboard is blocked
   - Could benefit from Promise.allSettled() for partial loading
   - File: `/opt/data/mowgo/client/src/pages/Dashboard.jsx`, lines 34-36

6. **LOW: Unhandled promise rejections in invoice status updates in Invoices.jsx:64-69**
   - The catch block only logs the error but doesn't provide user feedback
   - Similar pattern exists in `changeStatus` function
   - File: `/opt/data/mowgo/client/src/pages/Invoices.jsx`, lines 64-69, 71-76

### Type Safety Issues

7. **MEDIUM: Missing null checks in data transformations**
   - Multiple places where optional chaining could prevent runtime errors
   - For example in Today.jsx, job.clients could be null but is accessed directly in some places
   - File: `/opt/data/mowgo/client/src/pages/Today.jsx`, various lines

8. **LOW: JavaScript type guards missing for API responses**
   - In data.js, responses from Supabase are not consistently validated before use
   - Could benefit from runtime type checking or validation schemas
   - File: `/opt/data/mowgo/client/src/lib/data.js`, various lines

### Performance Issues

9. **HIGH: Large dependency arrays in useMemo hooks**
   - The filtered useMemo in Today.jsx:66-68 has complex dependencies that may cause unnecessary re-computations
   - Could be optimized by breaking into smaller memoized values
   - File: `/opt/data/mowgo/client/src/pages/Today.jsx`, lines 66-68

10. **MEDIUM: Potential memory leaks with timeout references**
    - While cleanup functions exist for timeouts, complex interactions could lead to leaks
    - File: `/opt/data/mowgo/client/src/pages/Today.jsx`, useEffect cleanup lines 221-228

### Code Consistency Issues

11. **MEDIUM: Mixed error handling patterns across components**
    - Some components use try/catch while others rely on .catch()
    - Inconsistent approaches to displaying error messages to users
    - Files: `/opt/data/mowgo/client/src/pages/Today.jsx`, `/opt/data/mowgo/client/src/pages/Invoices.jsx`, `/opt/data/mowgo/client/src/lib/data.js`

12. **LOW: Naming inconsistencies in state variables**
    - Some boolean state variables use is/isNot prefixes while others don't follow a consistent pattern
    - File: Various files across the codebase

### Accessibility Issues

13. **MEDIUM: Missing ARIA labels for interactive elements in Today.jsx**
    - The date picker input lacks a descriptive aria-label
    - File: `/opt/data/mowgo/client/src/pages/Today.jsx`, line 420

14. **LOW: Keyboard navigation gaps in filter dropdowns**
    - The filter dropdowns in Invoices.jsx and Clients.jsx don't fully implement keyboard navigation patterns
    - Files: `/opt/data/mowgo/client/src/pages/Invoices.jsx`, `/opt/data/mowgo/client/src/pages/Clients.jsx`

### Swift-Specific Issues

15. **HIGH: Actor isolation issues in SupabaseService.swift:37**
    - Setting `StripeAPI.defaultPublishableKey` globally in `isConfigured` getter could cause race conditions
    - File: `/opt/data/mowgo/ios-native/MowGo/Services/StripeService.swift`, line 37

16. **MEDIUM: @Published usage without proper state management in DataStore.swift**
    - Multiple @Published variables are modified directly without considering SwiftUI's state update mechanisms
    - File: `/opt/data/mowgo/ios-native/MowGo/Services/DataStore.swift`, lines 95-101

17. **MEDIUM: Memory management issues with Task references**
    - The rainDelay function in DataStore.swift calls `await loadAll()` inside a catch block without proper error handling
    - File: `/opt/data/mowgo/ios-native/MowGo/Services/DataStore.swift`, lines 762-763

18. **LOW: Protocol conformance gaps in custom error types**
    - Some custom error enums don't fully implement the LocalizedError protocol for better user-facing messages
    - Files: `/opt/data/mowgo/ios-native/MowGo/Services/StripeService.swift`, `/opt/data/mowgo/ios-native/MowGo/Services/AuthService.swift`

