// NOTE: CF dashboard Rate Limiting rules recommended for production-grade limits (per-isolate map is best-effort).
// Signup instant touch. POST { email } with a Bearer session token right
// after successful auth. Cross-source dedup: if an 'instant' lead_touches
// row already exists for this email (e.g. route-audit ran first), this is a
// no-op — no day2/day7 rows, no welcome email. lead_touches rows created
// here are always channel='email' — signup collects no phone number.
const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 20;
const attempts = new Map();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ORIGINS = ['https://mowgo.pages.dev', 'https://mowgoapp.com'];

function corsOrigin(request) {
  const origin = request?.headers?.get?.('origin');
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgo.pages.dev';
}

function json(body, status = 200, origin = 'https://mowgo.pages.dev') {
  return Response.json(body, { status, headers: { 'Access-Control-Allow-Origin': origin } });
}

function welcomeHtml() {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6"><h1>Welcome to MowGo</h1><p>3 steps to your first scheduled job:</p><ol><li>Add your first client.</li><li>Schedule their first job.</li><li>Mark it complete — the invoice is created automatically.</li></ol><p>Want us to set you up? Reply and we'll import your clients (Solo, Crew &amp; Premium — 48h setup).</p><p><a href="https://mowgoapp.com/#/app">Open MowGo</a></p></body></html>`;
}

async function sendWelcomeEmail(env, email) {
  if (!env.RESEND_API_KEY) { console.warn('Welcome email skipped: RESEND_API_KEY is not configured'); return; }
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'MowGo <invoices@mowgoapp.com>', to: email, subject: 'Welcome to MowGo — 3 steps to your first scheduled job', html: welcomeHtml() }) });
    if (!response.ok) console.warn('Welcome email failed:', response.status, await response.text());
  } catch (error) { console.warn('Welcome email failed:', error?.message || error); }
}

function allowed(key) {
  const now = Date.now();
  const hits = (attempts.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) return false;
  hits.push(now);
  attempts.set(key, hits);
  return true;
}

export async function onRequestOptions(request) {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': corsOrigin(request), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const origin = corsOrigin(request);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server misconfigured' }, 500, origin);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Invalid token' }, 401, origin);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, origin); }
  const rawEmail = typeof body?.email === 'string' ? body.email.trim() : '';
  // Email is always sourced from the verified session token below — the body
  // field (when present, e.g. Dashboard's LeadTouchPing sends { email }) is
  // only used as an optional equality cross-check and is never trusted on
  // its own. Any mismatch rejects with 401.
  const emailParam = rawEmail || null;

  try {
    const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY } });
    if (!userResponse.ok) return json({ error: 'Invalid token' }, 401, origin);
    const user = await userResponse.json();
    const userEmail = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!userEmail) return json({ error: 'No email on account.' }, 400, origin);
    // Cross-check: submitted email (if any) must match the authenticated user.
    if (emailParam && emailParam.toLowerCase() !== userEmail) {
      console.warn('lead-touch email mismatch', { submitted: emailParam, token_email: userEmail });
      return json({ error: 'Invalid token' }, 401, origin);
    }
    const emailLower = userEmail;

    // Per-user+IP rate limit: 20 per 15 min (after auth, in-memory
    // per-isolate — same pattern as concierge-submit/booking).
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!allowed(`${user.id}:${ip}`)) return json({ error: 'Too many requests — try again later.' }, 429, origin);

    const svcHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    const instantRes = await fetch(`${env.SUPABASE_URL}/rest/v1/lead_touches`, {
      method: 'POST',
      headers: svcHeaders,
      body: JSON.stringify({ source: 'signup', user_id: user.id, lead_email: emailLower, lead_phone: null, kind: 'instant', channel: 'email', status: 'sent', sent_at: new Date().toISOString() }),
    });
    if (!instantRes.ok) {
      const text = await instantRes.text().catch(() => '');
      // Cross-source dedup: an 'instant' row already exists for this email
      // (e.g. route-audit ran first) — skip day2/day7 and the welcome email.
      if (instantRes.status === 409 || /23505|duplicate key/i.test(text)) return json({ success: true }, 200, origin);
      console.error('lead-touch instant insert failed', instantRes.status, text);
      return json({ error: 'Could not record signup touch.' }, 500, origin);
    }

    const background = Promise.all([
      fetch(`${env.SUPABASE_URL}/rest/v1/lead_touches`, {
        method: 'POST',
        headers: { ...svcHeaders, Prefer: 'return=minimal,resolution=ignore-duplicates' },
        body: JSON.stringify([
          { source: 'signup', user_id: user.id, lead_email: emailLower, lead_phone: null, kind: 'day2', channel: 'email', status: 'queued' },
          { source: 'signup', user_id: user.id, lead_email: emailLower, lead_phone: null, kind: 'day7', channel: 'email', status: 'queued' },
        ]),
      }).catch(error => console.warn('lead-touch follow-up insert failed', error?.message || error)),
      sendWelcomeEmail(env, emailLower),
    ]);
    if (typeof waitUntil === 'function') waitUntil(background); else background.catch(() => {});

    return json({ success: true }, 201, origin);
  } catch (error) {
    console.error('lead-touch failed', error);
    return json({ error: 'Something went wrong' }, 500, origin);
  }
}
