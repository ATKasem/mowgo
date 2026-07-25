# MowFlow Code Review — 2026-07-25

**Reviewer:** Hermes Agent (automated) — Pass 2 Deep Review  
**Scope:** Full codebase — React PWA client, Express API server, Cloudflare Pages Functions, iOS native, service worker  
**Lines reviewed:** ~4,200+ across 40+ source files  

---

## Summary

MowFlow is a well-structured lawn care scheduling SaaS with a clean React PWA, Supabase backend, Stripe payments, and an AI autopilot feature. The code quality is generally high — consistent patterns, good error handling in most paths, thoughtful UX. The main areas of concern are **security gaps in the Express API**, **status mismatch bugs in the AI autopilot**, **missing user feedback for failed operations**, and **an architectural split where client-side Supabase calls bypass Express server validation entirely**.

### Pass 2 Changes from Pass 1
- **#1 downgraded** from Critical to Medium (anon key is public by design; rotation concern is hygiene, not exploit)
- **#6 downgraded** from High to Medium (depends on Supabase RLS configuration; client-side Supabase calls rely on RLS)
- **#14 refuted** (batch reorder endpoint exists at server `/api/jobs/reorder`, but client doesn't use it — see refined note)
- **#26 refuted** (`apple-touch-icon` link tag exists in index.html)
- **11 new findings** added (#27–#37), including race conditions, date logic bugs, and email delivery gaps
- **Fix code provided** for all Critical/High findings

---

## CRITICAL

### 1. Stripe Checkout Amount Not Validated (Pay-Per-Invoice Endpoint)
**File:** `server/index.js:123-134`  
**Status:** ✅ CONFIRMED — actively exploitable

```javascript
app.post('/api/stripe/checkout', auth, async (req, res) => {
  const { invoice_id, amount } = req.body;
  const session = await stripe.checkout.sessions.create({
    line_items: [{ price_data: { ... unit_amount: Math.round(amount * 100) } }],
    ...
  });
});
```

**What's wrong:** The `amount` from the request body is used directly to create the Stripe session without any validation. An attacker could:
- Send `amount: 0.01` to pay $0.01 for any invoice
- Send `amount: 999999` to create a confusing checkout
- Send a negative amount (Stripe will reject, but it's still a server error)

**Fix:**
```javascript
app.post('/api/stripe/checkout', auth, async (req, res) => {
  const { invoice_id } = req.body;
  if (!invoice_id) return res.status(400).json({ error: 'Missing invoice_id' });

  // Fetch the invoice server-side — never trust client-provided amounts
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('amount, status, user_id')
    .eq('id', invoice_id)
    .single();

  if (invError || !invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });

  const amountInCents = Math.round(invoice.amount * 100);
  if (amountInCents <= 0) return res.status(400).json({ error: 'Invalid invoice amount' });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: {
      currency: 'usd',
      product_data: { name: 'Service Invoice' },
      unit_amount: amountInCents,
    }, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.APP_URL}/invoices?paid=true`,
    cancel_url: `${process.env.APP_URL}/invoices?paid=false`,
    metadata: { invoice_id },
  });
  res.json({ url: session.url });
});
```

---

### 2. Express API Spreads Untrusted Request Body
**File:** `server/index.js:34, 40, 69, 75`  
**Status:** ✅ CONFIRMED — mass assignment vulnerability

```javascript
app.post('/api/clients', auth, async (req, res) => {
  const { data, error } = await supabase.from('clients')
    .insert({ ...req.body, user_id: req.user.id })...
});
app.put('/api/clients/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('clients')
    .update(req.body).eq('id', req.params.id)...
});
```

**What's wrong:** `req.body` is spread/passed directly into Supabase operations. On PUT endpoints (lines 40, 75), an attacker can overwrite `user_id` to another user's ID, or set columns like `stripe_payment_intent_id`. On POST (lines 34, 69), while `user_id` is overridden after the spread, other arbitrary columns can still be injected.

**Fix (clients POST):**
```javascript
app.post('/api/clients', auth, async (req, res) => {
  const { name, address, phone, email, rate, service_notes, key_code, alarm_code, pet_instructions } = req.body;
  const { data, error } = await supabase.from('clients').insert({
    name, address, phone, email, rate: Number(rate) || 0,
    cleaning_notes: service_notes || null,
    key_code: key_code || null, alarm_code: alarm_code || null,
    pet_instructions: pet_instructions || null,
    user_id: req.user.id,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
```

**Fix (clients PUT):**
```javascript
app.put('/api/clients/:id', auth, async (req, res) => {
  const { name, address, phone, email, rate, service_notes, key_code, alarm_code, pet_instructions } = req.body;
  const allowed = { name, address, phone, email, rate: Number(rate) || 0,
    cleaning_notes: service_notes || null,
    key_code: key_code || null, alarm_code: alarm_code || null,
    pet_instructions: pet_instructions || null,
  };
  // Remove undefined values so we don't overwrite with null
  Object.keys(allowed).forEach(k => allowed[k] === undefined && delete allowed[k]);
  const { data, error } = await supabase.from('clients')
    .update(allowed).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
```

**Fix (jobs POST + PUT):** Apply the same whitelist pattern for jobs: `{ title, scheduled_date, scheduled_time, duration_minutes, status, route_order, recurrence_rule, notes }`.

---

### 3. Express API Missing All Rate Limiting
**File:** `server/index.js:1-150`  
**Status:** ✅ CONFIRMED

**What's wrong:** Every endpoint — auth-gated or not — has zero rate limiting. This makes the API vulnerable to brute-force attacks, resource exhaustion, and abuse.

**Fix:**
```javascript
const rateLimit = require('express-rate-limit');

// General API rate limit: 100 requests per 15 minutes
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Stripe endpoints: stricter limit
app.use('/api/stripe/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
}));
```

---

### 4. Invoice Email HTML Injection
**File:** `server/index.js:115`  
**Status:** ✅ CONFIRMED — XSS in outbound emails

```javascript
html: `<p>Hi ${client.name},</p><p>Here's your lawn care invoice for $${amount}...`
```

**What's wrong:** `client.name` is interpolated directly into HTML. A client named `<img src=x onerror=alert(1)>` would inject HTML into every invoice email.

**Fix:**
```javascript
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// In the email sending code:
html: `<p>Hi ${escapeHtml(client.name)},</p><p>Here's your lawn care invoice for $${escapeHtml(String(amount))}. <a href="${process.env.APP_URL}/pay/${invoice.id}">Pay online</a></p>`,
```

---

## HIGH

### 5. AI Autopilot Status Mismatch: `completed`/`skipped` vs App Statuses
**File:** `client/src/lib/autopilotTools.js:496-502, 510`  
**Status:** ✅ CONFIRMED — breaks core autopilot feature

```javascript
// updateJobStatus sets 'completed' or 'skipped'
case 'updateJobStatus': {
  const { jobId, status } = args;
  await updateJobStatus(jobId, status); // status = 'completed' | 'skipped'
}

// invoiceCompletedJobs filters for 'completed'
const completed = allJobs.filter(
  j => j.scheduled_date === invoiceDate && j.status === 'completed'
);
```

**What's wrong:** The app's STATUS_CONFIG uses `scheduled`, `in_progress`, `done`. The autopilot uses `completed` and `skipped`, which aren't in STATUS_CONFIG. This means:
- Jobs marked via autopilot render with `STATUS_CONFIG.scheduled` fallback (wrong badge/color)
- Today view shows autopilot-completed jobs as "Scheduled" instead of "Done"
- `invoiceCompletedJobs` WILL find jobs set to `completed` (filter matches), BUT the Today view won't show them as done

**Fix:**
```javascript
case 'updateJobStatus': {
  const { jobId, status } = args;
  // Map autopilot statuses to app statuses
  const statusMap = { completed: 'done', skipped: 'scheduled' };
  const appStatus = statusMap[status] || status;
  await updateJobStatus(jobId, appStatus);
  return {
    success: true,
    data: { jobId, status: appStatus, message: `Job marked as ${appStatus}` }
  };
}
```

And update the tool description to use app-native statuses:
```javascript
{
  name: 'updateJobStatus',
  description: "Mark a job as done or reschedule it. Use 'done' when the job is complete (this may trigger invoicing). Use 'scheduled' to reschedule/cancel.",
  parameters: {
    type: 'object',
    properties: {
      jobId: { type: 'string', description: 'Job ID to update' },
      status: { type: 'string', enum: ['done', 'scheduled'], description: 'New status: done or scheduled' }
    },
    required: ['jobId', 'status']
  }
}
```

---

### 6. AI Autopilot Sends Full Client PII to Third-Party LLM
**File:** `client/src/hooks/useAutopilot.js:91-108`  
**Status:** ✅ CONFIRMED — privacy risk

The autopilot sends the full conversation history — including all tool results with client names, addresses, phone numbers, gate codes, alarm codes, and pet instructions — to OpenRouter's API. The system prompt tells the LLM to "keep gate codes private," but the data is still transmitted to the third-party API.

**Fix:**
1. Add a privacy disclosure banner in the chat UI explaining what data is sent to the AI
2. Redact sensitive fields (gate codes, alarm codes) before sending to the LLM:
```javascript
// In formatClient / formatJob, redact sensitive fields before sending to LLM
function formatClientForLLM(c) {
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.phone,
    email: c.email,
    rate: c.rate,
    serviceNotes: c.service_notes || '',
    // Gate codes and alarm codes redacted — user can ask for them explicitly
  };
}
```
3. Add a settings toggle to disable AI features for privacy-conscious users

---

### 7. No Security Headers on Express Server
**File:** `server/index.js:1-150`  
**Status:** ✅ CONFIRMED

**What's wrong:** The Express server sets no security headers — no Content-Security-Policy, no HSTS, no X-Frame-Options, no X-Content-Type-Options.

**Fix:**
```javascript
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: false, // Let Cloudflare handle CSP
  crossOriginEmbedderPolicy: false,
}));
```

---

### 8. `invoiceCompletedJobs` Tool Sends Invoices Without Confirmation
**File:** `client/src/lib/autopilotTools.js:505-551`  
**Status:** ✅ CONFIRMED — user trust issue

When the AI creates invoices for completed jobs, each `createInvoice` call could trigger an email (via the Express server). The LLM doesn't ask for confirmation before invoicing.

**Fix:** Update the tool description to enforce confirmation:
```javascript
{
  name: 'invoiceCompletedJobs',
  description: "Create invoices for completed jobs. IMPORTANT: Before calling this tool, list the jobs and amounts and ALWAYS ask for user confirmation. Only call this tool after the user explicitly approves.",
  parameters: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Date to invoice for (defaults to today)' }
    },
    required: []
  }
}
```

---

## MEDIUM

### 9. No User Feedback on Failed Operations in Today View
**File:** `client/src/pages/Today.jsx:47-61`  
**Status:** ✅ CONFIRMED

```javascript
const createJobHandler = useCallback(async (e) => {
  try {
    const newJob = await createJob({ ... });
  } catch (err) { console.error('createJob:', err); }
  // No UI feedback
}, [form, date, setJobs]);
```

**What's wrong:** When `createJob` fails, the error is only logged to `console.error`. The user receives no visual feedback.

**Fix:**
```javascript
catch (err) {
  console.error('createJob:', err);
  setCompletedToast({ name: 'Failed to create job — try again', amount: 0, type: 'error' });
  setTimeout(() => setCompletedToast(null), 4000);
}
```

---

### 10. Autopilot `sendPaymentReminders` Tool is a No-Op
**File:** `client/src/lib/autopilotTools.js:393-407`  
**Status:** ✅ CONFIRMED — misleading

```javascript
return {
  success: true,
  data: { sent: unpaid.length, note: 'SMS integration pending...' }
};
```

Reports `sent: N` (implying messages were sent) when nothing was sent. The LLM will tell users "Reminders sent to 5 clients" when nothing happened.

**Fix:**
```javascript
return {
  success: true,
  data: {
    sent: 0,
    message: 'SMS integration not available yet. Here are the clients with unpaid invoices — you can contact them manually from the Invoices tab.',
    clients: unpaid.map(inv => ({
      name: inv.clients?.name,
      amount: inv.amount,
    })),
  }
};
```

---

### 11. Service Worker Caches All API Responses Including Supabase
**File:** `client/public/sw.js:69-88`  
**Status:** ✅ CONFIRMED

```javascript
event.respondWith(
  fetch(event.request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
      }
      return response;
    })
