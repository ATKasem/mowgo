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

import { isSafeWebhookUrl } from './_shared/safe-webhook-url.js';

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

/** Compute HMAC-SHA256 hex digest */
async function hmacSha256(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

  // --- Look up webhook configs ---
  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500, headers });
  }
  const configsRes = await fetch(
    `${supabaseUrl}/rest/v1/webhook_configs?user_id=eq.${userId}&is_active=eq.true&select=id,url,secret,events,label`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(5_000),
    },
  );

  if (!configsRes.ok) {
    return Response.json(
      { error: 'Failed to fetch webhook configs' },
      { status: 500, headers },
    );
  }

  const configs = await configsRes.json();

  // Filter to configs that subscribed to this event
  // Empty events array = subscribed to nothing (must pick events explicitly)
  const matching = configs.filter((c) => {
    const events = c.events || [];
    return events.length > 0 && events.includes(event);
  });

  if (matching.length === 0) {
    return Response.json({ delivered: 0, failures: 0, skipped: true }, { headers });
  }

  // --- Dispatch to each endpoint ---
  const timestamp = new Date().toISOString();
  const bodyStr = JSON.stringify({ event, payload, timestamp });

  let delivered = 0;
  let failures = 0;

  await Promise.all(
    matching.map(async (config) => {
      try {
        const check = await isSafeWebhookUrl(config.url);
        if (!check.ok) {
          console.warn(`webhook dispatch: blocked unsafe URL for ${config.id}: ${check.reason}`);
          failures++;
          return;
        }
        const signature = await hmacSha256(config.secret, bodyStr);
        const res = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MowGo-Signature': `sha256=${signature}`,
            'X-MowGo-Event': event,
            'X-MowGo-Delivery': `${userId}:${config.id}`,
            'User-Agent': 'MowGo-Webhook/1.0',
          },
          body: bodyStr,
          // 10-second timeout for webhook delivery
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          delivered++;
        } else {
          console.warn(`webhook dispatch: ${config.id} returned ${res.status}`);
          failures++;
        }
      } catch (err) {
        console.warn(`webhook dispatch: ${config.id} failed:`, err?.message || err);
        failures++;
      }
    }),
  );

  return Response.json({ delivered, failures }, { headers });
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
