const ALLOWED_ORIGINS = ['https://mowgoapp.com', 'https://mowgo.pages.dev'];

function cors(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function onRequestPost({ request, env }) {
  const headers = cors(request);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Server misconfigured' }, { status: 500, headers });
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
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Invalid token' }, { status: 401, headers });

  try {
    const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY } });
    if (!userResponse.ok) return Response.json({ error: 'Invalid token' }, { status: 401, headers });
    const user = await userResponse.json();

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
    let profileResponse;
    try {
      profileResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=tier&id=eq.${user.id}`, { headers: serviceHeaders });
    } catch {
      return Response.json({ error: 'Could not verify your plan. Please try again.' }, { status: 500, headers });
    }
    if (!profileResponse.ok) return Response.json({ error: 'Could not verify your plan. Please try again.' }, { status: 500, headers });
    const profile = await profileResponse.json().catch(() => null);
    if (!Array.isArray(profile)) return Response.json({ error: 'Could not verify your plan. Please try again.' }, { status: 500, headers });
    // Premium includes concierge setup too (Compare.jsx:69 headline feature) — solo/crew/premium all allowed.
    if (!['solo', 'crew', 'premium'].includes(profile[0]?.tier)) return Response.json({ error: 'Concierge setup is a Solo/Crew perk. Upgrade to claim it.' }, { status: 403, headers });
    const insertResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ user_id: user.id, business_name: businessName, client_count: body.client_count ?? null, csv_content: csvContent, status: 'pending' }) });
    const inserted = await insertResponse.json().catch(() => null);
    if (!insertResponse.ok) {
      const insertError = JSON.stringify(inserted || '');
      if (insertResponse.status === 409 || /23505|duplicate key/i.test(insertError)) {
        const existingResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests?user_id=eq.${user.id}&status=in.(pending,importing)&select=id`, { headers: serviceHeaders });
        const existing = await existingResponse.json().catch(() => []);
        if (existingResponse.ok && existing[0]?.id) return Response.json({ id: existing[0].id, already_exists: true }, { status: 200, headers });
      }
      return Response.json({ error: 'Could not create concierge request' }, { status: 500, headers });
    }

    if (env.DISCORD_BOT_TOKEN && env.DISCORD_CHANNEL_ID) {
      try {
        const prefix = `🧹 New concierge request\n**Business:** ${safeBusinessName}\n**Clients:** ${body.client_count ?? 'Not provided'}\n**User:** ${user.id}\n**At:** ${new Date().toISOString()}\n\`\`\``;
        const suffix = '\n```';
        const preview = csvContent.replace(/`{3,}/g, "'''").slice(0, Math.min(1500, Math.max(0, 1999 - prefix.length - suffix.length)));
        await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, { method: 'POST', headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `${prefix}${preview}${suffix}`, allowed_mentions: { parse: [] } }) });
      } catch (error) { console.warn('Concierge Discord notification failed', error); }
    }
    return Response.json({ id: inserted?.[0]?.id }, { status: 201, headers });
  } catch (error) {
    console.error('Concierge submit failed', error);
    return Response.json({ error: 'Something went wrong' }, { status: 500, headers });
  }
}
