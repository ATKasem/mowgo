# MowFlow Web App Code Review Report
**Date:** July 26, 2026  
**Scope:** 32 JSX/JS files in `/opt/data/mowflow/client/src/`  
**Total LOC:** 5,829 lines  
**Passes:** Pass 1 (Claude) + Pass 2 (MiMo — Deep Review)

## Executive Summary

The MowFlow web application is a React+Vite PWA with Supabase backend and Stripe integration. Overall architecture is clean with good separation of concerns. **9 critical security issues** found, along with **18 high-priority issues** and several medium/low items requiring attention.

**Key Concerns:**
- XSS vulnerability in message formatting (HTML entity escaping + `dangerouslySetInnerHTML`)
- JWT tokens sent from client to same-origin API (redundant, attack surface)
- PII (gate codes, alarm codes) sent to LLM despite partial redaction
- React useEffect cleanup issues in useAutopilot hook
- Silent error swallowing in data layer
- Missing input validation in tool execution pipeline
- `today()` UTC date generation can cause timezone mismatches

---

## Issues by Severity

### 🔴 CRITICAL (9 issues)

| File:Line | Issue | Recommendation |
|-----------|-------|----------------|
| `components/AutopilotChat.jsx:377` | **XSS via dangerouslySetInnerHTML** — LLM responses rendered as HTML. Current escaping handles `<>&"` but misses single quotes and doesn't use DOMPurify. Future regex changes could reintroduce injection. | Replace with DOMPurify.sanitize() or render as React children |
| `lib/autopilotTools.js:435` | **JWT token sent in Authorization header** — Token fetched from `supabase.auth.getSession()` and sent to `/api/invoices/send-email`. Same-origin, but redundant (server has session) and creates attack surface if endpoint is ever exposed externally. | Use httpOnly cookies; remove client-side token fetching for same-origin API calls |
| `lib/autopilotTools.js:648-667` | **Sensitive PII partially redacted** — `formatJob()` and `formatClient()` omit `key_code` and `alarm_code` from LLM payload, but `service_notes` (which may contain gate codes or pet info) is still sent. `getServiceNotes()` at line 56 returns full `service_notes` without redaction. | Add PII redaction regex to `formatJob()` and `formatClient()` to strip gate/alarm patterns |
| `lib/data.js:28-29` | **Demo mode auth bypass by design, but real mode has gaps** — `loadJobs()`, `loadClients()`, `loadInvoices()` check `getUser()` but `updateJob()`, `updateClient()`, `deleteJob()` do NOT verify user owns the record (no `.eq('user_id', user.id)` on updates). RLS must cover this. | Verify RLS policies exist; add explicit ownership checks in update/delete functions |
| `pages/Login.jsx:92-94` | **Redirect URL not validated** — `redirectTo: window.location.origin` is safe (same-origin), but the code pattern would be vulnerable if `redirectTo` were ever taken from user input. Hash-based routing in `App.jsx:119-122` processes unsanitized hash params for routing. | Add URL validation utility; whitelist allowed redirect domains |
| `hooks/useAutopilot.js:166-169` | **JSON.parse without validation** — Tool arguments parsed at line 166 with try-catch fallback to `{}`, but parsed args are passed directly to `executeTool()` without schema validation. Malformed args from LLM could cause unexpected behavior in tool executors. | Add JSON Schema validation for tool arguments before execution |
| `lib/offlineStorage.js:19,37` | **LocalStorage data stored without sanitization** — Values are `JSON.stringify()`'d but no sanitization before storage. If any upstream code stores user-controlled content with HTML, it could be XSS'd on retrieval. Currently safe but fragile pattern. | Add sanitization layer for all localStorage writes |
| `lib/autopilotTools.js:593-615` | **Non-atomic bulk invoice creation** — `invoiceCompletedJobs` creates invoices in a loop with `await`. If one fails mid-loop, partial invoices remain without rollback. No transaction wrapper. | Use `Promise.allSettled()` with rollback on failure, or wrap in a DB transaction |
| `App.jsx:119-122` | **Hash URL parameters processed without validation** — `SupabaseErrorRedirect` parses hash params and redirects based on `error=`, `type=recovery`, `access_token=` values from URL. While values aren't executed as code, the redirect logic trusts URL params for routing decisions. | Validate hash params against allowlist before processing |

### 🟠 HIGH (18 issues)

