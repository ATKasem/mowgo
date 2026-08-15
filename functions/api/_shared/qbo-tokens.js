/**
 * Token management for the QuickBooks Online OAuth integration.
 *
 * Tokens live in the `integrations` table (service-role-only RLS, see
 * supabase/migrations/20260815120000_integrations.sql) and must never be
 * returned to client JS — every function here talks to Supabase using the
 * service role key and only ever hands the caller an access token in memory.
 */

import {
  getQboClientId,
  getQboClientSecret,
  getSupabaseUrl,
  getSupabaseServiceKey,
  QBO_TOKEN_URL,
  QBO_API_BASE,
} from './qbo-env.js';

// Refresh a bit before actual expiry so in-flight requests don't race a
// token that expires mid-call.
const REFRESH_SKEW_MS = 60_000;

function serviceHeaders(env) {
  const serviceKey = getSupabaseServiceKey(env);
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
}

/** Fetch the stored QuickBooks integration row for a user, or null if not connected. */
export async function getIntegration(env, userId) {
  const supabaseUrl = getSupabaseUrl(env);
  const res = await fetch(
    `${supabaseUrl}/rest/v1/integrations?user_id=eq.${encodeURIComponent(userId)}&provider=eq.quickbooks&select=*`,
    { headers: serviceHeaders(env), signal: AbortSignal.timeout(5_000) },
  );
  if (!res.ok) {
    throw new Error(`Failed to load QuickBooks integration (${res.status})`);
  }
  const rows = await res.json();
  return rows?.[0] || null;
}

/**
 * Exchange a refresh token for a new access/refresh token pair via Intuit,
 * and persist the result back to `integrations`. Returns the updated row.
 */
export async function refreshQboToken(env, integration) {
  const clientId = getQboClientId(env);
  const clientSecret = getQboClientSecret(env);
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`QuickBooks token refresh failed (${res.status}): ${text}`);
  }

  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabaseUrl = getSupabaseUrl(env);
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/integrations?id=eq.${encodeURIComponent(integration.id)}`,
    {
      method: 'PATCH',
      headers: {
        ...serviceHeaders(env),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        access_token: tokens.access_token,
        // Intuit doesn't always rotate the refresh token — keep the old one if absent.
        refresh_token: tokens.refresh_token || integration.refresh_token,
        expires_at: expiresAt,
      }),
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!updateRes.ok) {
    throw new Error(`Failed to persist refreshed QuickBooks tokens (${updateRes.status})`);
  }
  const [updated] = await updateRes.json();
  return updated;
}

/**
 * Returns { accessToken, realmId, integration } for the user, refreshing via
 * Intuit first if the stored access token is expired or about to expire.
 * Returns null if the user has no QuickBooks connection.
 */
export async function getValidAccessToken(env, userId) {
  const integration = await getIntegration(env, userId);
  if (!integration) return null;

  const expiresAt = integration.expires_at ? new Date(integration.expires_at).getTime() : 0;
  if (expiresAt - REFRESH_SKEW_MS > Date.now()) {
    return { accessToken: integration.access_token, realmId: integration.realm_id, integration };
  }

  const refreshed = await refreshQboToken(env, integration);
  return { accessToken: refreshed.access_token, realmId: refreshed.realm_id, integration: refreshed };
}

/** Thin fetch wrapper for the QuickBooks Online API (no npm SDK dependency). */
export function createQboClient(accessToken, realmId) {
  return {
    async request(method, path, body) {
      const res = await fetch(`${QBO_API_BASE}/${realmId}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        // empty / non-JSON body (e.g. some error responses)
      }
      return { ok: res.ok, status: res.status, data };
    },
  };
}