```

**What's wrong:** The service worker caches ALL successful GET responses, including Supabase REST API calls and auth token responses. This means:
- Stale data shown after reconnecting
- Cached auth tokens (short-lived JWTs, but still a concern)

**Fix:**
```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Skip chrome-extension and non-HTTP requests
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname === 'm.stripe.network') return;

  // Don't cache Supabase API calls or auth endpoints
  if (url.pathname.startsWith('/rest/v1/') ||
      url.pathname.startsWith('/auth/') ||
      url.pathname.includes('supabase')) {
    return; // Let the browser handle these normally
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline — check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});
```

---

### 12. N+1 API Calls During Drag Reorder
**File:** `client/src/pages/Today.jsx:160-166`  
**Status:** ✅ CONFIRMED — refines Pass 1

The server has a `/api/jobs/reorder` batch endpoint (server/index.js:86-92), but the client-side `reorderWithinDate` function calls `updateJob()` individually for each job, bypassing the batch endpoint entirely.

**Fix:** Use the batch endpoint or a single Supabase batch:
```javascript
// Instead of forEach + individual updateJob:
async function persistReorder(updated, currentDate) {
  const updates = updated
    .filter(j => j.scheduled_date === currentDate)
    .map(j => ({ id: j.id, route_order: j.route_order }));

  // Option A: Use Express batch endpoint
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (token) {
    await fetch('/api/jobs/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orders: updates }),
    });
  }
}
```

---

### 13. Chat Drawer Doesn't Trap Focus
**File:** `client/src/components/Layout.jsx:124-157`  
**Status:** ✅ CONFIRMED — accessibility violation (WCAG 2.4.3)

**Fix:**
```jsx
useEffect(() => {
  if (!chatOpen) return;
  const drawer = document.querySelector('[role="dialog"]');
  if (!drawer) return;
  const focusable = drawer.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
  focusable?.[0]?.focus();

  function handleTab(e) {
    if (e.key !== 'Tab') return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }
  drawer.addEventListener('keydown', handleTab);
  return () => drawer.removeEventListener('keydown', handleTab);
}, [chatOpen]);
```

Also add `role="dialog"` and `aria-modal="true"` to the drawer panel div.

---

### 14. `getRevenue` Tool Has Wrong Date Logic for `last_month`
**File:** `client/src/lib/autopilotTools.js:431-433`  
**Status:** NEW — found in Pass 2

```javascript
case 'last_month': {
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  break;
}
```

**What's wrong:** `startDate` is set to the 1st of last month, but `endDate` is always `now.toISOString().split('T')[0]` (today). So "last month" revenue includes payments from the start of last month through today — including current month's payments. For example, if today is July 25, "last month" shows June 1 – July 25 instead of June 1 – June 30.

**Fix:**
```javascript
case 'last_month': {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  const ly = d.getFullYear();
  const lm = d.getMonth(); // 0-indexed
  startDate = `${ly}-${String(lm + 1).padStart(2, '0')}-01`;
  // Set endDate to last day of that month
  const lastDay = new Date(ly, lm + 1, 0).getDate();
  endDate = `${ly}-${String(lm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  break;
}
```

Then use `endDate` (which is now local to the case block) instead of the global `endDate` on line 444. Refactor: set `endDate` inside each case block.

---

### 15. Client-Side Supabase Calls Bypass Express Server Validation
**File:** `client/src/lib/data.js` (entire file)  
**Status:** NEW — found in Pass 2

All CRUD operations in data.js go directly to Supabase, bypassing the Express server entirely. This means:
1. Any Express-level validation (which doesn't exist yet) is irrelevant
2. The web client's security depends entirely on Supabase RLS policies
3. The Express server is only used for Stripe and email operations

This isn't a bug per se — it's an architectural decision — but it means the Express server's auth middleware and user_id filtering provide zero protection for web client requests. If RLS is misconfigured, the web client is fully exposed.

**Recommendation:** Document this clearly. Either:
- Route all client operations through the Express server (adds latency but centralizes validation)
- Or add prominent comments in data.js explaining the RLS dependency and ensure RLS policies are bulletproof

---

### 16. Autopilot `createInvoice` Doesn't Send Emails
**File:** `client/src/lib/autopilotTools.js:365-391`, `client/src/lib/data.js:276-310`  
**Status:** NEW — found in Pass 2

The autopilot's `createInvoice` tool calls data.js's `createInvoice()`, which inserts directly into Supabase. The Express server's `POST /api/invoices` endpoint (server/index.js:101-120) is the one that sends emails via Resend. Since the autopilot never calls the Express endpoint, **invoices created via autopilot are never emailed to clients**.

**Fix:** After creating the invoice via Supabase, trigger the email through the Express server:
```javascript
case 'createInvoice': {
  const { clientName, amount, description } = args;
  // ... existing client lookup code ...

  const invoice = await createInvoice({
    client_id: client.id,
    amount,
    description
  });

  // Send email via Express server
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (token) {
      await fetch('/api/invoices/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: invoice.id, client_id: client.id, amount }),
      });
    }
  } catch { /* email failure is non-fatal */ }

  return { success: true, data: { invoice: { ... } } };
}
```

---

### 17. PWA Manifest Theme Color Mismatch
**File:** `client/public/manifest.json:8`, `client/index.html:11`  
**Status:** ✅ CONFIRMED

Both `manifest.json` (`"theme_color": "#0ea5e9"`) and `index.html` (`<meta name="theme-color" content="#0ea5e9">`) use sky blue, but the app's primary color is emerald green.

**Fix:**
```json
// manifest.json
"theme_color": "#10b981"
```
```html
<!-- index.html -->
<meta name="theme-color" content="#10b981" />
```

---

### 18. No Error Boundaries
**File:** `client/src/App.jsx`  
**Status:** ✅ CONFIRMED

If any component throws during render, the entire app crashes with a blank screen.

**Fix:** Add an error boundary in App.jsx:
```jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{this.state.error.message}</p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap in App():
<ErrorBoundary>
  <HashRouter>
    {/* ... */}
  </HashRouter>
</ErrorBoundary>
```

---

### 19. No Client-Side Form Validation Beyond `required`
**File:** `client/src/pages/Clients.jsx:146`, `client/src/components/NewJobForm.jsx`  
**Status:** ✅ CONFIRMED

- Phone field accepts any string (no format validation)
- Email field uses `<input>` without `type="email"` (line 146)
- Rate allows negative values with `min="0"` but `parseFloat` could produce NaN

**Fix (Clients.jsx):**
```jsx
<input type="email" placeholder="jane@email.com" value={form.email}
  onChange={e => setForm({ ...form, email: e.target.value })}
  className="input" />
```

Add validation helpers:
```javascript
const validatePhone = (phone) => !phone || /^[\d\s\-()+ ]{7,}$/.test(phone);
const validateEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
```

---

### 20. `getClientHistory` Tool is a Misleading Alias
**File:** `client/src/lib/autopilotTools.js:341-344`  
**Status:** NEW — found in Pass 2

```javascript
case 'getClientHistory': {
  const { clientName } = args;
  return executeTool('getClientInfo', { clientName });
}
```

The tool description promises "job history, payment status, and service frequency" but it returns exactly the same data as `getClientInfo`. The LLM will present it as if it got different data.

**Fix:** Either remove the alias and update `getClientInfo`'s description, or add actual history-specific data (service frequency calculation, total revenue per client, etc.).

---

## LOW

### 21. `geo:` URI Scheme Unreliable on Android
**File:** `client/src/lib/maps.js:15`  
**Status:** ✅ CONFIRMED

```javascript
if (isAndroid) return `geo:0,0?q=${q}`;
```

**Fix:**
```javascript
if (isAndroid) return `https://www.google.com/maps/search/?api=1&query=${q}`;
```

---

### 22. Print Schedule Opens Popup (May Be Blocked)
**File:** `client/src/lib/ics.js:82`  
**Status:** ✅ CONFIRMED

```javascript
const w = window.open('', '_blank');
```

**Fix:**
```javascript
const w = window.open('', '_blank');
if (!w) {
  alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
  return;
}
```

---

### 23. `retry` Function Uses `setTimeout` Inside `setMessages`
**File:** `client/src/hooks/useAutopilot.js:240-254`  
**Status:** ✅ CONFIRMED — fragile pattern

**Fix:** Move the send call outside the state updater using a ref:
```javascript
const retry = useCallback(() => {
  let lastUserText = null;
  setMessages(prev => {
    const last = prev[prev.length - 1];
    const cleaned = last?.isError ? prev.slice(0, -1) : prev;
    for (let i = cleaned.length - 1; i >= 0; i--) {
      if (cleaned[i].role === 'user') {
        lastUserText = cleaned[i].content;
        return cleaned.slice(0, i);
      }
    }
    return cleaned;
  });
  // Use ref to avoid stale closure
  if (lastUserText) {
    setTimeout(() => sendMessageRef.current?.(lastUserText), 0);
  }
}, []);
```

Note: `lastUserText` must be declared outside `setMessages` since the updater is synchronous but the ref read happens after.

---

### 24. `subscribe` Page Leaks Stripe Session ID in URL
**File:** `client/src/pages/Subscribe.jsx:7, 16`  
**Status:** ✅ CONFIRMED

**Fix:** Clear the query parameter after verification:
```javascript
// After successful verification
window.history.replaceState({}, '', window.location.pathname);
```

---

### 25. `useEffect` Missing Dependencies
**File:** `client/src/hooks/useAutopilot.js:80`  
**Status:** ✅ CONFIRMED — intentional pattern

The `sendMessage` callback has `[]` dependencies but uses refs. This is intentional and correct, but would confuse ESLint's `exhaustive-deps` rule.

**Fix:**
```javascript
const sendMessage = useCallback(async (userText) => {
  // ...
}, []); // Uses refs for latest state — stable by design
```

---

### 26. Duplicate Weather API Calls on App Load
**File:** `client/src/pages/Home.jsx:87-109`, `client/src/lib/useWeather.js:8-32`  
**Status:** ✅ CONFIRMED

Both Home.jsx and Today.jsx (via useWeather hook) independently call the Open-Meteo API. No shared cache.

**Fix:** Create a shared weather context or use React Query/SWR for deduplication and caching.

---

### 27. iOS Native App `isDemoMode` Always Returns `true`
**File:** `ios-native/MowFlow/Services/AuthService.swift`  
**Status:** ✅ CONFIRMED (pass-through from Pass 1)

The iOS app is hardcoded to demo mode, bypassing authentication.

---

### 28. `apple-touch-icon` Points to SVG
**File:** `client/index.html:6`  
**Status:** PARTIALLY REFUTED

The tag exists (`<link rel="apple-touch-icon" href="/icon.svg">`) but points to an SVG. iOS Safari works best with PNG for `apple-touch-icon`. The SVG may work on modern iOS but isn't ideal.

**Fix:** Use the PNG icon:
```html
<link rel="apple-touch-icon" href="/icon-180.png">
```

---

### 29. Stripe Webhook Doesn't Validate Invoice Amount
**File:** `server/index.js:142-145`  
**Status:** NEW — found in Pass 2

```javascript
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  await supabase.from('invoices').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: session.payment_intent
  }).eq('id', session.metadata.invoice_id);
}
```

The webhook doesn't verify that the payment amount matches the invoice amount. While Stripe's signature verification prevents replay attacks, a compromised checkout session (if amount validation is bypassed via finding #1) could mark an invoice as paid for a different amount.

**Fix:** Validate the amount in the webhook:
```javascript
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const invoiceId = session.metadata.invoice_id;
  if (!invoiceId) break;

  // Verify payment amount matches invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('amount')
    .eq('id', invoiceId)
    .single();

  if (!invoice) break;

  const paidAmount = (session.amount_total || 0) / 100;
  if (Math.abs(paidAmount - invoice.amount) > 0.01) {
    console.error(`Amount mismatch: invoice=${invoice.amount}, paid=${paidAmount}`);
    break;
  }

  await supabase.from('invoices').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: session.payment_intent,
  }).eq('id', invoiceId);
}
```

---

### 30. `saveProfile` Can Upsert Arbitrary Profile Fields
**File:** `client/src/lib/data.js:344`  
**Status:** NEW — found in Pass 2

```javascript
const { error } = await supabase.from('profiles').upsert({ id: user.id, ...profile });
```

Spreads `profile` without validation. Could overwrite fields like `stripe_customer_id` if they exist in the profiles table.

**Fix:** Whitelist allowed profile fields:
```javascript
export async function saveProfile(profile) {
  if (isDemoMode()) return profile;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { business_name, phone, avatar_url } = profile;
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    business_name, phone, avatar_url,
  });
  if (error) throw error;
  return { business_name, phone, avatar_url };
}
```

---

### 31. No Touch Support for Job Reorder on Mobile
**File:** `client/src/pages/Today.jsx:131-176`  
**Status:** NEW — found in Pass 2

Drag-and-drop reordering uses HTML5 drag events which don't work on touch devices. The keyboard reorder buttons are `sr-only` (screen reader only), so touch users have no way to reorder jobs.

**Fix:** Add touch-based reorder (long-press to initiate, drag to reorder) or visible reorder buttons on mobile.

---

### 32. Missing CSRF Protection on Express API
**File:** `server/index.js:9`  
**Status:** NEW — found in Pass 2

```javascript
app.use(cors());
```

CORS allows ALL origins. While the app uses Bearer tokens (not cookies), restricting CORS to the app's domain is still best practice.

**Fix:**
```javascript
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
}));
```

---

## POSITIVE OBSERVATIONS

Things the codebase does well:

1. **Consistent dark mode** — Full dark mode support across all components with proper Tailwind `dark:` variants
2. **Offline-aware design** — Service worker, offline banner, and IndexedDB fallback for offline storage
3. **Good accessibility basics** — Skip-to-content link, `aria-label` on most interactive elements, `role="progressbar"`, keyboard navigation support on job cards
4. **Safe area insets** — Proper `env(safe-area-inset-*)` usage for iOS notch/home indicator
5. **Thoughtful UX patterns** — Optimistic updates with rollback for rain delay, auto-scroll that respects user scroll position in chat, haptic-friendly 44px touch targets
6. **Clean data layer** — `data.js` abstracts Supabase vs demo mode perfectly, making the app fully functional in demo without any backend
7. **Good error recovery** — Stripe webhook verification, Supabase error redirect handling, graceful offline fallback
8. **Memoization** — `memo(JobCard)`, `useMemo` for expensive computations, `useCallback` for stable references
9. **Consistent HTML escaping** — `ics.js` has proper `escapeHtml` and `escapeICS` functions; `printSchedule` escapes all user data
10. **Batch endpoint exists** — Server has `/api/jobs/reorder` for batch operations (needs client adoption)

---

## Pass 3 — Code Quality Review (Qwen3 Coder)

### Code Quality Issues

#### 1. Missing Error Boundaries

**File:** `client/src/App.jsx`  
**Issue:** The entire application lacks error boundaries, which means any unhandled exception in a component will crash the entire app with a blank screen.

**Fix:**
```javascript
import React from 'react';

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{this.state.error.message}</p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap in App():
<ErrorBoundary>
  <HashRouter>
    {/* ... */}
  </HashRouter>
