/**
 * Cloudflare Pages Function — QuickBooks Online connection status
 *
 * GET /api/integrations/qbo-status
 * Headers: Authorization: Bearer <supabase-access-token>
 *
 * Returns only sanitized fields — never access_token/refresh_token, which
 * exist solely inside the service-role-only `integrations` table (see
 * supabase/migrations/20260815120000_integrations.sql).
 *
 * Env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { getIntegration } from '../_shared/qbo-tokens.js';
import { getSupabaseUrl, getSupabaseAnonKey } from '../_shared/qbo-env.js';

const ALLOWED_ORIGINS = ['https://mowgoapp.com'];

function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function onRequestGet({ request, env }) {
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

  try {
    const integration = await getIntegration(env, userId);
    if (!integration) {
      return Response.json(
        { connected: false, companyName: null, lastSyncedAt: null, connectedAt: null },
        { headers },
      );
    }
    return Response.json(
      {
        connected: true,
        companyName: integration.metadata?.companyName || null,
        lastSyncedAt: integration.last_synced_at || null,
        connectedAt: integration.connected_at || null,
      },
      { headers },
    );
  } catch (err) {
    console.error('qbo-status: lookup failed', err?.message || err);
    return Response.json({ error: 'Server misconfigured' }, { status: 500, headers });
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
