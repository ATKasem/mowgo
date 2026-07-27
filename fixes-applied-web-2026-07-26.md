# MowGo Web — Fixes Applied (July 26, 2026)

Based on `code-review-web-2026-07-26.md` (Pass 1 + Pass 2 findings).

## Summary

- **15 fixes applied** across 9 files
- **18 fixes applied** across 9 files
- **5 CRITICAL** fixes (XSS, PII exposure, JWT token removal, hash URL validation)
- **8 HIGH** fixes (memory leaks, race conditions, input validation, error handling, UTC dates)
- **2 MEDIUM** fixes (auto-scroll cleanup, error state propagation)

---

## Fixes by File

### `components/AutopilotChat.jsx`

| Line | Severity | Fix |
|------|----------|-----|
| 354-382 | 🔴 CRITICAL | **XSS via dangerouslySetInnerHTML** — Removed `dangerouslySetInnerHTML` from `FormatContent`. Now renders bold/code as React `<strong>` and `<code>` elements directly, eliminating the HTML injection surface. |
| 289 | 🟠 HIGH | **safeParse null guard** — Added `args &&` guard before `Object.keys(args)` to prevent crash when `safeParse` returns null. |
| 32-40 | 🟡 MEDIUM | **Auto-scroll cleanup** — Wrapped `scrollIntoView` in `requestAnimationFrame` with cleanup function to cancel on unmount, preventing scroll animation leaking. |

### `hooks/useAutopilot.js`

| Line | Severity | Fix |
|------|----------|-----|
| 1 | 🟠 HIGH | **AbortController cleanup** — Added `useEffect` cleanup that aborts `controllerRef` on component unmount, preventing memory leaks and state updates after unmount. |
| 162 | 🟠 HIGH | **Abort signal check in tool loop** — Added `if (signal.aborted) return;` before each tool execution to stop processing after abort. |

### `lib/autopilotTools.js`

| Line | Severity | Fix |
|------|----------|-----|
| 193-201 | 🟠 HIGH | **UTC date mismatch** — Replaced `toISOString().split('T')[0]` with local date formatting using `getFullYear()/getMonth()/getDate()`. Prevents timezone-related scheduling bugs for users in negative UTC offsets. |
### `pages/Today.jsx` (additional UTC fixes)

| Line | Severity | Fix |
|------|----------|-----|
| 14-22 | 🟠 HIGH | **getNextDate UTC fix** — `getNextDate()` now returns local dates instead of UTC, preventing recurring job scheduling off by one day. |
| 26-30 | 🟠 HIGH | **Initial date state UTC fix** — Date picker initial value now uses local date. |
| 240-243 | 🟠 HIGH | **Rain delay tomorrow UTC fix** — `tomorrow` date calculation now uses local formatting. |
| 431-438 | 🔴 CRITICAL | **JWT token removed** — Removed client-side `getSession()` + `Authorization: Bearer` header for same-origin `/api/invoices/send-email`. Now uses httpOnly cookie session. |
| 641-668 | 🔴 CRITICAL | **PII redaction in service_notes** — Added `redactPII()` function to strip gate codes, alarm codes, door codes, access codes, and passwords from `service_notes` before sending to LLM. Applied to both `formatJob()` and `formatClient()`. |

### `lib/offlineStorage.js`

| Line | Severity | Fix |
|------|----------|-----|
| 5-20, 23-44 | 🟠 HIGH | **Promise settlement race + port leak** — Added `resolved` flag to prevent double-resolution of MessageChannel promises. Both `port1` and `port2` are now closed after resolution, preventing memory leaks. Applied to both `saveOffline()` and `loadOffline()`. |

### `lib/useWeather.js`

| Line | Severity | Fix |
|------|----------|-----|
| 1-56 | 🟠 HIGH | **Weather API caching** — Added localStorage cache with 30-minute TTL. Weather data is now cached and reused across component remounts, reducing duplicate API calls. Also fixed `rainLikely()` and `todayRainChance()` to use local dates. |

### `pages/Today.jsx`

| Line | Severity | Fix |
|------|----------|-----|
| 43 | 🟠 HIGH | **UTC date mismatch** — Replaced `toISOString().split('T')[0]` with local date formatting. |
| 145-177 | 🟠 HIGH | **Reorder rollback** — `reorderWithinDate` now saves previous order before persisting. On fetch failure, rolls back to previous route_order values. Also removed client-side JWT token (uses httpOnly cookies). |

### `pages/Clients.jsx`

| Line | Severity | Fix |
|------|----------|-----|
| 56-74 | 🟠 HIGH | **Error feedback** — Added `clientError` state. `save()` now sets error message on failure. Error is displayed in the form UI. |

### `main.jsx`

| Line | Severity | Fix |
|------|----------|-----|
| 6-15 | 🟠 HIGH | **Global error handlers** — Added `window.addEventListener('error')` and `window.addEventListener('unhandledrejection')` to capture async/event-handler errors that React ErrorBoundary doesn't catch. |

### `App.jsx`

| Line | Severity | Fix |
|------|----------|-----|
| 119-132 | 🔴 CRITICAL | **Hash URL validation** — `SupabaseErrorRedirect` now validates hash params against an allowlist (`error`, `error_code`, `error_description`, `type`, `access_token`) before processing routing decisions. |

### `lib/data.js`

| Line | Severity | Fix |
|------|----------|-----|
| 37, 180, 256 | 🟡 MEDIUM | **Error state propagation** — `loadJobs()`, `loadClients()`, `loadInvoices()` now throw descriptive errors instead of silently returning `[]`. This surfaces load failures to the UI via existing try/catch in components. |

---

## Not Applied (Requires Infrastructure Changes)

| Issue | Reason |
|-------|--------|
| Ownership checks on update/delete (C4) | Requires Supabase RLS policy verification — cannot be confirmed from client code alone |
| Duplicate job creation race condition (H3) | Requires database unique constraint on (client_id, scheduled_date, title) |
| CSRF protection on Stripe checkout (H5) | Requires server-side CSRF token implementation |
| Password change without current password (H18) | Settings page has no password change UI; Supabase handles this |

---

*Generated: July 26, 2026*