</ErrorBoundary>
```

#### 2. Inconsistent Status Handling in Autopilot

**File:** `client/src/lib/autopilotTools.js`  
**Issue:** The autopilot tools use inconsistent status values (`completed`/`skipped`) that don't match the application's `STATUS_CONFIG` (`scheduled`, `in_progress`, `done`). This causes UI inconsistencies.

**Fix:**
```javascript
case 'updateJobStatus': {
  const { jobId, status } = args;
  // Map autopilot statuses to app statuses
  const statusMap = { completed: 'done', skipped: 'scheduled' };
  const appStatus = statusMap[status] || status;
  await updateJobStatus(jobId, appStatus);
  return {
    success: true,
    data: { jobId, status: appStatus, message: `Job marked as ${appStatus}` }
  };
}
```

#### 3. useEffect Dependency Issues

**File:** `client/src/hooks/useAutopilot.js:80`  
**Issue:** The `sendMessage` callback has `[]` dependencies but uses refs. While intentional, this pattern would confuse ESLint's `exhaustive-deps` rule and is fragile.

**Fix:**
```javascript
const sendMessage = useCallback(async (userText) => {
  // ...
}, []); // Uses refs for latest state — stable by design
```

#### 4. Missing Memoization Opportunities

**File:** `client/src/pages/Home.jsx`  
**Issue:** Several computations are not memoized, causing unnecessary re-renders.

**Fix:**
```javascript
// Memoize expensive computations
const clientList = useMemo(() => clients ?? demoClients, [clients]);
const calendarGrid = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth]);
const jobsByDate = useMemo(() => {
  const map = {};
  jobs.forEach(j => {
    if (!map[j.scheduled_date]) map[j.scheduled_date] = [];
    map[j.scheduled_date].push(j);
  });
  return map;
}, [jobs]);
```

#### 5. Promise Handling Issues

**File:** `client/src/pages/Today.jsx:57`  
**Issue:** Error handling is incomplete - only logs to console without providing user feedback.

**Fix:**
```javascript
catch (err) { 
  console.error('createJob:', err); 
  setCompletedToast({ name: 'Failed to create job — try again', amount: 0, type: 'error' });
  setTimeout(() => setCompletedToast(null), 4000);
}
```

#### 6. Supabase Query Optimization Opportunities

**File:** `client/src/lib/data.js`  
**Issue:** Several queries could be optimized by using select clauses more specifically and reducing over-fetching.

**Fix:**
```javascript
// Instead of selecting all columns, only select what's needed
const { data, error } = await supabase
  .from('jobs')
  .select('id,client_id,title,scheduled_date,scheduled_time,duration_minutes,status,route_order,recurrence_rule')
  .eq('user_id', user.id)
  .order('route_order', { ascending: true });
