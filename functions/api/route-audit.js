// NOTE: CF dashboard Rate Limiting rules recommended for production-grade limits (per-isolate map is best-effort).
const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;
const attempts = new Map();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Shared with functions/api/leads/public.js:8 — do not invent a new phone regex.
const PHONE_RE = /^(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$/;
const MIDPOINTS = { under_10: 7, '10_25': 17, '25_50': 37, '50_plus': 60 };
const CREWS = new Set(['solo', '2_3', '4_plus']);
// Qualified lead alert: mid-size lawn count + small/medium crew — the profile
// worth an immediate manual follow-up (excludes hobby-size under_10 and
// enterprise-size 50_plus/4_plus, which have their own report-page branches).
const QUALIFIED_LAWNS = new Set(['10_25', '25_50']);
const CREW_LABELS = { solo: 'solo crew', '2_3': '2-3 person crew', '4_plus': '4+ person crew' };
const QUALIFIED_CREWS = new Set(['solo', '2_3']);
const ALLOWED_ORIGINS = ['https://mowgoapp.com'];

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

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function emailHtml(name, hours, monthly, annual) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6"><h1>Your free route audit${name ? `, ${escapeHtml(name)}` : ''}</h1><p><strong>~${hours} hours/week</strong> potentially recoverable</p><p><strong>$${monthly.toLocaleString()}/month</strong> revenue impact</p><p><strong>$${annual.toLocaleString()}/year</strong> seasonal impact</p><p><em>Estimates based on industry averages.</em></p><h2>Here's the math</h2><p>Weekly lawns × 0.75 hours; weekly hours × 4.33 weeks × $45/hour; monthly impact × 12 × 0.6 seasonal factor (lawn season ≈ 7 months).</p><h2>3 quick fixes</h2><ol><li>Batch jobs by zone.</li><li>Block recurring clients on the same day.</li><li>Leave 15-minute buffers.</li></ol><p><a href="https://mowgoapp.com/#/">See how MowGo automates this</a></p></body></html>`;
}

async function sendEmail(env, name, email, hours, monthly, annual) {
  if (!env.SENDGRID_API_KEY) { console.warn('Route audit email skipped: SENDGRID_API_KEY is not configured'); return; }
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email }] }], from: { email: 'aaron@mowgoapp.com', name: 'Aaron' }, reply_to: { email: 'hermes.assistant.job@gmail.com', name: 'Hermes' }, subject: `Your route audit: ~${hours} hrs/week on the table`, content: [{ type: 'text/html', value: emailHtml(name, hours, monthly, annual) }] }) });
    if (!response.ok) console.warn('Route audit email failed:', response.status, await response.text());
  } catch (error) { console.warn('Route audit email failed:', error?.message || error); }
}

