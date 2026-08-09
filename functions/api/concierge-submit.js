import {
  conciergePriorityForTier,
  conciergeSlaHoursForTier,
  isConciergeTierEligible,
} from './_shared/concierge-policy.js';
import { parseConciergeCsv } from './_shared/concierge-csv.js';

const ALLOWED_ORIGINS = ['https://mowgoapp.com'];

function cors(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function customerRequest(request) {
  if (!request?.id) return {};
  const { id, status, tier_at_request, submitted_at, sla_due_at, review_started_at, reviewed_at, done_at, created_at } = request;
  return { id, status, tier_at_request, submitted_at, sla_due_at, review_started_at, reviewed_at, done_at, created_at };
}

export function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function onRequestPost({ request, env }) {
  const headers = cors(request);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Server misconfigured' }, { status: 500, headers });
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Invalid token' }, { status: 401, headers });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers }); }
  const businessName = typeof body.business_name === 'string' ? body.business_name.trim() : '';
  // Strip Discord markdown so a malicious business name cannot inject
  // formatting, spoilers, or link embeds into the concierge notification.
  const safeBusinessName = businessName.replace(/[*_~`|>@#]/g, '').slice(0, 200);
  const csvContent = typeof body.csv_content === 'string' ? body.csv_content : '';
  if (!businessName || businessName.length > 200) return Response.json({ error: 'Business name is required and must be 200 characters or fewer' }, { status: 400, headers });
  if (!csvContent.trim() || csvContent.length > 100000) return Response.json({ error: 'CSV content is required and must be 100,000 characters or fewer' }, { status: 400, headers });
  if (body.client_count != null && (!Number.isInteger(body.client_count) || body.client_count < 0)) return Response.json({ error: 'Client count must be an integer' }, { status: 400, headers });

  try {
    const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY } });
    if (!userResponse.ok) return Response.json({ error: 'Invalid token' }, { status: 401, headers });
    const user = await userResponse.json();
    const parsedCsv = parseConciergeCsv(csvContent);
    if (parsedCsv.rows.length > 70) return Response.json({ error: `Concierge first-week setup supports up to 70 valid clients per request; this file has ${parsedCsv.rows.length}` }, { status: 400, headers });
    if (!parsedCsv.rows.length) return Response.json({ error: 'CSV must contain at least one valid client with a name and address', row_errors: parsedCsv.errors }, { status: 400, headers });

    // Per-user+IP rate limit: 20 submits per 15 min (after auth, in-memory
    // per-isolate — same pattern as booking/webhook-dispatch).
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const attempts = (globalThis.__conciergeSubmitRl ||= new Map());
    const key = `${user.id}:${ip}`;
    const hits = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
    if (hits.length >= 20) return Response.json({ error: 'Too many requests — try again later.' }, { status: 429, headers });
    hits.push(now); attempts.set(key, hits);

    const serviceHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    const ipHash = await sha256(ip);
    const durableLimitResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/check_concierge_submit_rate_limit`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ p_user_id: user.id, p_ip_hash: ipHash }) });
    const withinDurableLimit = await durableLimitResponse.json().catch(() => null);
    if (!durableLimitResponse.ok || typeof withinDurableLimit !== 'boolean') return Response.json({ error: 'Could not verify request limit. Please try again.' }, { status: 500, headers });
    if (!withinDurableLimit) return Response.json({ error: 'Too many requests — try again later.' }, { status: 429, headers });
    let profileResponse;
    try {
      profileResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=tier,trial_ends_at&id=eq.${user.id}`, { headers: serviceHeaders });
    } catch {
      return Response.json({ error: 'Could not verify your plan. Please try again.' }, { status: 500, headers });
    }
    if (!profileResponse.ok) return Response.json({ error: 'Could not verify your plan. Please try again.' }, { status: 500, headers });
    const profile = await profileResponse.json().catch(() => null);
    if (!Array.isArray(profile)) return Response.json({ error: 'Could not verify your plan. Please try again.' }, { status: 500, headers });
    // Premium includes concierge setup too (Compare.jsx:69 headline feature) — solo/crew/premium all allowed.
    // An EXPIRED trial counts as free tier even if tier hasn't been reverted yet
    // (expire_trial runs on app mount; cron is the backstop — gate must not wait
    // for either, or an expired-trial user could claim real setup work for free).
    const p = profile[0] || {};
    const trialExpired = p.trial_ends_at && new Date(p.trial_ends_at).getTime() < Date.now();
    if (!isConciergeTierEligible(p.tier) || trialExpired) {
      return Response.json({ error: 'Concierge setup is a paid-plan perk. Upgrade to claim it.' }, { status: 403, headers });
    }
    const submittedAt = new Date();
    const slaDueAt = new Date(submittedAt.getTime() + conciergeSlaHoursForTier(p.tier) * 60 * 60 * 1000);
    const insertResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({
      user_id: user.id,
      business_name: businessName,
      client_count: parsedCsv.rows.length,
      csv_content: csvContent,
      status: 'pending',
      tier_at_request: p.tier,
      priority_rank: conciergePriorityForTier(p.tier),
      submitted_at: submittedAt.toISOString(),
      sla_due_at: slaDueAt.toISOString(),
      business_timezone: 'America/Chicago',
    }) });
    const inserted = await insertResponse.json().catch(() => null);
    if (!insertResponse.ok) {
      const insertError = JSON.stringify(inserted || '');
      if (insertResponse.status === 409 || /23505|duplicate key/i.test(insertError)) {
        const existingResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests?user_id=eq.${user.id}&status=in.(pending,importing,review)&select=id,status,tier_at_request,priority_rank,submitted_at,sla_due_at,created_at&order=created_at.asc&limit=1`, { headers: serviceHeaders });
        const existing = await existingResponse.json().catch(() => []);
        if (existingResponse.ok && existing[0]?.id) return Response.json({ ...customerRequest(existing[0]), already_exists: true }, { status: 200, headers });
      }
      return Response.json({ error: 'Could not create concierge request' }, { status: 500, headers });
    }

    const webhookUrl = env.DISCORD_CONCIERGE_WEBHOOK_URL;
    const botUrl = (env.DISCORD_BOT_TOKEN && env.DISCORD_CHANNEL_ID)
      ? `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`
      : null;
    const target = webhookUrl || botUrl;
    if (target) {
      try {
        const prefix = `🧹 New concierge request\n**Business:** ${safeBusinessName}\n**Clients:** ${parsedCsv.rows.length}\n**User:** ${user.id}\n**At:** ${new Date().toISOString()}\n\`\`\``;
        const suffix = '\n```';
        const preview = csvContent.replace(/`{3,}/g, "'''").slice(0, Math.min(1500, Math.max(0, 1999 - prefix.length - suffix.length)));
        const res = await fetch(target, { method: 'POST', headers: webhookUrl ? { 'Content-Type': 'application/json' } : { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `${prefix}${preview}${suffix}`, allowed_mentions: { parse: [] } }) });
        if (!res.ok) console.warn('Concierge Discord notification failed', res.status);
      } catch (error) { console.warn('Concierge Discord notification failed', error); }
    }
    return Response.json(customerRequest(inserted?.[0]), { status: 201, headers });
  } catch (error) {
    console.error('Concierge submit failed', error);
    return Response.json({ error: 'Something went wrong' }, { status: 500, headers });
  }
}
