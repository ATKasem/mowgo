# MowGo Code Review — 2026-07-29
## Pass 1 — Broad Structural Scan (Claude Sonnet 4)

### Summary
This review analyzed the MowGo lawn care SaaS application across React client, iOS Swift app, Supabase edge functions, Cloudflare Pages functions, and database schema. The codebase shows a mature architecture but contains several critical security vulnerabilities and implementation issues that require immediate attention.

**Issues by Severity:**
- **CRITICAL**: 8 issues (authentication bypass, SQL injection risks, hardcoded secrets)
- **HIGH**: 12 issues (authorization gaps, error handling, state management)
- **MEDIUM**: 15 issues (UX problems, technical debt, validation gaps)
- **LOW**: 8 issues (code quality, naming, minor improvements)

**Key Areas of Concern:**
- Multiple authentication header malformation vulnerabilities
- Missing input validation and SQL injection protection
- Insecure credential handling in edge functions
- Authorization bypass opportunities in RLS policies
- State management inconsistencies across platforms

---

### CRITICAL

#### C1. Authentication Header Malformation (Multiple Files)
**Files**: `/opt/data/mowgo/client/src/lib/payments.js:583`, `/opt/data/mowgo/functions/api/stripe/webhook.js:138,186`, `/opt/data/mowgo/functions/api/stripe/checkout-subscription.js:33,59,73,90`, `/opt/data/mowgo/ios-native/edge-functions/create-payment-intent/index.ts:36,108`

**Issue**: Template literal syntax errors in Authorization headers cause authentication to fail silently or expose malformed tokens.

Examples:
- `Authorization: *** ${session.access_token}` (missing "Bearer ")
- `Authorization: *** ${env.STRIPE_SECRET_KEY}` (missing "Bearer ")
- `Authorization: *** ${env.SUPABASE_SERVICE_KEY}` (missing "Bearer ")

**Impact**: Complete authentication bypass, API calls failing silently, potential credential exposure.

**Fix**: Correct all authorization headers to use proper Bearer token format:
```javascript
Authorization: `Bearer ${token}`
```

#### C2. SQL Injection via Unvalidated User Input
**Files**: `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift:343,353,360,367`

**Issue**: User IDs and query parameters concatenated directly into URLs without proper escaping.

```swift
q["user_id"] = "eq.\(uid.uuidString)"
let path = "/rest/v1/\(table)?select=*&user_id=eq.\(uid.uuidString)"
```

**Impact**: Potential for SQL injection if UUID parsing fails or is bypassed.

**Fix**: Use parameterized queries or proper URL encoding for all user inputs.

#### C3. Hardcoded Configuration Exposure
**Files**: `/opt/data/mowgo/client/src/lib/supabase.js`, `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift:62-69`

**Issue**: Configuration checks allow placeholder values like "YOUR_PROJECT_URL" to pass validation, potentially exposing endpoints.

**Impact**: Development credentials or endpoints could leak to production.

**Fix**: Implement strict validation to reject placeholder/template values in configuration.

#### C4. Authentication State Race Condition
**Files**: `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift:256-299`

**Issue**: Concurrent refresh token operations can cause authentication state corruption due to shared `refreshTask` handling.

**Impact**: Users may be unexpectedly signed out or experience authentication failures.

**Fix**: Implement proper locking mechanism for refresh operations.

#### C5. Stripe Webhook Signature Bypass
**Files**: `/opt/data/mowgo/functions/api/stripe/webhook.js:13-16`

**Issue**: Invalid webhook signatures return success (200 OK) instead of error, potentially allowing replay attacks.

```javascript
if (!await hasValidSignature(body, signature, env.STRIPE_WEBHOOK_SECRET)) {
  // Do not reveal signature validity or invite repeated malicious deliveries.
  return ok(); // ❌ Should return error
}
```

**Impact**: Malicious actors can forge webhook events, leading to billing manipulation.

**Fix**: Return appropriate error codes for invalid signatures while avoiding signature oracle attacks.

#### C6. iOS Keychain Migration Vulnerability
**Files**: `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift:207-221`

**Issue**: Migration from UserDefaults to Keychain leaves sensitive tokens in UserDefaults briefly, creating a race condition window.

**Impact**: Sensitive authentication tokens could be accessed by malicious apps during migration.

**Fix**: Secure the migration process with atomic operations and immediate cleanup.

#### C7. Edge Function CORS Bypass
**Files**: `/opt/data/mowgo/functions/api/stripe/checkout-subscription.js:14-17`

**Issue**: Origin validation can be bypassed with null origin or by omitting the Origin header.

**Impact**: Cross-origin attacks against payment endpoints.

**Fix**: Implement strict origin validation with explicit allowlists and require Origin header.

#### C8. APNs Private Key Exposure Risk
**Files**: `/opt/data/mowgo/supabase/functions/send-push/index.ts:64-67`

**Issue**: APNs private key PEM parsing uses string replacement that could fail silently, potentially logging full keys.

**Impact**: APNs private keys could be exposed in logs or error messages.

**Fix**: Use secure PEM parsing libraries and ensure no key material appears in logs.

---

### HIGH

#### H1. Team Member Authorization Gaps
**Files**: `/opt/data/mowgo/client/src/pages/Settings.jsx:86-100`, `/opt/data/mowgo/client/src/lib/data.js:600-650`

**Issue**: Team member operations lack proper role-based authorization checks on the client side and in database policies.

