/**
 * Shared outgoing-webhook dispatch — used by:
 *  - functions/api/webhook-dispatch.js (browser-authenticated, user-triggered)
 *  - functions/api/stripe/webhook.js (server-triggered, e.g. payment.failed)
 *
 * Looks up all active webhook_configs for a user, filters to configs that
 * subscribed to the given event, and POSTs JSON to each configured URL with
 * an HMAC-SHA256 signature (X-MowGo-Signature). Best-effort: failures are
 * counted and logged, never thrown — callers must not fail their own flow
 * because an outbound webhook delivery failed.
 *
 * Returns: { delivered, failures, skipped: true } — skipped when no config
 * subscribed to this event.
 */

import { isSafeWebhookUrl } from './safe-webhook-url.js';

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

/**
 * Look up the user's active webhook configs and deliver `event` + `payload`
 * to every config subscribed to that event.
 */
export async function dispatchWebhookEvent(env, userId, event, payload = {}) {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('webhook dispatch: missing Supabase config');
    return { delivered: 0, failures: 1, skipped: false };
  }

  const configsRes = await fetch(
    `${supabaseUrl}/rest/v1/webhook_configs?user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&select=id,url,secret,events,label`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      signal: AbortSignal.timeout(5_000),
    },
  );

  if (!configsRes.ok) {
    console.error(`webhook dispatch: config lookup failed (${configsRes.status})`);
    return { delivered: 0, failures: 1, skipped: false, error: 'Failed to fetch webhook configs' };
  }

  const configs = await configsRes.json();

  // Filter to configs that subscribed to this event.
  // Empty events array = subscribed to nothing (must pick events explicitly).
  const matching = (configs || []).filter((c) => {
    const events = c.events || [];
    return events.length > 0 && events.includes(event);
  });

  if (matching.length === 0) {
    return { delivered: 0, failures: 0, skipped: true };
  }

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

  return { delivered, failures };
}
