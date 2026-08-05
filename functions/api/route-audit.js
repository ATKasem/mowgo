const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;
const attempts = new Map();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIDPOINTS = { under_10: 7, '10_25': 17, '25_50': 37, '50_plus': 60 };
const CREWS = new Set(['solo', '2_3', '4_plus']);
const ALLOWED_ORIGINS = ['https://mowgo.pages.dev', 'https://mowgoapp.com'];

function corsOrigin(request) {
  const origin = request?.headers?.get?.('origin');
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgo.pages.dev';
}

function json(body, status = 200, origin = 'https://mowgo.pages.dev') {
  return Response.json(body, { status, headers: { 'Access-Control-Allow-Origin': origin } });
}
function allowed(ip) {
  const now = Date.now(); const entry = attempts.get(ip);
  if (!entry || now >= entry.reset) { attempts.set(ip, { count: 1, reset: now + WINDOW_MS }); return true; }
  if (entry.count >= LIMIT) return false;
  entry.count += 1; return true;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function emailHtml(name, hours, monthly, annual) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6"><h1>Your free route audit${name ? `, ${escapeHtml(name)}` : ''}</h1><p><strong>~${hours} hours/week</strong> potentially recoverable</p><p><strong>$${monthly.toLocaleString()}/month</strong> revenue impact</p><p><strong>$${annual.toLocaleString()}/year</strong> seasonal impact</p><p><em>Estimates based on industry averages.</em></p><h2>Here's the math</h2><p>Weekly lawns × 0.75 hours; weekly hours × 4.33 weeks × $45/hour; monthly impact × 12 × 0.6 seasonal factor (lawn season ≈ 7 months).</p><h2>3 quick fixes</h2><ol><li>Batch jobs by zone.</li><li>Block recurring clients on the same day.</li><li>Leave 15-minute buffers.</li></ol><p><a href="https://mowgoapp.com/#/">See how MowGo automates this</a></p></body></html>`;
}

async function sendEmail(env, name, email, hours, monthly, annual) {
  if (!env.RESEND_API_KEY) { console.warn('Route audit email skipped: RESEND_API_KEY is not configured'); return; }
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'MowGo <invoices@mowgoapp.com>', to: email, subject: `Your route audit: ~${hours} hrs/week on the table`, html: emailHtml(name, hours, monthly, annual) }) });
    if (!response.ok) console.warn('Route audit email failed:', response.status, await response.text());
  } catch (error) { console.warn('Route audit email failed:', error?.message || error); }
}

export async function onRequestOptions(request) {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': corsOrigin(request), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const origin = corsOrigin(request);
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  if (!allowed(ip)) return json({ error: 'Too many requests. Please try again later.' }, 429, origin);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Route audits are not configured.' }, 503, origin);
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400, origin);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const zip = typeof body.zip === 'string' ? body.zip.trim() : '';
    if (!name) return json({ error: 'Name is required.' }, 400, origin);
    if (name.length > 100) return json({ error: 'Name must be 100 characters or fewer.' }, 400, origin);
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400, origin);
    if (!/^\d{5}$/.test(zip)) return json({ error: 'Enter a valid 5-digit ZIP code.' }, 400, origin);
    if (!Object.hasOwn(MIDPOINTS, body.lawns_bucket)) return json({ error: 'Select a valid lawns-per-week range.' }, 400, origin);
    if (!CREWS.has(body.crew_bucket)) return json({ error: 'Select a valid crew size.' }, 400, origin);
    const rawHours = MIDPOINTS[body.lawns_bucket] * 0.75;
    const hours = Math.round(rawHours);
    const monthly = Math.round(rawHours * 4.33 * 45);
    const annual = Math.round(rawHours * 4.33 * 45 * 12 * 0.6);
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/route_audits`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name, email, zip, lawns_bucket: body.lawns_bucket, crew_bucket: body.crew_bucket, hours_wasted_week: hours, revenue_impact_month: monthly }) });
    if (!response.ok) { console.error('Route audit insert failed', response.status); return json({ error: 'Could not run audit. Please try again.' }, 500, origin); }
    const delivery = sendEmail(env, name, email, hours, monthly, annual);
    if (typeof waitUntil === 'function') waitUntil(delivery); else delivery.catch(() => {});
    return json({ success: true, report: { hours_wasted_week: hours, revenue_impact_month: monthly, annual_impact: annual } }, 201, origin);
  } catch { return json({ error: 'Could not run audit. Please try again.' }, 500, origin); }
}