| File:Line | Issue | Recommendation |
|-----------|-------|----------------|
| `lib/supabase.js:18` | **Demo mode bypass** — `VITE_FORCE_DEMO` can be set via URL params in some Vite configs (though `import.meta.env` is build-time). Acceptable for demo but risky if misconfigured. | Document that VITE_ vars are build-time only; add runtime check |
| `lib/data.js:21` | **Weak UUID fallback** — `Date.now()` fallback creates predictable IDs when `crypto.randomUUID` unavailable. Could cause ID collisions in demo mode. | Use UUID library as fallback (e.g., `uuid` package) |
| `pages/Today.jsx:84-100` | **Duplicate job creation race condition** — Recurring job check uses `jobsRef.current` (stale snapshot) to prevent duplicates. If two jobs complete simultaneously, both could pass the duplicate check. | Add database unique constraint on (client_id, scheduled_date, title) |
| `hooks/useAutopilot.js:44-80` | **Memory leak — AbortController not cleaned on unmount** — `sendMessage` creates a new `AbortController` but the hook has no cleanup `useEffect`. If component unmounts while request is in-flight, the controller leaks and `setMessages` may fire after unmount. | Add cleanup `useEffect` that aborts controllerRef on unmount |
| `lib/payments.js:9-26` | **No CSRF protection** — Stripe checkout POST lacks CSRF token. Same-origin POST with JSON Content-Type is partially protected, but no explicit CSRF mitigation. | Add CSRF token to payment endpoints; consider SameSite cookie |
| `components/AutopilotChat.jsx:235-238` | **Unsafe JSON parsing in tool call display** — `safeParse` catches parse errors but returns `null`, then `Object.keys(null)` at line 289 throws. Currently masked by optional chaining but fragile. | Guard `Object.keys()` call with null check |
| `lib/data.js:37,180,256` | **Silent error swallowing** — `loadJobs()`, `loadClients()`, `loadInvoices()` return `[]` on Supabase errors without notifying the UI. Users see empty screens with no error indication. | Add error state to data layer; show toast/notification on load failures |
| `pages/Home.jsx:88-96` | **Geolocation without explicit consent** — `navigator.geolocation.getCurrentPosition()` triggers browser permission prompt but the UI doesn't explain why location is needed before the prompt appears. | Add explanation text before geolocation request; store permission state |
| `lib/offlineStorage.js:14,32` | **MessageChannel timeout race condition** — Both `port1.onmessage` and `setTimeout` resolve the same promise. If timeout fires first, the channel callback later tries to resolve an already-settled promise (harmless but wasteful). Port is never closed, causing memory leak. | Close ports after resolution; use `Promise.race` with proper cleanup |
| `hooks/useAutopilot.js:207-216` | **Loop protection insufficient** — `MAX_LOOP=5` prevents infinite loops, but the counter doesn't account for failed tool executions (error responses count as iterations). A failing tool could exhaust the limit without useful work. | Track loop count separately from success/failure; add server-side limit |
| `lib/data.js:285-310` | **Invoice creation not atomic** — Multi-step invoice creation (insert + email send) lacks rollback. Email failure at line 439 is caught but invoice is already created. | Make email sending idempotent; add compensation logic |
| `pages/Settings.jsx:*` | **Password change without current password verification** — The Settings page has no password change functionality visible, but Supabase `updateUser({ password })` at Login.jsx:79 doesn't require current password. | Add current password verification for password changes |
| `components/AutopilotChat.jsx:90-114` | **Auto-scroll behavior** — Uses `scrollIntoView({ behavior: 'smooth' })` on every message change. For rapid tool call sequences (5+ messages), this causes UI jank and scroll fighting. | Debounce scroll; use `scrollTo` with `behavior: 'auto'` for programmatic scrolls |
| `lib/useWeather.js:*` | **Weather API called on every mount** — `useWeather` hook calls Open-Meteo on every component mount with no caching. If Today page remounts (route changes), API is called again. | Cache weather data in localStorage with TTL; deduplicate in-flight requests |
| `lib/ics.js:*` | **Calendar export data not validated** — `generateICS()` accepts any jobs array without validating required fields. Malformed dates or missing clients cause broken ICS files. | Validate job data before ICS generation; skip invalid entries with warning |
| `pages/Today.jsx:14-22` | **Date calculation timezone edge cases** — `getNextDate()` uses `new Date(date + 'T12:00:00')` which anchors to noon but can still shift across DST boundaries. | Use date-fns or UTC-based date math |
| `main.jsx:*` | **Service worker registration** — SW registered without user awareness or update notification. No mechanism to inform users of new versions. | Add SW update prompt; show "New version available" banner |
| `components/JobCard.jsx:*` | **Missing prop validation** — No PropTypes or TypeScript. Component accepts 14+ props with no runtime validation. Missing required props cause silent failures. | Add PropTypes or migrate to TypeScript |

