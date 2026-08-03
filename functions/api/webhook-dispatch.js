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
 *   SUPABASE_ANON_KEY      — anon key (for token verification)
 */

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
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
      apikey: env.SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id || null;
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

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

  // --- Look up webhook configs ---
  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const configsRes = await fetch(
    `${supabaseUrl}/rest/v1/webhook_configs?user_id=eq.${userId}&is_active=eq.true&select=id,url,secret,events,label`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );

  if (!configsRes.ok) {
    return Response.json(
      { error: 'Failed to fetch webhook configs' },
      { status: 500, headers },
    );
  }

  const configs = await configsRes.json();

  // Filter to configs that subscribed to this event
  const matching = configs.filter((c) => {
    const events = c.events || [];
    return events.length === 0 || events.includes(event);
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
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
