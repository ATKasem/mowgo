# Fixes Applied — July 31, 2026

## Source
Code review pipeline: Claude Sonnet 4 → MiMo V2.5 → Qwen3 Coder → Codex CLI
Report: `code-review-2026-07-31.md`

## Summary

| Severity | Count | Action |
|----------|-------|--------|
| CRITICAL | 3 | All FALSE POSITIVES (platform redaction artifacts) |
| HIGH | 8 | 7 false positives, 1 real (HR-008, lowered to MEDIUM) |
| MEDIUM | 2 | Both fixed |
| LOW | 6 | 1 fixed (NR-006), rest verified as low-risk |
| NEW BUG | 1 | Per-job toggle debounce (found by Codex, not in report) |

## Fixes Applied

### Fix 1: AuthService.swift — Stale Auth State (HR-008 / NR-004)
**File:** `ios-native/MowGo/Services/AuthService.swift:108`
**Problem:** On profile load failure after retries, `self.isAuthenticated = false` left stale tokens in Keychain, causing inconsistent auth state.
**Fix:** Changed to `await signOut()` which properly clears Keychain tokens via `AuthService.signOut()` → `SupabaseService.signOut()`.
```diff
- self.isAuthenticated = false
+ await signOut()
```

### Fix 2: Today.jsx — Recurring Job Race Condition (NR-001)
**File:** `client/src/pages/Today.jsx:51-224`
**Problem:** Shared `toggleTimeoutRef` allowed rapid toggles on different jobs to cancel each other's timeout. Recurring job creation had no in-flight dedup.
**Fix:** 
- Per-job toggle timeouts via `statusToggleTimeoutsRef` (Map<jobId, timeoutId>)
- In-flight recurring dedup via `pendingRecurringRef` (Set<dedupeKey>)
- Cleanup on unmount iterates and clears all tracked timeouts

### Fix 3: data.js — Invoice Amount Validation (NR-006)
**File:** `client/src/lib/data.js:409-411`
**Problem:** No validation that invoice amount is a positive number. Negative amounts could create credit entries.
**Fix:** Added validation at top of `createInvoice()`:
```js
const amount = Number(invoice.amount);
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error('Invoice amount must be a positive number');
}
```

### Additional Fix: Per-Job Toggle Debounce (Codex)
**File:** `client/src/pages/Today.jsx`
**Problem:** The old `toggleTimeoutRef` was a single shared ref — toggling Job A then Job B would cancel Job A's pending update.
**Fix:** Replaced shared ref with per-job Map (`statusToggleTimeoutsRef`), each job gets its own tracked timeout.

## Build Verification

```
npm run build — PASSED
✓ 1891 modules transformed
dist/index.html       0.75 kB
dist/assets/index.css 94.78 kB
dist/assets/index.js  885.38 kB
Built in 593ms
```

Only pre-existing bundle-size warning (no new issues).

## Codex CLI Verdict

- CR-001: FALSE POSITIVE — Bearer headers correctly constructed
- CR-002: FALSE POSITIVE — Service key from server env, not embedded
- CR-003: FALSE POSITIVE — Supabase `.eq()` uses parameterized queries
- NR-002: Not actionable in client (needs backend Stripe webhook handling)
- NR-003: Not actionable in client (RLS handles row-level security)
- NR-005: Low risk (React 18+ auto-batching mitigates unmounted updates)
- NR-007: Verified — no `deleteJob` callers optimistically remove from state
- NR-008: Verified — profile creation uses Supabase Auth signup trigger
