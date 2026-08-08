const ALLOWED_ORIGINS = ['https://mowgoapp.com'];

// In-memory rate limit: 60 reorders / 15 min per user (per-isolate, same
// pattern as sms-optin.js / webhook-dispatch.js — Claude Code LOW-2 fix;
// raised 30→60: drag-drop fires one call per move, a heavy re-sort of a
// 25-job day twice could otherwise hit the cap).
const REORDER_RATE_LIMIT_MAX = 60;
const REORDER_RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const reorderAttempts = new Map();

function rateLimit(userId) {
  const now = Date.now();
  const entry = reorderAttempts.get(userId);
  if (!entry || now >= entry.reset) {
    reorderAttempts.set(userId, { count: 1, reset: now + REORDER_RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= REORDER_RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(request, body, status) {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return jsonResponse(request, { error: 'Authentication required' }, 401);

  const supabaseUrl = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(request, { error: 'Server misconfigured' }, 500);
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey || serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return jsonResponse(request, { error: 'Invalid token' }, 401);
  const { id: userId } = await userRes.json();
  if (!userId) return jsonResponse(request, { error: 'Invalid token' }, 401);
  if (!rateLimit(userId)) return jsonResponse(request, { error: 'Too many requests' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON' }, 400);
  }

  const { orders } = body;
  if (!Array.isArray(orders)) return jsonResponse(request, { error: 'orders must be an array' }, 400);
  if (orders.length > 100) return jsonResponse(request, { error: 'Too many orders' }, 400);
  if (!orders.every(({ id, route_order }) => typeof id === 'string' && Number.isInteger(route_order) && route_order >= 1)) {
    return jsonResponse(request, { error: 'Each order requires an id and positive integer route_order' }, 400);
  }
  if (new Set(orders.map(o => o.route_order)).size !== orders.length) {
    return jsonResponse(request, { error: 'route_order values must be unique' }, 400);
  }

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/reorder_jobs`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ p_user_id: userId, p_orders: orders }),
  });
  if (!rpcRes.ok) {
    console.error('jobs/reorder: RPC failed', await rpcRes.text());
    return jsonResponse(request, { error: 'Could not reorder jobs' }, 500);
  }

  return jsonResponse(request, { success: true }, 200);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
