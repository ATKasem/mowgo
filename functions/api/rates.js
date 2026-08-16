// NOTE: CF dashboard Rate Limiting rules recommended for production-grade limits (per-isolate map is best-effort).
const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;
const attempts = new Map();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ORIGINS = ['https://mowgoapp.com'];

// Same 10 OK cities/prices as client/src/pages/Rates.jsx CITY_PRICES — keep
// both in sync by hand (separate runtimes: SPA bundle vs CF function).
const CITY_PRICES = [
  ['Broken Arrow', '$67.08'],
  ['Claremore', '$65.13'],
  ['Yukon', '$59.36'],
  ['Edmond', '$58.02'],
  ['Tulsa', '$56.93'],
  ['Oklahoma City', '$54.73'],
  ['Norman', '$52.89'],
  ['Guthrie', '$51.22'],
  ['Chickasha', '$50.82'],
  ['Bethany', '$48.01'],
];
const CITY_SET = new Set(CITY_PRICES.map(([city]) => city));
const STATE_AVERAGE = '$55.25';

const YARD_SIZES = [
  ['1/8 acre', '$30.39', '$34.81', '$35.36'],
  ['1/4 acre', '$39.78', '$45.31', '$46.96'],
  ['1/3 acre', '$52.49', '$53.04', '$60.22'],
  ['1/2 acre', '$65.75', '$75.70', '$78.46'],
  ['1 acre', '$102.22', '$107.19', '$119.34'],
];

function corsOrigin(request) {
  const origin = request?.headers?.get?.('origin');
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com';
}

function json(body, status = 200, origin = 'https://mowgoapp.com') {
  return Response.json(body, { status, headers: { 'Access-Control-Allow-Origin': origin } });
}
function allowed(ip) {
  const now = Date.now(); const entry = attempts.get(ip);
  if (!entry || now >= entry.reset) { attempts.set(ip, { count: 1, reset: now + WINDOW_MS }); return true; }
  if (entry.count >= LIMIT) return false;
  entry.count += 1; return true;
}

function cell(value, align = 'left') {
  return `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:${align}">${value}</td>`;
}

function emailHtml() {
  const cityRows = CITY_PRICES.map(([city, price]) => `<tr>${cell(city)}${cell(price, 'right')}</tr>`).join('');
  const yardRows = YARD_SIZES.map(([size, weekly, biweekly, monthly]) => `<tr>${cell(size)}${cell(weekly, 'right')}${cell(biweekly, 'right')}${cell(monthly, 'right')}</tr>`).join('');
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6">
<h1>Your Oklahoma Lawn Rates Report</h1>
<p>Here's what OK lawn crews are actually charging right now, city by city and by yard size.</p>
<h2>City averages</h2>
<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;border-bottom:2px solid #a7f3d0"><th style="padding:6px 10px">City</th><th style="padding:6px 10px;text-align:right">Avg. mow price</th></tr></thead><tbody>${cityRows}</tbody></table>
<p><strong>Oklahoma state average: ${STATE_AVERAGE}</strong> per mow, across all yard sizes.</p>
<h2>By yard size</h2>
<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;border-bottom:2px solid #a7f3d0"><th style="padding:6px 10px">Yard size</th><th style="padding:6px 10px;text-align:right">Weekly</th><th style="padding:6px 10px;text-align:right">Bi-weekly</th><th style="padding:6px 10px;text-align:right">Monthly</th></tr></thead><tbody>${yardRows}</tbody></table>
<h2>The revenue math</h2>
<p>$52.49/cut → ~$1,365/yr per customer (26 cuts). 20 customers = $27,300/yr. 30 customers = $41,000/yr. Extras like fertilization, edging, and cleanups add 30%+ on top.</p>
<h2>A few honest caveats</h2>
<ol>
<li>The market sets your ceiling — your work sets your price within it.</li>
<li>Yard size dominates the price more than city does.</li>
<li>Raise rates on new customers first; grandfather your loyal ones in.</li>
<li>Reliability beats a rate bump — showing up matters more than being cheap.</li>
</ol>
<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">Built by <a href="https://mowgoapp.com/#/" style="color:#047857">MowGo</a> — scheduling, routing, and invoicing for Oklahoma lawn crews. Data: LawnStarter OK market, refreshed August 2026.</p>
<p style="margin-top:12px;font-size:13px"><a href="https://mowgoapp.com/#/rates?source=email" style="color:#047857">Want pricing tips sent to your inbox? →</a></p>
</body></html>`;
}

async function sendEmail(env, email) {
  if (!env.RESEND_API_KEY) { console.warn('Rates report email skipped: RESEND_API_KEY is not configured'); return; }
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'MowGo <invoices@mowgoapp.com>', reply_to: 'Hermes <hermes.assistant.job@gmail.com>', to: email, subject: 'Your Oklahoma Lawn Rates Report — What to Charge in Your City', html: emailHtml() }) });
    if (!response.ok) console.warn('Rates report email failed:', response.status, await response.text());
  } catch (error) { console.warn('Rates report email failed:', error?.message || error); }
}

// instant touch is the report email itself (marked 'sent'); day3/day7 are
// queued. Dedup is UNIQUE(lead_email, kind) — NOT per source — so a repeat
// submission (or a lead who already hit another funnel) absorbs cleanly via
// ignore-duplicates.
async function insertLeadTouches(env, email) {
  try {
    const now = new Date().toISOString();
    const rows = [
      { source: 'rates_report', user_id: null, lead_email: email, lead_phone: null, kind: 'instant', channel: 'email', status: 'sent', sent_at: now },
      { source: 'rates_report', user_id: null, lead_email: email, lead_phone: null, kind: 'day3', channel: 'email', status: 'queued' },
      { source: 'rates_report', user_id: null, lead_email: email, lead_phone: null, kind: 'day7', channel: 'email', status: 'queued' },
    ];
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/lead_touches`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(rows),
    });
    if (!response.ok) console.warn('Rates report lead_touches insert failed:', response.status, await response.text().catch(() => ''));
  } catch (error) { console.warn('Rates report lead_touches insert failed:', error?.message || error); }
}

export async function onRequestOptions(request) {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': corsOrigin(request), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const origin = corsOrigin(request);
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  if (!allowed(ip)) return json({ error: 'Too many requests. Please try again later.' }, 429, origin);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Rate reports are not configured.' }, 503, origin);
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400, origin);
    // Lowercase before insert/dedup lookups — case-insensitive dedup, Postgres unique is case-sensitive.
    const email = (typeof body.email === 'string' ? body.email.trim() : '').toLowerCase();
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400, origin);
    if (!CITY_SET.has(city)) return json({ error: 'Select a valid city.' }, 400, origin);
    const delivery = sendEmail(env, email);
    const touches = insertLeadTouches(env, email);
    const background = Promise.all([delivery, touches]);
    if (typeof waitUntil === 'function') waitUntil(background); else background.catch(() => {});
    return json({ success: true }, 201, origin);
  } catch { return json({ error: 'Could not send report. Please try again.' }, 500, origin); }
}
