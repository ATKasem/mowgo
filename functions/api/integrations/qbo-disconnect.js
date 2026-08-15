/**
 * Cloudflare Pages Function — Disconnect QuickBooks Online
 *
 * POST /api/integrations/qbo-disconnect
 * Headers: Authorization: Bearer <supabase-access-token>
 *
 * Deletes the user's `integrations` row (service role — RLS blocks direct
 * client access, see 20260815120000_integrations.sql), which drops the
 * stored tokens. Does not attempt to revoke the token with Intuit; deleting
 * our copy is sufficient (Intuit tokens expire on their own, and MowGo has
 * no more use for a token it isn't storing).
 *
 * Env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceKey } from '../_shared/qbo-env.js';

const ALLOWED_ORIGINS = ['https://mowgoapp.com'];

function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

async function verifyToken(token, env) {
  const res = await fetch(`${getSupabaseUrl(env)}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: getSupabaseAnonKey(env) },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id || null;
}

export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request);

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401, headers });
  }

  let userId;
  try {
    userId = await verifyToken(token, env);
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401, headers });
  }
  if (!userId) {
    return Response.json({ error: 'Invalid token' }, { status: 401, headers });
  }

  let supabaseUrl, serviceKey;
  try {
    supabaseUrl = getSupabaseUrl(env);
    serviceKey = getSupabaseServiceKey(env);
  } catch (err) {
    console.error('qbo-disconnect: server misconfigured', err?.message || err);
    return Response.json({ error: 'Server misconfigured' }, { status: 500, headers });
  }

  try {
    const deleteRes = await fetch(
      `${supabaseUrl}/rest/v1/integrations?user_id=eq.${encodeURIComponent(userId)}&provider=eq.quickbooks`,
      {
        method: 'DELETE',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!deleteRes.ok) {
      const text = await deleteRes.text().catch(() => '');
      console.error(`qbo-disconnect: delete failed (${deleteRes.status}): ${text}`);
      return Response.json({ error: 'Failed to disconnect QuickBooks' }, { status: 500, headers });
    }
    return Response.json({ disconnected: true }, { headers });
  } catch (err) {
    console.error('qbo-disconnect: delete threw', err?.message || err);
    return Response.json({ error: 'Failed to disconnect QuickBooks' }, { status: 500, headers });
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      'Access-Control-Max-Age': '86400',
    },
  });
}