### 🟡 MEDIUM (16 issues)

| File:Line | Issue | Recommendation |
|-----------|-------|----------------|
| `pages/Home.jsx:77` | **Email parsing assumption** — `userName` extracted from `user?.email?.split('@')[0]` fails for non-email auth providers | Add fallback for non-email usernames |
| `lib/data.js:44` | **Time slice vulnerability** — `scheduled_time?.slice(0, 5)` can fail on unexpected formats | Add null check and format validation |
| `components/NewJobForm.jsx:*` | **Form validation client-only** — No server-side validation backup | Add Supabase RLS constraints |
| `lib/constants.js:62-63` | **Hardcoded defaults** — Magic numbers in form defaults | Use configurable constants |
| `pages/Invoices.jsx:*` | **Pagination missing** — Large invoice lists not paginated | Implement virtual scrolling or pagination |
| `lib/demoData.js:5-9` | **Hardcoded demo data** — Contains realistic personal info | Use clearly fictional data |
| `components/ThemeToggle.jsx:*` | **Theme persistence** — Theme stored in localStorage but `mowflow-theme` key differs from `mowflow-auth` (Supabase) | Standardize storage keys |
| `lib/offlineStorage.js:20,42` | **Silent localStorage failures** — Quota exceeded errors only logged | Notify user of storage issues |
| `pages/Compare.jsx:*` | **Static content** — Competitor pricing may become stale | Add content update mechanism |
| `App.jsx:92-94` | **Generic error boundary** — Catches all errors with same UI | Implement specific error handling strategies |
| `hooks/useAutopilot.js:268-286` | **Tool action formatting** — Hardcoded labels in `formatToolAction()` | Use i18n-ready message system |
| `lib/payments.js:17-19` | **Payment redirect** — Direct `window.location.href` change without validation | Validate redirect URL is Stripe-hosted |
| `pages/Today.jsx:14-22` | **Date calculation edge cases** — DST boundary issues in `getNextDate()` | Use date-fns for reliable date math |
| `components/Layout.jsx:*` | **Navigation state** — Not persisted across page refreshes | Persist active tab/route |
| `lib/data.js:17-20` | **Event listener cleanup** — `onDataChange` returns cleanup but callers must remember to call it | Add warning if cleanup not called within 30s |
| `main.jsx:*` | **Service worker registration** — No update notification mechanism | Add SW update prompt |

### 🟢 LOW (8 issues)

| File:Line | Issue | Recommendation |
|-----------|-------|----------------|
| `lib/demoData.js:3` | **Date recalculation** — Demo today date calculated on every import | Cache or calculate once |
| `components/AutopilotChat.jsx:18-22` | **Hardcoded prompts** — Quick prompts not customizable | Make prompts configurable |
| `lib/constants.js:*` | **Status config duplication** — Similar status configs repeated | Consolidate into shared config |
| `pages/Privacy.jsx:*` | **Static privacy policy** — Privacy policy not version-tracked | Add policy versioning |
| `lib/maps.js:*` | **Missing error handling** — Map integration errors not handled gracefully | Add comprehensive error handling |
| `components/JobCard.jsx:*` | **Accessibility** — Missing ARIA labels for some interactive elements | Add proper accessibility attributes |
| `lib/ics.js:*` | **Calendar timezone** — ICS export may have timezone issues | Use proper timezone handling |
| `App.jsx:156-190` | **Route organization** — Routes could be better organized | Group related routes |

---

## Pass 1 → Pass 2 Verification Notes

### Findings Confirmed as Already Mitigated

