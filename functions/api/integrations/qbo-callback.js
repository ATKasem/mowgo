/**
 * Cloudflare Pages Function — QuickBooks Online OAuth callback
 *
 * GET /api/integrations/qbo-callback?code=...&state=...&realmId=...
 *
 * Verifies the CSRF state cookie set by qbo-connect.js, exchanges the
 * authorization code for tokens, and upserts them into `integrations`
 * (service role — see 20260815120000_integrations.sql for why this table
 * has no client-facing RLS policies). Always redirects back into the app;
 * never returns raw tokens or error details to the browser.
 *
 * Env vars: QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI,
 *           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import {
  getQboClientId,
  getQboClientSecret,
  getQboRedirectUri,
  getSupabaseUrl,
  getSupabaseServiceKey,
  QBO_TOKEN_URL,
  QBO_API_BASE,
} from '../_shared/qbo-env.js';

const SETTINGS_URL = 'https://mowgoapp.com/#/settings';
const STATE_COOKIE = 'qbo_oauth_state';
const CLEAR_COOKIE = `${STATE_COOKIE}=; Max-Age=0; Path=/api/integrations; HttpOnly; Secure; SameSite=Lax`;

function errorRedirect(reason) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${SETTINGS_URL}?qbo=error&reason=${encodeURIComponent(reason)}`,
      'Set-Cookie': CLEAR_COOKIE,
    },
  });
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** Best-effort company name lookup — never blocks the connect flow. */
async function fetchCompanyName(accessToken, realmId) {
  try {
    const res = await fetch(`${QBO_API_BASE}/${realmId}/companyinfo/${realmId}?minorversion=65`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.CompanyInfo?.CompanyName || null;
  } catch {
    return null;
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const realmId = url.searchParams.get('realmId');
  const intuitError = url.searchParams.get('error');

  if (intuitError) {
    return errorRedirect('intuit_denied');
  }
  if (!code || !state || !realmId) {
    return errorRedirect('missing_params');
  }

  const cookieValue = readCookie(request, STATE_COOKIE);
  if (!cookieValue) {
    return errorRedirect('missing_state');
  }
  const [cookieState, userId] = cookieValue.split('|');
  if (!cookieState || !userId || cookieState !== state) {
    return errorRedirect('state_mismatch');
  }

  let clientId, clientSecret, redirectUri, supabaseUrl, serviceKey;
  try {
    clientId = getQboClientId(env);
    clientSecret = getQboClientSecret(env);
    redirectUri = getQboRedirectUri(env);
    supabaseUrl = getSupabaseUrl(env);
    serviceKey = getSupabaseServiceKey(env);
  } catch (err) {
    console.error('qbo-callback: server misconfigured', err?.message || err);
    return errorRedirect('server_misconfigured');
  }

  // --- Exchange code for tokens ---
  let tokens;
  try {
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch(QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => '');
      console.error(`qbo-callback: token exchange failed (${tokenRes.status}): ${text}`);
      return errorRedirect('token_exchange_failed');
    }
    tokens = await tokenRes.json();
  } catch (err) {
    console.error('qbo-callback: token exchange threw', err?.message || err);
    return errorRedirect('token_exchange_failed');
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const companyName = await fetchCompanyName(tokens.access_token, realmId);

  // --- Upsert integrations row (service role) ---
  try {
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/integrations?on_conflict=user_id,provider`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          user_id: userId,
          provider: 'quickbooks',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          realm_id: realmId,
          connected_at: new Date().toISOString(),
          expires_at: expiresAt,
          metadata: companyName ? { companyName } : {},
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!upsertRes.ok) {
      const text = await upsertRes.text().catch(() => '');
      console.error(`qbo-callback: integration upsert failed (${upsertRes.status}): ${text}`);
      return errorRedirect('save_failed');
    }
  } catch (err) {
    console.error('qbo-callback: integration upsert threw', err?.message || err);
    return errorRedirect('save_failed');
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${SETTINGS_URL}?qbo=connected`,
      'Set-Cookie': CLEAR_COOKIE,
    },
  });
}