**Impact**: Crew members might be able to perform owner-only operations.

**Fix**: Implement comprehensive server-side role checks and update RLS policies.

#### H2. Demo Mode Data Leakage
**Files**: `/opt/data/mowgo/client/src/lib/data.js:22-25`

**Issue**: Demo mode uses hardcoded user ID that could conflict with real user data if the UUID exists.

```javascript
let _demoCurrentUserId = 'demo-owner-001'; // Could be a real UUID
```

**Impact**: Demo users might see real user data or vice versa.

**Fix**: Use guaranteed non-conflicting demo identifiers or separate demo database.

#### H3. Incomplete Error Handling in Payment Flow
**Files**: `/opt/data/mowgo/ios-native/MowGo/Services/StripeService.swift:50-67`

**Issue**: Payment creation errors are not fully handled, potentially leaving invoices in inconsistent states.

**Impact**: Failed payments might not be properly tracked, leading to billing issues.

**Fix**: Implement comprehensive error handling with proper state rollback.

#### H4. Concurrent Job Modification Race Condition
**Files**: `/opt/data/mowgo/client/src/lib/data.js:200-250`

**Issue**: Job updates don't use optimistic locking, allowing concurrent modifications to overwrite each other.

**Impact**: Job data corruption when multiple users modify the same job.

**Fix**: Implement optimistic locking with version numbers or timestamps.

#### H5. Insufficient Input Validation
**Files**: `/opt/data/mowgo/client/src/components/NewJobForm.jsx:19-50`

**Issue**: Form inputs lack proper validation for required fields, data types, and business rules.

**Impact**: Invalid data could be submitted to the database, causing application errors.

**Fix**: Add comprehensive client-side and server-side validation.

#### H6. Device Token Management Vulnerabilities
**Files**: `/opt/data/mowgo/supabase/functions/send-push/index.ts:244-249`

**Issue**: Push notification authorization only checks self-sending but doesn't validate team relationships for crew features.

**Impact**: Team members might not receive appropriate notifications.

**Fix**: Implement proper team-based authorization for push notifications.

#### H7. Subscription Tier Downgrade Handling
**Files**: `/opt/data/mowgo/functions/api/stripe/webhook.js:48-62`

**Issue**: Subscription downgrades don't properly handle data access restrictions for exceeded limits.

**Impact**: Users might retain access to premium features after downgrading.

**Fix**: Implement immediate feature restriction on subscription changes.

#### H8. Photo Upload Path Traversal Risk
**Files**: `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift:307`

**Issue**: File path construction doesn't validate UUID format, potentially allowing path traversal.

**Impact**: Photos could be uploaded to unauthorized locations.

**Fix**: Validate UUID format and sanitize file paths.

#### H9. Incomplete Offline Data Synchronization
**Files**: `/opt/data/mowgo/client/src/lib/offlineStorage.js`

**Issue**: Offline storage implementation referenced but not found in codebase, suggesting incomplete offline functionality.

**Impact**: Data loss when users work offline.

**Fix**: Implement complete offline synchronization with conflict resolution.

#### H10. Session Management Inconsistencies
**Files**: `/opt/data/mowgo/client/src/App.jsx`, various components

**Issue**: Authentication state management inconsistent between React app and native iOS app.

**Impact**: Users might experience authentication issues when switching between platforms.

**Fix**: Standardize authentication state management across platforms.

#### H11. Webhook Endpoint Security
**Files**: `/opt/data/mowgo/functions/api/stripe/webhook.js:25-30`

**Issue**: Webhook endpoint configuration validation incomplete, could allow unconfigured webhooks to process.

**Impact**: Webhook events might be processed without proper configuration, leading to data corruption.

**Fix**: Add comprehensive configuration validation before webhook processing.

#### H12. Database Connection Pool Exhaustion
**Files**: Multiple Supabase client instantiations across codebase

**Issue**: Multiple Supabase client instances created without proper connection management.

**Impact**: Database connection pool exhaustion under high load.

**Fix**: Implement singleton pattern for Supabase client instances.

---

### MEDIUM

#### M1. Inconsistent Internationalization
**Files**: `/opt/data/mowgo/client/src/i18n/es.json`, `/opt/data/mowgo/client/src/i18n/en.json`

**Issue**: Spanish translations incomplete, some keys missing or using English fallbacks.

**Impact**: Poor user experience for Spanish-speaking users.

**Fix**: Complete all translations and implement fallback validation.

#### M2. Memory Leak in iOS Service
**Files**: `/opt/data/mowgo/ios-native/MowGo/Services/SupabaseService.swift:129`

**Issue**: Cached user ID never cleared except on sign out, could lead to stale data.

**Impact**: Users might see outdated information after profile changes.

**Fix**: Implement cache invalidation strategy.

#### M3. Inconsistent Date Handling
**Files**: Various components handling dates

**Issue**: Date formatting and timezone handling inconsistent across platforms.

**Impact**: Scheduling conflicts and user confusion.

**Fix**: Standardize date handling with proper timezone management.

#### M4. Accessibility Issues in Forms
**Files**: `/opt/data/mowgo/client/src/components/NewJobForm.jsx`

**Issue**: Form controls missing proper ARIA labels and keyboard navigation support.

**Impact**: Poor accessibility for users with disabilities.

**Fix**: Add comprehensive accessibility attributes and keyboard navigation.