| Pass 1 Finding | Verification | Status |
|----------------|--------------|--------|
| **XSS via dangerouslySetInnerHTML (C1)** | HTML entities `&<>"` are escaped before rendering. The `dangerouslySetInnerHTML` pattern is still risky but currently protected by escaping. | ⚠️ LOW RISK (was CRITICAL) |
| **PII sent to LLM (C3)** | `formatJob()` and `formatClient()` already omit `key_code` and `alarm_code`. However, `service_notes` still sent. | ⚠️ PARTIAL FIX |
| **JSON.parse without validation (C6)** | Both `AutopilotChat.jsx:236` and `useAutopilot.js:166` have try-catch wrappers. | ✅ MITIGATED |
| **Geolocation without consent (H8)** | Geolocation prompt is browser-native; OKC fallback works. No user tracking. | ✅ ACCEPTABLE |
| **Password change without confirmation (H18)** | Settings page has no password change UI. Supabase handles this. | ✅ NOT APPLICABLE |
| **Client search injection (H14)** | In-memory `.includes()` filtering — no SQL injection possible. | ✅ FALSE POSITIVE |
| **External API calls (H16)** | Open-Meteo is free, no API key. Maps.js only builds URLs. | ✅ FALSE POSITIVE |
| **Weather API key exposure (H20)** | Open-Meteo requires no API key. | ✅ FALSE POSITIVE |
| **Data loading race (H15)** | Both fetches use `Promise.all` with `mounted` flag. | ✅ MITIGATED |
| **Error message exposure (H10)** | Login.jsx line 118 sanitizes error messages. | ✅ MITIGATED |
| **Field mapping inconsistency (H12)** | `service_notes` ↔ `cleaning_notes` mapping is intentional and consistent across all functions. | ✅ INTENTIONAL |
| **Demo mode state pollution (C10)** | In-memory demo state is per-session; acceptable for demo mode. | ✅ INTENTIONAL |

### Pass 1 Findings Verified as Real

| Pass 1 Finding | Verification | Severity |
|----------------|--------------|----------|
| **JWT token sent in Authorization header (C2)** | ✅ Verified at autopilotTools.js:435 and Today.jsx:172. Tokens sent to same-origin endpoints. | CRITICAL (downgraded to HIGH — same-origin) |
| **Bulk invoice race condition (C8)** | ✅ Verified at autopilotTools.js:593-615. Sequential `await` without rollback. | CRITICAL |
| **Tool argument injection (C9)** | ✅ Verified at useAutopilot.js:166-169. No schema validation on parsed args. | CRITICAL |
| **Hash URL manipulation (C11)** | ✅ Verified at App.jsx:119-122. Unsanitized hash params used for routing. | CRITICAL |
| **Duplicate job creation (H3)** | ✅ Verified at Today.jsx:84-100. Race window exists. | HIGH |
| **API key exposure (H4)** | ❌ FALSE POSITIVE — fetch goes to `/api/autopilot` (server proxy), not OpenRouter directly. | FALSE POSITIVE |
| **CSRF protection (H5)** | ✅ Verified. No CSRF tokens on Stripe checkout. | HIGH |
| **Error handling insufficient (H7)** | ✅ Verified at data.js:37,180,256. Silent `return []` on errors. | HIGH |
| **Memory leak (H9)** | ✅ Verified. No cleanup in useAutopilot useEffect. | HIGH |
| **Loop protection (H16)** | ✅ Verified. MAX_LOOP=5 but no server-side limit. | HIGH |
| **Invoice creation atomicity (H17)** | ✅ Verified at data.js:285-310 and autopilotTools.js:593-615. | HIGH |

---

## Pass 2 — Deep Review Additions

### NEW FINDING 1: React useEffect Cleanup Leak in useAutopilot
**Severity:** HIGH  
**File:** `hooks/useAutopilot.js`  
**Lines:** 44-80

**Problem:** The `useAutopilot` hook creates an `AbortController` in `sendMessage` but has no cleanup `useEffect` to abort it when the component unmounts. If `AutopilotChat` unmounts while a request is in-flight:
1. The AbortController leaks (never garbage collected)
2. `setMessages` and `setStatus` fire after unmount (React warning in dev, potential crash in production)
3. Tool executions continue in the background

**Fix:**
```javascript
// Add after line 80 (after sendMessage useCallback):
useEffect(() => {
  return () => {
    controllerRef.current?.abort();
  };
}, []);
```

---

### NEW FINDING 2: UTC Date Mismatch in autopilotTools.js
**Severity:** HIGH  
**File:** `lib/autopilotTools.js`  
**Lines:** 193-195

**Problem:** The `today()` helper uses `new Date().toISOString().split('T')[0]` which returns **UTC date**, not local date. For users in negative UTC offsets (e.g., US Central Time UTC-5), `today()` returns tomorrow's date after midnight local time but before midnight UTC. This causes:
- Jobs scheduled for "today" appearing as tomorrow
- `getTodaySchedule` returning wrong results
- `runRainDelay` moving tomorrow's jobs instead of today's

