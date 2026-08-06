/**
 * Cloudflare Pages Function — Outgoing Webhook Dispatcher
 *
 * POST /api/webhook-dispatch
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { event: string, payload: object }
 *
 * Looks up all active webhook_configs for the authenticated user,
 * POSTs JSON to each configured URL with an HMAC-SHA256 signature,
 * and returns a summary of delivery results.
 *
 * Env vars (set in Cloudflare dashboard):
 *   SUPABASE_URL           — https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (config lookup)
 */

import { dispatchWebhookEvent } from './_shared/dispatch-webhook.js';

const ALLOWED_ORIGINS = ['https://mowgoapp.com', 'https://mowgo.pages.dev'];

/** Per-user+IP rate limit: 20 dispatches per 15 min (in-memory, per-isolate). */
const dispatchAttempts = new Map();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// NOTE: entries are lazily replaced on the same key but never actively
// evicted — bounded in practice by Workers isolate recycling. For
// production-grade limits across isolates, enable CF dashboard Rate
// Limiting rules (same as booking.js / leads/public.js).

function rateLimitKey(userId, request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return `${userId}:${ip}`;
}

function isRateLimited(userId, request) {
  const key = rateLimitKey(userId, request);
  const now = Date.now();
  const entry = dispatchAttempts.get(key);
  if (!entry || now >= entry.resetTime) {
    dispatchAttempts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/** Verify a Supabase access token and return the user id */
async function verifyToken(token, env) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id || null;
}

export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request);

  // --- Parse body ---
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }

  const { event, payload = {} } = body;
  if (!event) {
    return Response.json({ error: 'event is required' }, { status: 400, headers });
  }

  // --- Authenticate ---
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401, headers });
  }

  const userId = await verifyToken(token, env);
  if (!userId) {
    return Response.json({ error: 'Invalid token' }, { status: 401, headers });
  }

  // --- Rate limit (per user+IP) ---
  if (isRateLimited(userId, request)) {
    return Response.json(
      { error: 'Too many webhook dispatches. Please try again later.' },
      { status: 429, headers },
    );
  }

  // --- Look up configs + dispatch (shared with server-triggered events, e.g. Stripe) ---
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500, headers });
  }

  const result = await dispatchWebhookEvent(env, userId, event, payload);
  return Response.json(result, { headers });
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