```

#### 7. Type Safety Issues

**File:** `client/src/pages/Clients.jsx:146`  
**Issue:** Form inputs lack proper validation and type checking.

**Fix:**
```javascript
// Add validation helpers
const validatePhone = (phone) => !phone || /^[\d\s\-()+ ]{7,}$/.test(phone);
const validateEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// In form:
<input type="email" placeholder="jane@email.com" value={form.email}
  onChange={e => setForm({ ...form, email: e.target.value })}
  className="input" />
```

#### 8. N+1 API Calls During Drag Reorder

**File:** `client/src/pages/Today.jsx:160-166`  
**Issue:** Individual API calls for each job reorder instead of using the batch endpoint.

**Fix:**
```javascript
// Use the batch endpoint or a single Supabase batch:
async function persistReorder(updated, currentDate) {
  const updates = updated
    .filter(j => j.scheduled_date === currentDate)
    .map(j => ({ id: j.id, route_order: j.route_order }));

  // Option A: Use Express batch endpoint
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (token) {
    await fetch('/api/jobs/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orders: updates }),
    });
  }
}
```

#### 9. Inefficient Re-renders in Components

**File:** `client/src/components/JobCard.jsx`  
**Issue:** Component is properly memoized but could benefit from additional `useMemo` for expensive calculations.

**Fix:**
```javascript
// Memoize expensive calculations
const recurrenceLabel = useMemo(() => 
  job.recurrence && job.recurrence !== 'none'
    ? RECURRENCE_OPTIONS.find(r => r.value === job.recurrence)?.label
    : null, 
  [job.recurrence]
);

