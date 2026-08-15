/**
 * Cloudflare Pages Function — Start QuickBooks Online OAuth connect
 *
 * GET /api/integrations/qbo-connect?token=<supabase-access-token>
 *
 * This is a top-level browser navigation (the user clicks "Connect
 * QuickBooks"), not an XHR/fetch — so the Supabase session can't be sent as
 * an Authorization header the way the other authenticated endpoints do it.
 * The frontend passes the access token as a query param instead.
 *
 * CSRF state: CF Pages Functions run across many isolates with no shared
 * memory, and the callback request may land on a different isolate than
 * this one — an in-memory Map of state->user would silently fail. Instead
 * we bind the state param to this browser via a short-lived HttpOnly
 * cookie that only our own domain can set or read, and verify it matches
 * on callback (qbo-callback.js).
 *
 * Env vars: QBO_CLIENT_ID, QBO_REDIRECT_URI, SUPABASE_URL, SUPABASE_ANON_KEY
 */

import { getQboClientId, getQboRedirectUri, getSupabaseUrl, getSupabaseAnonKey, QBO_AUTH_URL, QBO_SCOPE } from '../_shared/qbo-env.js';

const SETTINGS_URL = 'https://mowgoapp.com/#/settings';
const STATE_COOKIE = 'qbo_oauth_state';
const STATE_TTL_SECONDS = 600;

async function verifyToken(token, env) {
  const supabaseUrl = getSupabaseUrl(env);
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: getSupabaseAnonKey(env),
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id || null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return Response.redirect(`${SETTINGS_URL}?qbo=error&reason=auth_required`, 302);
  }

  let userId;
  try {
    userId = await verifyToken(token, env);
  } catch {
    return Response.redirect(`${SETTINGS_URL}?qbo=error&reason=auth_failed`, 302);
  }
  if (!userId) {
    return Response.redirect(`${SETTINGS_URL}?qbo=error&reason=invalid_token`, 302);
  }

  let clientId, redirectUri;
  try {
    clientId = getQboClientId(env);
    redirectUri = getQboRedirectUri(env);
  } catch (err) {
    console.error('qbo-connect: server misconfigured', err?.message || err);
    return Response.redirect(`${SETTINGS_URL}?qbo=error&reason=server_misconfigured`, 302);
  }

  const state = crypto.randomUUID();
  const cookieValue = encodeURIComponent(`${state}|${userId}`);

  const authorizeUrl = new URL(QBO_AUTH_URL);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', QBO_SCOPE);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      'Set-Cookie': `${STATE_COOKIE}=${cookieValue}; Max-Age=${STATE_TTL_SECONDS}; Path=/api/integrations; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