// instant touch is the report email itself (marked 'sent'); day2/day7 are
// queued. Dedup is UNIQUE(lead_email, kind) — a single bulk insert with
// ignore-duplicates absorbs any repeat submission for the same email.
async function insertLeadTouches(env, { email, phone, smsConsent }) {
  try {
    const smsEligible = Boolean(phone) && smsConsent === true;
    const now = new Date().toISOString();
    const rows = [
      { source: 'route_audit', user_id: null, lead_email: email, lead_phone: phone || null, kind: 'instant', channel: 'email', status: 'sent', sent_at: now },
      { source: 'route_audit', user_id: null, lead_email: email, lead_phone: phone || null, kind: 'day2', channel: smsEligible ? 'sms' : 'email', status: 'queued' },
      { source: 'route_audit', user_id: null, lead_email: email, lead_phone: phone || null, kind: 'day7', channel: smsEligible ? 'sms' : 'email', status: 'queued' },
    ];
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/lead_touches`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(rows),
    });
    if (!response.ok) console.warn('Route audit lead_touches insert failed:', response.status, await response.text().catch(() => ''));
  } catch (error) { console.warn('Route audit lead_touches insert failed:', error?.message || error); }
}

async function sendLeadAlert(env, { name, lawnsBucket, crewBucket, monthly, email }) {
  const webhookUrl = env.DISCORD_LEADS_WEBHOOK_URL;
  const botUrl = (env.DISCORD_BOT_TOKEN && env.DISCORD_LEADS_CHANNEL_ID)
    ? `https://discord.com/api/v10/channels/${env.DISCORD_LEADS_CHANNEL_ID}/messages`
    : null;
  const target = webhookUrl || botUrl;
  if (!target) return;
  try {
    // Strip Discord markdown so malicious input can't inject formatting/embeds.
    // Email keeps "@" for readability — pings are blocked by allowed_mentions parse: [].
    const safeName = name.replace(/[*_~`|>@#]/g, '').slice(0, 100);
    const safeEmail = (email || '').replace(/[*_~`|>#]/g, '').slice(0, 254);
    const bucketLabel = lawnsBucket.replace('_', '-');
    const crewLabel = CREW_LABELS[crewBucket] || crewBucket || '';
    const content = [
      '🔔 **New route audit lead**',
      '',
      `**${safeName}**`,
      `• ${bucketLabel} lawns/week${crewLabel ? ` · ${crewLabel}` : ''}`,
      `• ~$${monthly.toLocaleString()}/mo potential impact (est.)`,
      `• ${safeEmail}`,
      '',
      'Ran the free audit on mowgoapp.com — follow up today, book the free setup call.',
    ].join('\n');
    const res = await fetch(target, {
      method: 'POST',
      headers: webhookUrl
        ? { 'Content-Type': 'application/json' }
        : { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) console.warn('Route audit lead alert failed:', res.status, await res.text().catch(() => ''));
  } catch (error) { console.warn('Route audit lead alert failed:', error?.message || error); }
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
    // Lowercase before insert/dedup lookups — case-insensitive dedup, Postgres unique is case-sensitive.
    const email = (typeof body.email === 'string' ? body.email.trim() : '').toLowerCase();
    const zip = typeof body.zip === 'string' ? body.zip.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const smsConsent = body.sms_consent === true;
    if (!name) return json({ error: 'Name is required.' }, 400, origin);
    if (name.length > 100) return json({ error: 'Name must be 100 characters or fewer.' }, 400, origin);
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400, origin);
    if (!/^\d{5}$/.test(zip)) return json({ error: 'Enter a valid 5-digit ZIP code.' }, 400, origin);
    if (phone && !PHONE_RE.test(phone)) return json({ error: 'Enter a valid US phone number.' }, 400, origin);
    if (!Object.hasOwn(MIDPOINTS, body.lawns_bucket)) return json({ error: 'Select a valid lawns-per-week range.' }, 400, origin);
    if (!CREWS.has(body.crew_bucket)) return json({ error: 'Select a valid crew size.' }, 400, origin);
    const rawHours = MIDPOINTS[body.lawns_bucket] * 0.75;
    const hours = Math.round(rawHours);
    const monthly = Math.round(rawHours * 4.33 * 45);
    const annual = Math.round(rawHours * 4.33 * 45 * 12 * 0.6);
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    // No phone/consent → email-only (sms_consent only meaningful with a phone).
    const smsConsentRecorded = Boolean(phone) && smsConsent;
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/route_audits`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name, email, zip, lawns_bucket: body.lawns_bucket, crew_bucket: body.crew_bucket, hours_wasted_week: hours, revenue_impact_month: monthly, phone: phone || null, sms_consent: smsConsentRecorded }) });
    if (!response.ok) { console.error('Route audit insert failed', response.status); return json({ error: 'Could not run audit. Please try again.' }, 500, origin); }
    const delivery = sendEmail(env, name, email, hours, monthly, annual);
    const touches = insertLeadTouches(env, { email, phone, smsConsent: smsConsentRecorded });
    const qualified = QUALIFIED_LAWNS.has(body.lawns_bucket) && QUALIFIED_CREWS.has(body.crew_bucket);
    const alert = qualified ? sendLeadAlert(env, { name, lawnsBucket: body.lawns_bucket, crewBucket: body.crew_bucket, monthly, email }) : Promise.resolve();
    const background = Promise.all([delivery, touches, alert]);
    if (typeof waitUntil === 'function') waitUntil(background); else background.catch(() => {});
    return json({ success: true, report: { hours_wasted_week: hours, revenue_impact_month: monthly, annual_impact: annual } }, 201, origin);
  } catch { return json({ error: 'Could not run audit. Please try again.' }, 500, origin); }
}