#### M5. Performance Issues in Team Member Display
**Files**: `/opt/data/mowgo/client/src/pages/Settings.jsx:261-284`

**Issue**: Team member colors calculated on every render instead of being memoized.

**Impact**: Unnecessary re-renders and performance degradation.

**Fix**: Memoize color calculations and optimize rendering.

#### M6. Incomplete Error Recovery
**Files**: Multiple components with try-catch blocks

**Issue**: Error handling often shows generic messages without actionable recovery options.

**Impact**: Poor user experience when errors occur.

**Fix**: Implement specific error messages with recovery actions.

#### M7. Hardcoded Configuration Values
**Files**: `/opt/data/mowgo/client/src/lib/constants.js`, various files

**Issue**: Configuration values hardcoded instead of being environment-configurable.

**Impact**: Difficulty in deploying to different environments.

**Fix**: Move configuration to environment variables.

#### M8. Inconsistent Loading States
**Files**: Various components

**Issue**: Loading states implemented differently across components, creating inconsistent UX.

**Impact**: Confusing user experience with different loading indicators.

**Fix**: Standardize loading state patterns across the application.

#### M9. Missing Rate Limiting
**Files**: `/opt/data/mowgo/functions/api/stripe/checkout-subscription.js`

**Issue**: API endpoints lack rate limiting, potentially allowing abuse.

**Impact**: Service abuse and potential DoS attacks.

**Fix**: Implement rate limiting for all API endpoints.

#### M10. Incomplete Logging
**Files**: Various edge functions and services

**Issue**: Insufficient logging for debugging and monitoring.

**Impact**: Difficulty troubleshooting production issues.

**Fix**: Implement comprehensive structured logging.

#### M11. Inconsistent Data Validation
**Files**: Client and server-side validation

**Issue**: Validation rules differ between client and server, potentially causing sync issues.

**Impact**: Data inconsistency and sync errors.

**Fix**: Unify validation rules across client and server.

#### M12. Missing Backup Strategy
**Files**: Database migrations

**Issue**: No backup strategy mentioned for critical user data.

**Impact**: Data loss risk in case of system failures.

**Fix**: Implement comprehensive backup and recovery procedures.

#### M13. Timezone Handling Gaps
**Files**: Date/time handling across the application

**Issue**: Timezone handling not consistently implemented.

**Impact**: Scheduling errors for users in different timezones.

**Fix**: Implement comprehensive timezone management.

#### M14. Mobile Responsiveness Issues
**Files**: `/opt/data/mowgo/client/src/pages/*.jsx`

**Issue**: Some components not fully responsive on mobile devices.

**Impact**: Poor mobile user experience.

**Fix**: Enhance mobile responsiveness across all components.

#### M15. Performance Monitoring Gaps
**Files**: Entire application

**Issue**: Limited performance monitoring and metrics collection.

**Impact**: Difficulty identifying and resolving performance issues.

**Fix**: Implement comprehensive performance monitoring.

---

### LOW

#### L1. Code Style Inconsistencies
**Files**: Various JavaScript and TypeScript files

**Issue**: Inconsistent code formatting and style across files.

**Impact**: Reduced code maintainability.

**Fix**: Implement and enforce consistent code style with linters.

#### L2. Unused Import Statements
**Files**: Multiple React components

**Issue**: Several components have unused import statements.

**Impact**: Increased bundle size and code clutter.

**Fix**: Remove unused imports and implement import optimization.

#### L3. Magic Numbers in Configuration
**Files**: Various files with hardcoded timeouts and limits

**Issue**: Magic numbers used without explanatory constants.

**Impact**: Reduced code readability and maintainability.

**Fix**: Replace magic numbers with named constants.

#### L4. Inconsistent Naming Conventions
**Files**: Various files

**Issue**: Variable and function names don't follow consistent patterns.

**Impact**: Reduced code readability.

**Fix**: Establish and enforce naming conventions.

#### L5. Missing JSDoc Comments
**Files**: JavaScript and TypeScript functions

**Issue**: Many functions lack proper documentation.

**Impact**: Reduced code maintainability and developer onboarding.

**Fix**: Add comprehensive JSDoc comments to all public functions.

#### L6. Redundant Conditional Checks
**Files**: Various components

**Issue**: Some conditional checks are redundant or could be simplified.

**Impact**: Increased complexity and potential for bugs.

**Fix**: Simplify conditional logic where possible.

#### L7. Inconsistent Error Message Format
**Files**: Error handling across the application

**Issue**: Error messages use different formats and styles.

**Impact**: Inconsistent user experience.

**Fix**: Standardize error message formatting and presentation.

#### L8. Missing TypeScript Types
**Files**: JavaScript files that could benefit from TypeScript

**Issue**: Some files lack proper type definitions.

**Impact**: Reduced type safety and IDE support.

**Fix**: Add TypeScript types where beneficial or convert files to TypeScript.

---

## Recommendations

### Immediate Actions Required (CRITICAL Issues)
1. **Fix all authentication header malformations** - This could completely break authentication
2. **Review and fix SQL injection vulnerabilities** - Immediate security risk
3. **Secure webhook signature validation** - Prevents billing fraud
4. **Implement proper CORS validation** - Prevents cross-origin attacks

### Short-term Improvements (HIGH Priority)
1. **Implement comprehensive role-based authorization**
2. **Add proper error handling and recovery mechanisms**
3. **Fix race conditions in concurrent operations**
4. **Implement proper input validation throughout**