const statusInfo = useMemo(() => 
  STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled,
  [job.status]
);
```

#### 10. Missing Input Validation

**File:** `client/src/pages/Clients.jsx:147`  
**Issue:** Rate input allows negative values and doesn't properly validate numeric input.

**Fix:**
```javascript
<input 
  type="number" 
  min="0" 
  placeholder="120" 
  value={form.rate} 
  onChange={e => {
    const value = parseFloat(e.target.value);
    setForm({ ...form, rate: isNaN(value) ? 0 : Math.max(0, value) });
  }} 
  className="input" 
/>
```

#### 11. Unhandled Promise Rejections

**File:** `client/src/lib/data.js`  
**Issue:** Some async operations lack proper error handling, which could lead to unhandled promise rejections.

**Fix:**
```javascript
// Ensure all async operations have proper error handling
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  throw error; // Re-throw to let caller handle
}
```

#### 12. Inconsistent Error Handling Patterns

**File:** Multiple files throughout the codebase  
**Issue:** Error handling is inconsistent - some errors are only logged to console, others show user feedback.

**Fix:**
```javascript
// Standardize error handling with consistent user feedback
const handleError = (error, userMessage) => {
  console.error(error);
  // Show user-friendly message
  setToast({ 
    message: userMessage || 'Something went wrong. Please try again.', 
    type: 'error' 
  });
};