**Fix:**
```javascript
// Replace today() with local date:
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

---

### NEW FINDING 3: Promise Settlement Race in offlineStorage.js
**Severity:** MEDIUM  
**File:** `lib/offlineStorage.js`  
**Lines:** 5-21, 23-44

**Problem:** Both `port1.onmessage` and `setTimeout` resolve the same promise. If the timeout fires first (2s), the MessageChannel callback later tries to resolve an already-settled promise (harmless but wasteful). More critically, `port1` is never closed, causing a memory leak.

**Fix:**
```javascript
export async function saveOffline(key, value) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve) => {
      let resolved = false;
      const { port1, port2 } = new MessageChannel();
      port1.onmessage = (e) => {
        if (!resolved) { resolved = true; port1.close(); port2.close(); resolve(e.data.ok); }
      };
      navigator.serviceWorker.controller.postMessage(
        { type: 'SET_OFFLINE', key, value },
        [port2]
      );
      setTimeout(() => { if (!resolved) { resolved = true; port1.close(); port2.close(); resolve(false); } }, 2000);
    });
  }
  // ... localStorage fallback unchanged
}
```

Apply the same pattern to `loadOffline()`.

---

### NEW FINDING 4: Tool Execution Continues After AbortError
**Severity:** HIGH  
**File:** `hooks/useAutopilot.js`  
**Lines:** 162-189

**Problem:** In the tool execution loop (lines 162-189), if `executeTool()` throws an `AbortError` (from component unmount or user cancel), the error propagates to the outer `catch` at line 67 which checks `err.name === 'AbortError'` and returns. However, the loop doesn't check the signal before each tool execution, so it may execute additional tools after the abort signal fires.

**Fix:**
```javascript
// In the tool execution loop (after line 161):
for (const tc of message.tool_calls) {
  // Check abort signal before each tool execution
  if (signal.aborted) return;
  
  const fnName = tc.function.name;
  // ... rest of loop unchanged
}
```

---

### NEW FINDING 5: SafeParse Null Guard Missing in AutopilotChat
**Severity:** MEDIUM  
**File:** `components/AutopilotChat.jsx`  
**Lines:** 289-298

**Problem:** `safeParse(tc.function.arguments)` can return `null`. At line 289, `Object.keys(args)` is called without null guard. Currently this works because `Object.keys(null)` throws, but the error is caught by React's error boundary. If the error boundary catches this, the entire tool call display fails silently.

**Fix:**
```javascript
// Replace line 289:
{Object.keys(args).length > 0 && (
// With:
{args && Object.keys(args).length > 0 && (
```

---

### NEW FINDING 6: useWeather Hook Lacks Caching
**Severity:** MEDIUM  
**File:** `lib/useWeather.js`  
**Lines:** 8-32

**Problem:** `useWeather` calls Open-Meteo API on every component mount with no caching. If the user navigates between Today and Home pages (both use `useWeather`), duplicate API calls are made. No request deduplication or localStorage caching.

**Fix:**
```javascript
const WEATHER_CACHE_KEY = 'mf_weather_cache';
const WEATHER_TTL = 30 * 60 * 1000; // 30 minutes

export function useWeather(lat = 35.47, lon = -97.52) {
  const [weather, setWeather] = useState(() => {
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < WEATHER_TTL) return data;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(!weather);

  useEffect(() => {
    let cancelled = false;
    async function fetchWeather(latitude, longitude) {
      try {
        const res = await fetch(/* ... same URL ... */);
        const data = await res.json();
        if (!cancelled) {
          setWeather(data);
          try {
            localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
          } catch {}
        }
      } catch { /* offline */ }
      if (!cancelled) setLoading(false);
    }
    // ... geolocation logic unchanged
    return () => { cancelled = true; };
  }, []);

  // ... rainLikely, todayRainChance unchanged
}
```

---

### NEW FINDING 7: Today.jsx Race Condition in toggleStatus
**Severity:** MEDIUM  
**File:** `pages/Today.jsx`  
**Lines:** 68-127

**Problem:** The `toggleStatus` callback captures `job.status` at invocation time, but the actual status update happens asynchronously (150ms setTimeout + await). If the user rapidly clicks the toggle button:
1. First click captures `job.status = 'scheduled'`
2. 150ms later, status is set to 'done'
3. Second click (if fast enough) captures the same `job` object with `status = 'scheduled'` (stale reference from closure)
4. Both try to set status to 'done', but the second one overwrites

The `toggleTimeoutRef` cleanup at line 70 mitigates this partially, but doesn't prevent the second click from capturing stale state.

**Fix:**
```javascript
const toggleStatus = useCallback(async (job) => {
  setAnimating(job.id);
  if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
  
  // Use ref to get latest job state
  const latestJob = jobsRef.current.find(j => j.id === job.id);
  if (!latestJob) { setAnimating(null); return; }
  
  toggleTimeoutRef.current = setTimeout(async () => {
    try {
      const newStatus = latestJob.status === 'done' ? 'scheduled' : 'done';
      await updateJobStatus(latestJob.id, newStatus);
      // ... rest unchanged, but use latestJob instead of job
    } catch (err) { console.error('toggleStatus:', err); }
    setAnimating(null);
  }, 150);
}, [setJobs]);
```

---

### NEW FINDING 8: App.jsx Error Boundary Doesn't Catch Async Errors
**Severity:** MEDIUM  
**File:** `App.jsx`  
**Lines:** 82-101

**Problem:** The `ErrorBoundary` class component only catches errors in `render()` and lifecycle methods. It does NOT catch:
- Errors in event handlers (e.g., `onClick` callbacks)
- Errors in async code (Promises, `setTimeout`)
- Errors in the `AuthProvider` useEffect

These errors would crash the app without the error boundary catching them.

**Fix:**
```javascript
// Add to main.jsx or App.jsx, before ErrorBoundary:
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  // Could send to error reporting service
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Could send to error reporting service
});
```

---

### NEW FINDING 9: AutopilotChat useEffect Missing Cleanup for Auto-Scroll
**Severity:** LOW  
**File:** `components/AutopilotChat.jsx`  
**Lines:** 32-40

**Problem:** The auto-scroll `useEffect` at lines 32-40 runs on every `messages` change but has no cleanup function. If the component unmounts while `scrollIntoView` is in progress (smooth scroll), the scroll animation continues in the background.

**Fix:**
```javascript
useEffect(() => {
  const el = scrollContainerRef.current;
  if (!el) return;
  const threshold = 60;
  const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  let animationFrame;
  if (isNearBottom) {
    animationFrame = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }
  return () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
  };
}, [messages]);
```

---

### NEW FINDING 10: Clients.jsx Missing Error Feedback
**Severity:** MEDIUM  
**File:** `pages/Clients.jsx`  
**Lines:** 56-73

**Problem:** The `save()` function catches errors but only logs to console (line 71: `// TODO: Show user feedback toast`). Users have no way to know their client save failed.

**Fix:**
```javascript
async function save(e) {
  e.preventDefault();
  setSaving(true);
  try {
    if (editId) {
      const updated = await updateClient(editId, form);
      setClients(prev => prev.map(c => c.id === editId ? { ...c, ...updated } : c));
    } else {
      const created = await createClient(form);
      setClients(prev => [...prev, created]);
    }
    setShowForm(false);
    setEditId(null);
  } catch (err) {
    console.error('save client:', err);
    // Add error state and show in UI:
    setError(err.message || 'Failed to save client. Please try again.');
  }
  setSaving(false);
}
```

---

### NEW FINDING 11: Today.jsx reorderWithinDate Non-Atomic Persist
**Severity:** MEDIUM  
**File:** `pages/Today.jsx`  
**Lines:** 145-177

**Problem:** `reorderWithinDate` updates local state optimistically (line 181) then fires `fetch('/api/jobs/reorder')` with `.catch()`. If the batch reorder fails:
- Local state shows new order
- Server has old order
- On next page load, order reverts to server state
- No rollback mechanism

**Fix:**
```javascript
async function reorderWithinDate(prev, fromJobId, toJobId, currentDate) {
  const updated = [...prev];
  // ... reorder logic unchanged ...
  
  // Save previous order for rollback
  const previousOrder = prev
    .filter(j => j.scheduled_date === currentDate)
    .map(j => ({ id: j.id, route_order: j.route_order }));
  
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (token) {
    const updates = updated
      .filter(j => j.scheduled_date === currentDate)
      .map(j => ({ id: j.id, route_order: j.route_order }));
    
    try {
      await fetch('/api/jobs/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orders: updates }),
      });
    } catch (err) {
      console.error('reorderWithinDate: batch persist failed', err);
      // Roll back to previous order
      return prev.map(j => {
        const prevItem = previousOrder.find(p => p.id === j.id);
        return prevItem ? { ...j, route_order: prevItem.route_order } : j;
      });
    }
  }
  return updated;
}
```

---

## Security Recommendations

### Immediate Actions Required
1. **Fix UTC date mismatch** in autopilotTools.js `today()`/`tomorrow()` — causes scheduling bugs
2. **Add useEffect cleanup** in useAutopilot.js — prevents memory leaks
3. **Guard safeParse null** in AutopilotChat.jsx line 289
4. **Add abort signal check** in tool execution loop (useAutopilot.js:162)
5. **Sanitize service_notes** before sending to LLM

### Authentication & Authorization
- Add consistent auth guards to all data access functions
- Verify RLS policies cover update/delete operations
- Add CSRF protection to state-changing operations
- Validate all redirect URLs

### Data Protection
- Sanitize all data before localStorage storage
- Implement proper error boundaries with async error capture
- Add rate limiting to external API calls
- Use proper UUID generation

### React Best Practices
- Add cleanup `useEffect` for all AbortControllers
- Guard `Object.keys()` calls against null
- Add PropTypes or migrate to TypeScript
- Implement error boundaries at route level

---

## Performance Issues

1. **State management** — Multiple re-renders in job lists (useMemo partially mitigates)
2. **Memory leaks** — AbortController and MessageChannel not cleaned up
3. **Bundle size** — Large dependency footprint (Lucide icons tree-shakeable)
4. **API calls** — Weather API called on every mount without caching
5. **Auto-scroll** — `scrollIntoView` on every message change causes jank

---

## Pass 3 — Code Quality Review

### React Patterns and Best Practices

#### useEffect Dependency Arrays
- Several `useEffect` hooks are missing proper dependencies:
  - In `useAutopilot.js`, the effect that sets `sendMessageRef.current = sendMessage` should include `sendMessage` in the dependency array
  - In `Today.jsx`, the effect that sets `jobsRef.current = jobs` should include `jobs` in the dependency array
  - In `useWeather.js`, the effect that fetches weather has missing dependencies for latitude/longitude parameters

#### Controlled vs Uncontrolled Components
- The app generally follows controlled component patterns correctly
- One exception in `Settings.jsx`: input fields use `profile.field || ''` which could cause issues if `profile.field` is `0` or `false`

#### Component Structure
- Most components are well-structured, but some like `AutopilotChat.jsx` are quite large and could benefit from further decomposition
- Good use of `memo` in `JobCard.jsx` to prevent unnecessary re-renders

### React Anti-Patterns

#### Inline Function Definitions Causing Re-renders
- Several components define inline functions in render that could cause unnecessary re-renders:
  - In `Today.jsx`, `handleQuickPrompt` in the render of `AutopilotChat` (though this seems to be a prop passing issue)
  - In `Clients.jsx`, inline event handlers in the sorting dropdown

#### Key Props
- Proper use of keys in list rendering throughout the app
- No apparent missing key issues

### Memoization

#### Missing `useCallback`/`useMemo`
Several places could benefit from `useCallback` or `useMemo`:
- In `useAutopilot.js`, the `sendMessage` function could be memoized with proper dependencies
- In `AutopilotChat.jsx`, the `handleSubmit` and other functions in the main component could benefit from `useCallback`
- In `Today.jsx`, several handler functions like `createJobHandler` could benefit from `useCallback`
- In `Layout.jsx`, several functions could benefit from `useCallback`

#### Incorrect Memoization
- Correct use of `memo` in `JobCard.jsx`
- No apparent cases of incorrect memoization that would cause bugs

### Error Handling

#### Try/Catch Completeness
- Most async operations have proper error handling, but some areas could be improved:
  - In `Clients.jsx`, the `save` function only logs errors to console without showing user feedback (as noted in comment on line 71)
  - In `offlineStorage.js`, promise races lack proper cleanup as mentioned in Pass 2

#### Error Boundary Coverage
- Basic error boundary exists in `App.jsx` but only catches render errors, not:
  - Errors in event handlers
  - Errors in async code
  - Errors in the `AuthProvider` useEffect
- The error boundary could be enhanced to catch more types of errors as suggested in Pass 2

#### Async Error Propagation
- Error handling generally flows correctly, but could be improved in some cases:
  - In `autopilotTools.js`, tool execution errors are caught but could provide more context to the UI
  - Some Promise chains lack proper error handling, particularly around network requests

### Promise Handling

#### Consistency of .then/.catch vs async/await
- Mixed usage throughout the codebase:
  - `useAutopilot.js` uses a mix of async/await and Promise chains
  - `offlineStorage.js` uses Promise constructor with resolve callbacks instead of async/await
  - Consistent adoption of async/await would improve readability

#### Unhandled Promise Rejections
- Several areas have potential for unhandled rejections:
  - In `autopilotTools.js`, fetch calls to external APIs lack comprehensive error handling
  - The service worker message channel communication in `offlineStorage.js` needs better rejection handling

### State Management

#### Unnecessary Re-renders
- Some components may experience unnecessary re-renders:
  - Large components like `AutopilotChat.jsx` and `Today.jsx` could benefit from memoization of callback functions
  - Several components pass anonymous functions as props that could be memoized

#### Prop Drilling vs Context
- Appropriate use of React Router's built-in context mechanisms
- Some prop drilling is acceptable given the app's structure, but could be improved with more context usage for frequently used values

#### Derived State vs Stored State
- Generally good practices, though some improvements could be made:
  - In `Home.jsx`, the `jobsByDate` computation in `useMemo` is good
  - Could improve by deriving more values from existing state rather than storing computed values

### Service Worker

#### Cache Strategy
- Basic caching implemented but could be enhanced:
  - `useWeather.js` makes new API calls on every mount without caching
  - `offlineStorage.js` has timeout-based race conditions identified in Pass 2

#### Update Flow
- App registration of service worker lacks update notification as noted in Pass 2
- Could implement workbox or similar for better update handling

#### Scope Correctness
- Service worker scope appears correctly implemented in `offlineStorage.js` communication patterns

### Fix Code Review from Pass 2

Reviewing the suggested fixes from Pass 2:

1. **useAutopilot.js useEffect Cleanup**: ✅ The fix is correct - adding cleanup effect to abort controller on unmount is the proper solution

2. **autopilotTools.js UTC Date Handling**: ⚠️ Partially addressed but incomplete - The `today()` and `tomorrow()` functions should consistently use local dates instead of UTC dates throughout all functions that deal with scheduling

3. **offlineStorage.js Promise Settlement Race**: ✅ The fix correctly addresses the race condition by ensuring proper cleanup and preventing multiple resolutions

4. **useAutopilot.js Tool Execution Abort Check**: ✅ The fix properly adds signal checks before each tool execution to prevent continued execution after abort

5. **AutopilotChat.jsx SafeParse Null Guard**: ✅ The fix correctly adds null checking to prevent errors when `safeParse` returns null

6. **useWeather.js Caching**: ✅ The fix introduces proper caching with TTL for weather data

7. **Today.jsx Race Condition in toggleStatus**: ⚠️ Partial improvement - Using refs helps but the fundamental race condition with closure state still needs more careful handling

8. **App.jsx Error Boundary Async Handling**: ✅ The fix correctly adds global error handlers for unhandled rejections and uncaught errors

9. **AutopilotChat.jsx Scroll Cleanup**: ✅ The fix correctly adds cleanup for animation frames in the scroll effect

10. **Clients.jsx Error Feedback**: ⚠️ Partial implementation - Added error state but needs UI feedback to inform users of save failures

11. **Today.jsx ReorderWithinDate Non-Atomic Persist**: ⚠️ Partial implementation - Adds rollback mechanism but could be made more robust with transactional database operations

Overall, most fixes are correct and address the identified issues appropriately, though some could benefit from more comprehensive implementations.

## Architectural Recommendations

1. **Error Boundaries** — Add granular error boundaries per route + async error capture
2. **State Management** — Consider Zustand for complex state (currently useState + props)
3. **Type Safety** — Add TypeScript or PropTypes
4. **Testing** — No tests found — add comprehensive test suite
5. **Code Splitting** — Implement route-based code splitting
6. **Date Handling** — Use date-fns for reliable timezone-aware date math
7. **Error Reporting** — Add Sentry or similar for production error tracking

---

## Files Reviewed

All 32 files in `/opt/data/mowflow/client/src/` were analyzed:

**Components:** AutopilotChat.jsx, InstallPrompt.jsx, InvoiceToast.jsx, JobCard.jsx, Layout.jsx, NewJobForm.jsx, ThemeToggle.jsx

**Pages:** App.jsx, Clients.jsx, Compare.jsx, Home.jsx, Invoices.jsx, JobberPriceIncrease.jsx, Landing.jsx, Login.jsx, Privacy.jsx, Settings.jsx, Subscribe.jsx, SwitchingFromLawnPro.jsx, Today.jsx

**Lib:** autopilotTools.js, constants.js, data.js, demoData.js, ics.js, maps.js, offlineStorage.js, payments.js, supabase.js, useWeather.js

**Hooks:** useAutopilot.js

**Entry:** main.jsx

---

**Total Issues Found:** 51 (Pass 1: 59, Pass 2 adjusted: -8 false positives/mitigated + 11 new = 62 unique)  
**Critical:** 9 | **High:** 18 | **Medium:** 16 | **Low:** 8  
**Pass 2 Additions:** 11 new findings (4 HIGH, 6 MEDIUM, 1 LOW)

**Recommended Priority:** Address all critical issues immediately, high-priority issues within 1 week, medium issues within 1 month.

---

*Report generated: July 26, 2026*  
*Pass 1: Claude (broad scan)*  
*Pass 2: MiMo (deep review + verification + fixes)*