### Medium-term Enhancements (MEDIUM Priority)
1. **Complete internationalization support**
2. **Improve accessibility compliance**
3. **Implement performance monitoring**
4. **Add comprehensive logging and monitoring**

### Long-term Code Quality (LOW Priority)
1. **Standardize code style and conventions**
2. **Improve documentation coverage**
3. **Enhance type safety with TypeScript migration**
4. **Optimize bundle size and performance**

This review identified 43 issues across the MowGo codebase. The most critical issues involve authentication and security vulnerabilities that should be addressed immediately to prevent data breaches and service disruptions.

---

## Pass 2 — Deep Review (MiMo V2.5)

### Verified findings from Pass 1

#### CRITICAL

**C1. Authentication Header Malformation — CONFIRMED (Partial)**
- **Status**: Debunked. All Authorization headers I checked use correct `Bearer ` prefix.
- **Evidence**: `webhook.js:138` → `Bearer ${env.STRIPE_SECRET_KEY}`, `checkout-subscription.js:103` → `Bearer ${env.STRIPE_SECRET_KEY}`, `payments.js:18` → `Bearer ${session.access_token}`.
- **Note**: Pass 1 likely misread the source. No remediation needed.

**C2. SQL Injection via Unvalidated User Input — CONFIRMED (Low Risk)**
- **Status**: Real but low risk. UUID interpolation is safe because `UUID(uuidString:)` enforces format, but URL encoding is only applied in the generic `fetch()` method (line 346), not in `fetchJobs()` or `fetchInvoices()`.
- **Risk**: If a UUID string were malformed (unlikely due to type system), it could inject query parameters.
- **Severity downgrade**: LOW (UUID type safety in Swift prevents exploitation).

**C3. Hardcoded Configuration Exposure — CONFIRMED**
- **Status**: Real. `isConfigured` property (line 76) correctly rejects `YOUR_` prefixes, but `supabase.js:3-4` defaults to `https://demo.supabase.co` and `demo-key`, which would be used if env vars are missing.
- **Risk**: Production builds could silently use demo credentials.
- **Fix**: Fail hard if env vars are missing in production.

**C4. Authentication State Race Condition — DEBUNKED**
- **Status**: `SupabaseService` is declared as `actor` (line 15), which provides proper thread isolation in Swift concurrency. `refreshTask` (line 256) correctly deduplicates concurrent refresh attempts by awaiting an existing task.
- **Note**: This is well-implemented actor isolation. No remediation needed.

**C5. Stripe Webhook Signature Bypass — CONFIRMED (Intentional)**
- **Status**: Real but intentional design. Returning 200 for invalid signatures prevents Stripe from retrying (which would reveal whether the webhook secret is configured).
- **Risk**: If `STRIPE_WEBHOOK_SECRET` is misconfigured, ALL requests silently succeed, meaning forged events would be processed.
- **Fix**: Add monitoring/alerting when webhook secret is missing.

**C6. iOS Keychain Migration Vulnerability — DEBUNKED**
- **Status**: Migration (lines 203-221) is atomic within a single function call. UserDefaults values are read, written to Keychain, then deleted in sequence with no yield point between them.
- **Risk**: Minimal — no window for concurrent access during migration.

**C7. Edge Function CORS Bypass — DEBUNKED**
- **Status**: Line 15 `if (!origin || !ALLOWED_ORIGINS.includes(origin))` correctly rejects requests without an Origin header.
- **Note**: Pass 1 incorrectly claimed null origin bypass was possible.

**C8. APNs Private Key Exposure Risk — CONFIRMED**
- **Status**: Real. PEM parsing (line 64-67) uses string replacement that could fail silently if the PEM format is unexpected. No explicit error logging for key parsing failures.
- **Fix**: Add error handling for malformed PEM.

#### HIGH

**H1. Team Member Authorization Gaps — DEBUNKED (Server-side)**
- **Status**: Demo mode validates owner permissions (lines 613, 639). Real mode delegates to authenticated API endpoints (`/api/team/invite`, `/api/team/:id`). RLS policies on the server enforce role-based access.
- **Note**: Client-side checks are defense-in-depth; server-side is authoritative.

**H2. Demo Mode Data Leakage — CONFIRMED (Low Risk)**
- **Status**: Real. `demo-owner-001` is not a valid UUID, so it cannot collide with real Supabase UUIDs.
- **Risk**: Minimal in practice, but using a clearly non-existent format is fragile.
- **Fix**: Use a UUID v4 that starts with `00000000-0000-0000-0000-` prefix.

**H3. Incomplete Error Handling in Payment Flow — DEBUNKED**
- **Status**: `create-payment-intent` (lines 136-153) now uses `.select().maybeSingle()` and checks `saveErr || !savedInvoice`. `confirm-payment` (lines 148-175) checks `updateErr || !updatedInvoice` and returns appropriate error codes.
- **Note**: Previous QA pass addressed this. Payment flow is well-handled.

**H4. Concurrent Job Modification Race Condition — CONFIRMED**
- **Status**: Real. `updateJob` (line 189) does not use optimistic locking. Two concurrent updates can overwrite each other.
- **Fix**: Add `updated_at` timestamp check or version field.

**H5. Insufficient Input Validation — CONFIRMED**
- **Status**: Real. `NewJobForm` has `required` on client select but no validation on `title` (allows empty), `duration_minutes` (allows any value), or business rules.
- **Fix**: Add client-side validation and server-side constraints.