// Use consistently:
try {
  await someOperation();
} catch (error) {
  handleError(error, 'Failed to complete operation');
}
```

#### 13. Missing React Hooks Rules Compliance

**File:** `client/src/hooks/useAutopilot.js`  
**Issue:** Some hook usage patterns could be fragile without proper eslint-plugin-react-hooks.

**Fix:**
```javascript
// Ensure all hooks follow the Rules of Hooks
// 1. Only call hooks at the top level
// 2. Only call hooks from React function components or custom hooks

// Good pattern:
const useCustomHook = () => {
  const [state, setState] = useState(initialValue);
  const memoizedValue = useMemo(() => computeExpensiveValue(state), [state]);
  
  return { state, setState, memoizedValue };
};
```

#### 14. Improper State Update Patterns

**File:** `client/src/pages/Today.jsx`  
**Issue:** Some state updates use stale closure values due to improper dependency handling.

**Fix:**
```javascript
// Use functional updates when new state depends on previous state
setJobs(prevJobs => prevJobs.map(job => 
  job.id === jobId ? { ...job, status: newStatus } : job
));

// Instead of:
setJobs(jobs.map(job => 
  job.id === jobId ? { ...job, status: newStatus } : job
));
// (jobs might be stale in the closure)
```

#### 15. Lack of TypeScript Migration Opportunities

**File:** All JavaScript files  
**Issue:** The codebase is written in JavaScript but could benefit from TypeScript for better type safety and developer experience.

**Fix:**
```typescript
// Example migration from JS to TS
interface Job {
  id: string;
  client_id: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_minutes: number;
  status: 'scheduled' | 'in_progress' | 'done';
  route_order: number;
  recurrence: string;
  clients: Client | null;
}

