// NOTE: CF dashboard Rate Limiting rules recommended for production-grade limits (per-isolate map is best-effort).
import { isSafeWebhookUrl } from '../_shared/safe-webhook-url.js';

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;
const attempts = new Map();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_RE = /^(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$/;
const ALLOWED_ORIGINS = ['https://mowgo.pages.dev', 'https://mowgoapp.com'];

function corsOrigin(request) {
  const origin = request?.headers?.get?.('origin');
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgo.pages.dev';
}

function jsonHelper(body, status = 200, origin = 'https://mowgo.pages.dev') {
  return Response.json(body, { status, headers: { 'Access-Control-Allow-Origin': origin } });
}
function allowed(ip) {
  const now = Date.now(); const entry = attempts.get(ip);
  if (!entry || now >= entry.reset) { attempts.set(ip, { count: 1, reset: now + WINDOW_MS }); return true; }
  if (entry.count >= LIMIT) return false;
  entry.count += 1; return true;
}

async function fireLeadWebhook(env, userId, lead) {
  try {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/webhook_configs?user_id=eq.${userId}&is_active=eq.true&events=cs.%7Blead.created%7D&select=id,url,secret`, { headers });
    if (!res.ok) return;
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({ event: 'lead.created', payload: { lead_id: lead.id, name: lead.name, source: lead.source, status: lead.status }, timestamp });
    await Promise.all((await res.json()).map(async config => {
      // SSRF defense (shared with webhook-dispatch): https-only, blocks
      // private IP literals AND DNS-rebinding targets, fail-closed.
      const check = await isSafeWebhookUrl(config.url);
      if (!check.ok) {
        console.warn(`lead webhook: blocked unsafe URL for ${config.id}: ${check.reason}`);
        return;
      }
      const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(body)))).map(b => b.toString(16).padStart(2, '0')).join('');
      await fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MowGo-Signature': `sha256=${signature}`, 'X-MowGo-Event': 'lead.created' }, body, signal: AbortSignal.timeout(10000) });
    }));
  } catch (error) { console.warn('Public lead webhook failed:', error?.message || error); }
}

export async function onRequestOptions(request) {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': corsOrigin(request), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const origin = corsOrigin(request);
  const json = (body, status = 200) => jsonHelper(body, status, origin);
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  if (!allowed(ip)) return json({ error: 'Too many requests. Please try again later.' }, 429);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Quote requests are not configured.' }, 503);
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    if (!name) return json({ error: 'Name is required.' }, 400);
    if (name.length > 100) return json({ error: 'Name must be 100 characters or fewer.' }, 400);
    if (!phone && !email) return json({ error: 'A phone number or email is required.' }, 400);
    if (phone && !PHONE_RE.test(phone)) return json({ error: 'Enter a valid US phone number.' }, 400);
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ error: 'Enter a valid email address.' }, 400);
    if (address.length > 200) return json({ error: 'Address must be 200 characters or fewer.' }, 400);
    if (!UUID_RE.test(body.business_id || '')) return json({ error: 'Invalid quote request link.' }, 400);
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${body.business_id}&select=id`, { headers });
    const profiles = profileRes.ok ? await profileRes.json() : [];
    if (!profiles.length) return json({ error: 'Business not found.' }, 400);
    const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, { method: 'POST', headers, body: JSON.stringify({ user_id: body.business_id, name, phone: phone || null, email: email || null, address: address || null, source: 'booking_link', status: 'new' }) });
    const rows = await insertRes.json();
    if (!insertRes.ok) { console.error('Public lead insert failed', insertRes.status); return json({ error: 'Could not send request. Please try again.' }, 500); }
    if (rows[0]) {
      const delivery = fireLeadWebhook(env, body.business_id, rows[0]);
      if (typeof waitUntil === 'function') waitUntil(delivery); else delivery.catch(() => {});
    }
    return json({ success: true }, 201);
  } catch { return json({ error: 'Could not send request. Please try again.' }, 500); }
}