**H6. Device Token Management Vulnerabilities — CONFIRMED**
- **Status**: Real. Push notifications (line 244) only allow self-sending. Team features are not implemented, so crew members cannot receive push notifications from the owner.
- **Fix**: Implement team-based notification with proper authorization checks.

**H7. Subscription Tier Downgrade Handling — CONFIRMED**
- **Status**: Real. Webhook handler (lines 56-61) sets tier to 'free' on subscription deletion but does not revoke access to premium features immediately.
- **Fix**: Implement feature gating based on current tier.

**H8. Photo Upload Path Traversal Risk — DEBUNKED**
- **Status**: Path construction (line 307) uses UUID strings which cannot contain path separators. UUID format is `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

**H9. Incomplete Offline Data Synchronization — DEBUNKED**
- **Status**: `offlineStorage.js` does not exist in the codebase. This appears to be a non-issue — the app is online-only.

**H10. Session Management Inconsistencies — CONFIRMED**
- **Status**: Real. iOS uses Keychain-backed session storage, React uses Supabase client with localStorage (`storageKey: 'mowgo-auth'`). JWT refresh mechanisms differ.
- **Fix**: Document platform-specific auth behavior and ensure consistent session lifecycle.

**H11. Webhook Endpoint Security — DEBUNKED**
- **Status**: `requireConfiguration(env)` (line 34) validates all required env vars before processing. Webhook processing fails closed if config is incomplete.

**H12. Database Connection Pool Exhaustion — CONFIRMED (Low Risk)**
- **Status**: React app uses singleton Supabase client. iOS uses actor-based singleton. Risk is low with modern HTTP/2 connection pooling.
- **Note**: Not a practical issue for current scale.

### New findings

#### DEEP-001: Stripe Customer Orphaned on Profile Save Failure (HIGH)

**File**: `functions/api/stripe/checkout-subscription.js:69-98`

**Issue**: When a new Stripe customer is created (line 70-83) but the profile save fails (line 85-96), the Stripe customer is orphaned. The function throws, but the Stripe customer object remains in Stripe with no database reference.

**Impact**: Orphaned Stripe customers accumulate, making it impossible to associate future payments with the correct profile. Customer count limits on Stripe may be hit.

**Fix**: Wrap customer creation and profile save in a transaction-like pattern, or use Stripe customer metadata to allow lookup by email:
```javascript
// After creating customer in Stripe:
const saveResponse = await fetch(
  `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stripe_customer_id: customerId }),
  },
);
if (!saveResponse.ok) {
  // Clean up: delete the orphaned Stripe customer
  await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  throw new Error('Could not save Stripe customer');
}
```

#### DEEP-002: Webhook Signature Failure Silently Processes Events (MEDIUM)

**File**: `functions/api/stripe/webhook.js:13-16`

**Issue**: When `STRIPE_WEBHOOK_SECRET` is not configured, `hasValidSignature` returns `false` (line 72), but the function returns `ok()` (line 15) instead of an error. If the secret is misconfigured in production, ALL webhook events are silently accepted without signature verification.

**Impact**: An attacker could forge webhook events to manipulate subscription tiers or billing state.

**Fix**: Check if the webhook secret is configured before accepting requests:
```javascript
if (!env.STRIPE_WEBHOOK_SECRET) {
  console.error('STRIPE_WEBHOOK_SECRET not configured — rejecting webhook');
  return new Response('Webhook not configured', { status: 500 });
}
if (!await hasValidSignature(body, signature, env.STRIPE_WEBHOOK_SECRET)) {
  return new Response('Invalid signature', { status: 401 });
}
```

#### DEEP-003: iOS Idempotency Key Stored in UserDefaults (MEDIUM)

**File**: `ios-native/MowGo/Services/StripeService.swift:87-101`

**Issue**: Payment idempotency keys are stored in `UserDefaults.standard` (unencrypted) rather than Keychain. While not a direct security risk (the key is a random UUID, not a secret), it violates the principle of storing payment-related data in secure storage.

**Impact**: If the device is compromised, idempotency keys could be extracted. In practice, this is low risk since the keys are random UUIDs.

**Fix**: Move idempotency key storage to Keychain using the same `saveToKeychain`/`loadFromKeychain` pattern used for auth tokens.

#### DEEP-004: Race Condition in Demo Mode State Updates (LOW)

**File**: `client/src/lib/data.js:114-172`

**Issue**: Demo mode state updates (`_jobs`, `_clients`, etc.) are not atomic. Multiple rapid operations (e.g., creating a job while deleting another) could interleave state updates. In practice, this is mitigated by JavaScript's single-threaded nature, but React concurrent mode could expose this.

**Impact**: Minimal in current implementation, but could cause UI inconsistencies if React concurrent features are enabled.

**Fix**: Use a state machine or immutable state pattern for demo mode updates.

#### DEEP-005: Missing Input Sanitization in Team Invite (MEDIUM)

**File**: `client/src/lib/data.js:608-634`

**Issue**: `inviteTeamMember` normalizes email (trim + lowercase) but does not validate email format before making the API call. Invalid emails are sent to the server, which may create invitation records for non-existent users.

**Impact**: Database pollution with invalid email records. Potential abuse for email enumeration if error messages differ between existing and non-existing users.

**Fix**: Add email format validation before API call:
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(normalizedEmail)) {
  throw new Error('Invalid email format');
}
```

#### DEEP-006: SupabaseService URL Construction Without Encoding (LOW)

**File**: `ios-native/MowGo/Services/SupabaseService.swift:346,353,360,367`

**Issue**: While the generic `fetch()` method (line 346) applies URL encoding, the specialized methods `fetchJobs()`, `fetchInvoices()`, and `fetchProfile()` construct URLs without encoding the UUID values.

**Impact**: UUIDs are always safe (only contain hex characters and hyphens), so this is not exploitable. However, it violates defense-in-depth.

**Fix**: Apply consistent URL encoding across all methods, or document why UUIDs are safe without encoding.

#### DEEP-007: APNs Token Generation Missing Error Handling (MEDIUM)

**File**: `supabase/functions/send-push/index.ts:54-136`

**Issue**: `generateApnsToken()` does not handle the case where `crypto.subtle.importKey` fails (e.g., if the PEM key is malformed). The error would propagate to the caller, but the error message would be cryptic.

**Impact**: Push notifications fail with unclear error messages when APNs key is misconfigured.

**Fix**: Add explicit error handling for key import failures:
```typescript
let privateKey: CryptoKey;
try {
  privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
} catch (e) {
  throw new Error(`Failed to import APNs key: ${e instanceof Error ? e.message : "unknown error"}`);
}
```

#### DEEP-008: Checkout Session Metadata Not Validated (LOW)

**File**: `functions/api/stripe/checkout-subscription.js:112-115`

**Issue**: Metadata fields (`user_id`, `tier`) are passed to Stripe without validation that they match the authenticated user. A malicious client could theoretically pass a different `user_id` in metadata.

**Impact**: Low risk because the webhook handler validates the user via the profile lookup, but defense-in-depth would require server-side metadata validation.

**Fix**: Ensure metadata values match the authenticated user:
```javascript
'metadata[user_id]': user.id,  // Already correct, but verify in webhook
'metadata[tier]': plan,        // Already validated by plan check
```

### Fix code

#### Fix for DEEP-001: Stripe Customer Orphan Cleanup

```javascript
// In checkout-subscription.js, after line 83 (customerId = customer.id):
// Save to profile with rollback on failure
const saveResponse = await fetch(
  `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stripe_customer_id: customerId }),
  },
);
if (!saveResponse.ok) {
  // Attempt to clean up orphaned Stripe customer
  try {
    await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
  } catch (cleanupErr) {
    console.error('Failed to clean up orphaned Stripe customer:', cleanupErr);
  }
  throw new Error('Could not save Stripe customer');
}
```

#### Fix for DEEP-002: Webhook Secret Validation

```javascript
// Replace lines 9-16 in webhook.js:
export async function onRequestPost({ request, env }) {
  // Reject if webhook secret is not configured
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook not configured', { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!await hasValidSignature(body, signature, env.STRIPE_WEBHOOK_SECRET)) {
    // Return 401 to signal invalid signature without revealing details
    return new Response('Invalid signature', { status: 401 });
  }
  // ... rest of handler
```

#### Fix for DEEP-003: Idempotency Key in Keychain

```swift
// In StripeService.swift, replace idempotencyKey storage:
private func idempotencyKey(for invoiceId: UUID) -> String {
    let storageKey = "payment_idempotency_\(invoiceId.uuidString)"
    // Use Keychain instead of UserDefaults for payment-related data
    if let existing = loadFromKeychain(key: storageKey),
       !existing.isEmpty {
        return existing
    }
    let key = UUID().uuidString
    saveToKeychain(key: storageKey, value: key)
    return key
}

private func clearIdempotencyKey(for invoiceId: UUID) {
    let storageKey = "payment_idempotency_\(invoiceId.uuidString)"
    deleteFromKeychain(key: storageKey)
}

// Add Keychain helper methods (same as SupabaseService):
private func saveToKeychain(key: String, value: String) {
    let data = Data(value.utf8)
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.mowgo.payments",
        kSecAttrAccount as String: key,
    ]
    SecItemDelete(query as CFDictionary)
    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.mowgo.payments",
        kSecAttrAccount as String: key,
        kSecValueData as String: data,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
    ]
    SecItemAdd(addQuery as CFDictionary, nil)
}

private func loadFromKeychain(key: String) -> String? {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.mowgo.payments",
        kSecAttrAccount as String: key,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
          let data = item as? Data else { return nil }
    return String(data: data, encoding: .utf8)
}

private func deleteFromKeychain(key: String) {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.mowgo.payments",
        kSecAttrAccount as String: key,
    ]
    SecItemDelete(query as CFDictionary)
}
```

#### Fix for DEEP-005: Email Validation

```javascript
// In data.js, add validation at the start of inviteTeamMember:
export async function inviteTeamMember(email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');

  // Validate email format before making API call
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error('Invalid email format');
  }

  // ... rest of function
```

### Summary

| Finding | Status | Severity | Fix Effort |
|---------|--------|----------|------------|
| C1. Auth header malformation | Debunked | - | - |
| C2. SQL injection | Confirmed (low risk) | LOW | 10 min |
| C3. Hardcoded config | Confirmed | MEDIUM | 30 min |
| C4. Auth race condition | Debunked | - | - |
| C5. Webhook signature bypass | Confirmed (intentional) | MEDIUM | 15 min |
| C6. Keychain migration | Debunked | - | - |
| C7. CORS bypass | Debunked | - | - |
| C8. APNs key exposure | Confirmed | MEDIUM | 15 min |
| H1. Team auth gaps | Debunked | - | - |
| H2. Demo data leakage | Confirmed (low risk) | LOW | 5 min |
| H3. Payment error handling | Debunked | - | - |
| H4. Job race condition | Confirmed | HIGH | 1 hr |
| H5. Input validation | Confirmed | MEDIUM | 30 min |
| H6. Device token mgmt | Confirmed | MEDIUM | 2 hr |
| H7. Tier downgrade | Confirmed | MEDIUM | 1 hr |
| H8. Path traversal | Debunked | - | - |
| H9. Offline sync | Debunked | - | - |
| H10. Session inconsistencies | Confirmed | MEDIUM | 2 hr |
| H11. Webhook config | Debunked | - | - |
| H12. Connection pool | Confirmed (low risk) | LOW | 30 min |
| DEEP-001. Stripe customer orphan | NEW | HIGH | 20 min |
| DEEP-002. Webhook secret missing | NEW | MEDIUM | 10 min |
| DEEP-003. Idempotency in UserDefaults | NEW | MEDIUM | 30 min |
| DEEP-004. Demo state race | NEW | LOW | 1 hr |
| DEEP-005. Email validation | NEW | MEDIUM | 10 min |
| DEEP-006. URL encoding inconsistency | NEW | LOW | 15 min |
| DEEP-007. APNs key error handling | NEW | MEDIUM | 10 min |
| DEEP-008. Checkout metadata | NEW | LOW | 5 min |

**Total: 8 debunked, 10 confirmed from Pass 1, 8 new findings identified.**

---

## Pass 3 — Code Quality Review (Qwen3 Coder)

This review focuses exclusively on code quality patterns, anti-patterns, fix correctness, effect dependencies, memoization, promise handling, type safety, and error boundaries.

### React Client Code Quality Issues

#### useEffect Dependency Arrays
1. **Missing Dependencies**: In `AuthProvider` (App.jsx:35-51), the effect hook subscribes to auth state changes but doesn't include any dependencies. While this might be intentional for the Supabase listener, it's worth noting that React hooks should explicitly declare dependencies to prevent issues.

2. **Data Loading Effect**: In the main App component (App.jsx:157-169), the data loading effect correctly includes an empty dependency array since it's meant to run only on mount. However, the cleanup function properly handles component unmounting with `mounted = false`.

#### Error Boundaries
1. **App-Level Error Boundary**: The main App component implements a basic error boundary (App.jsx:88-109) that catches render errors and displays a reload message. This is good practice.

2. **Missing Component-Level Boundaries**: Most individual components don't have their own error boundaries, which could lead to entire page crashes when a single component fails.

#### State Management Patterns
1. **Inconsistent State Updates**: In `data.js`, the demo mode state updates use a direct mutation pattern with `_jobs = [..._jobs, newJob]` followed by `notify()` to trigger re-renders. While functional, this mixes mutable and immutable patterns.

2. **Race Conditions in Demo Mode**: As noted in DEEP-004, the demo mode uses global variables (`_jobs`, `_clients`) with a notification system. Multiple rapid operations could interleave updates, especially if React concurrent features were enabled.

3. **Session Management Inconsistency**: As confirmed in H10, there's inconsistency between React's localStorage-based session management and iOS Keychain-based approach.

#### Memoization Issues
1. **Team Member Color Calculation**: As noted in M5, team member colors in `NewJobForm.jsx` (lines 65-66) are calculated on every render instead of being memoized. This could impact performance when many team members are present.

2. **Missing useMemo for Expensive Operations**: Several components perform potentially expensive operations (e.g., filtering, mapping) within render methods without memoization.

#### Promise Handling
1. **Inconsistent Error Handling**: While most async functions properly handle errors with try/catch, there are inconsistencies in chaining and error propagation:
   - `fireWebhook` function (data.js:31-43) catches all errors to prevent breaking the main flow, but only logs a warning without any UI feedback.
   - `authenticatedApiRequest` (data.js:575-590) has proper error handling but returns generic error messages.

2. **Race Condition Handling**: The `createJob` and `updateJob` functions properly await Supabase operations but don't handle potential race conditions when multiple users might modify the same job simultaneously (as noted in H4).

#### Type Safety
1. **Limited TypeScript Usage**: Most of the React client code is written in JavaScript with minimal type annotations. While JSDoc is used in some places, runtime type checking is largely absent.

2. **Assumed Data Structures**: Many functions assume specific data structures from API responses without proper validation or typing:
   - `loadJobs` assumes job objects have specific fields without validation
   - `fireWebhook` doesn't validate the payload structure before sending

#### Input Validation
1. **Client-Side Validation Only**: While `NewJobForm.jsx` has some basic HTML5 validation, many inputs lack comprehensive validation:
   - Job titles can be empty in `NewJobForm`
   - Duration values aren't validated for business logic (e.g., no maximum limit)
   - Email inputs in forms don't have pattern validation

2. **Missing Server-Side Validation Awareness**: Client code largely assumes server-side validation will catch issues, but there's no feedback mechanism in case of server validation failures.

### iOS Swift Code Quality Issues

#### Swift Concurrency Patterns
1. **Proper Actor Usage**: `SupabaseService` is correctly implemented as an actor (line 15), providing thread isolation for shared mutable state. This is a good pattern for managing authentication state.

2. **Task Deduplication**: The refresh token handling (lines 256-299) properly deduplicates concurrent refresh attempts, which is a solid concurrency pattern.

#### Memory Management
1. **Potential Retain Cycles**: In `StripeService`, the singleton pattern is used but there's no clear deinitialization path. While not necessarily problematic, it's worth noting for long-running apps.

2. **Keychain Storage**: The Keychain storage implementation (lines 151-190 in SupabaseService) follows best practices for iOS security.

#### View Body Complexity
1. **Complex View Builders**: While not visible in the provided files, the general pattern in SwiftUI apps often leads to complex view builders. The code references several View components but doesn't show their implementation details.

#### ObservableObject/@Published Usage
1. **Proper ObservableObject Implementation**: `StripeService` (line 13) correctly uses `@MainActor` and `ObservableObject` protocol for managing state that affects UI.

2. **State Isolation**: Each service properly isolates its state management concerns.

#### Force Unwrapping and Error Handling
1. **Safe Optional Handling**: Most code properly handles optionals with guard statements (e.g., `getCurrentUserId` in SupabaseService:131-145).

2. **Error Propagation**: Errors are properly propagated through the async/await chain with appropriate localized error descriptions.

#### Error Handling Consistency
1. **Structured Error Handling**: All services implement custom error enums (`AuthError`, `SupabaseError`, `StripeError`) with proper localized descriptions, which is a good pattern for consistency.

### Edge Functions Code Quality Issues

#### Promise Handling Patterns
1. **Consistent Async/Await**: Edge functions like `create-payment-intent` use consistent async/await patterns throughout.

2. **Error Propagation**: Errors are properly caught and propagated with appropriate HTTP status codes. However, there's inconsistent error detail exposure:
   - Some errors return detail messages from the backend
   - Others return generic messages to avoid information disclosure

#### Input Validation Consistency
1. **Basic Validation**: Functions validate basic inputs (e.g., `invoice_id` required) but lack comprehensive validation:
   - No validation of UUID format for IDs
   - No validation of currency codes against a whitelist
   - No validation of amount ranges or formats

2. **Consistency in Validation**: While validation exists, it's not consistently applied across all edge functions.

#### Error Response Format Consistency
1. **Inconsistent Error Formats**: Edge functions return different error formats:
   - `create-payment-intent` returns structured JSON with error messages
   - Some functions return status codes without messages
   - Error messages are sometimes generic, sometimes specific

#### Type Safety
1. **Limited Runtime Type Checking**: While Deno/TypeScript provides compile-time safety, runtime type validation is minimal:
   - Basic type checks with `as?` casting in Swift code
   - JSON parsing assumes specific structures without validation

2. **Missing Schema Validation**: No comprehensive schema validation for incoming request payloads.

### Cross-Platform Consistency Issues

#### Authentication Handling
1. **Inconsistent Error Messages**: As discovered in H10, authentication error handling differs between platforms:
   - iOS uses localized error enums
   - React uses console logging primarily
   - Edge functions return HTTP status codes

#### Data Structure Mapping
1. **Inconsistent Field Mapping**: Between platforms, similar data structures have different field names:
   - `service_notes` in React maps to `cleaning_notes` in Supabase (data.js:106, 166, 282)
   - This conversion logic is duplicated across multiple functions

#### State Synchronization
1. **No Explicit Offline Handling**: There's no implementation for offline data synchronization, as noted in H9. This could be an issue for mobile users with intermittent connectivity.

### Fix Correctness Verification

#### Implementation Gaps
1. **Idempotency Key Storage**: As identified in DEEP-003, payment idempotency keys are stored in `UserDefaults` instead of Keychain, which violates the security-first principle established for other sensitive data.

2. **Email Validation**: While DEEP-005 suggests adding email validation, there's no implementation in the iOS code for client-side email format validation.

3. **Stripe Customer Cleanup**: As identified in DEEP-001, there's no implementation for cleaning up orphaned Stripe customers when profile saving fails.

4. **Webhook Secret Validation**: As identified in DEEP-002, there's no check for webhook secret configuration before processing requests.

5. **APNs Token Generation Error Handling**: As identified in DEEP-007, there's no explicit error handling for key import failures in the APNs token generation.

### Recommendations Summary

| Category | Issue | Severity | Recommendation |
|----------|-------|----------|----------------|
| React - State | Demo mode race condition | MEDIUM | Implement immutable state updates with proper locking |
| React - Performance | Color calculation recomputation | MEDIUM | Memoize expensive calculations using useMemo |
| React - Error Handling | Missing component boundaries | MEDIUM | Add granular error boundaries for critical components |
| React - Validation | Incomplete input validation | MEDIUM | Add comprehensive form validation with user feedback |
| iOS - Security | Idempotency keys in UserDefaults | MEDIUM | Move idempotency key storage to Keychain |
| iOS - Consistency | Missing email validation | MEDIUM | Add client-side email validation |
| Edge Functions - Validation | Inconsistent input validation | MEDIUM | Implement uniform validation schema |
| Edge Functions - Error Handling | Inconsistent error responses | MEDIUM | Standardize error response format |
| Cross-Platform | Inconsistent field mapping | MEDIUM | Create unified data mapping layer |
| Cross-Platform | Authentication inconsistency | LOW | Standardize error handling across platforms |

This code quality review identified several areas for improvement that, while not critical security vulnerabilities, would significantly enhance the maintainability, performance, and user experience of the MowGo application. The patterns are generally solid, with most issues being implementation details that could be refined for better robustness.