// This would provide compile-time type checking and better IDE support
```

## RECOMMENDED PRIORITY ORDER

1. **Fix #1** (Stripe amount validation) — actively exploitable, allows paying any amount
2. **Fix #2** (request body whitelisting) — mass assignment vulnerability on all PUT endpoints
3. **Fix #3** (rate limiting) — low effort, high impact
4. **Fix #5** (autopilot status mismatch) — breaks a core feature, jobs show wrong status
5. **Fix #4** (email HTML injection) — XSS in outbound emails before sending real invoices
6. **Fix #11** (service worker caching) — stale data and cached auth tokens
7. **Fix #7** (security headers) — quick win with helmet
8. **Fix #6** (privacy disclosure) — before marketing AI features
9. **Fix #14** (revenue date logic) — "last month" shows wrong data
10. **Fix #16** (autopilot invoice emails) — invoices created via AI never reach clients
11. **Fix #9** (error feedback) — major UX gap
12. **Fix #10** (payment reminders) — misleading tool response
13. **Fix #12, #13** (confirmation + focus trap) — trust and accessibility
14. **Fix #18** (error boundaries) — app stability
15. **Fix #19** (form validation) — data integrity
16. **Fix #26** (duplicate weather calls) — performance
17. **Fix #31** (touch reorder) — mobile UX
18. **Fix #21** (Android maps URI) — Android UX
19. **Fix #22** (popup blocking) — print UX
20. **Everything else** — polish and hardening
