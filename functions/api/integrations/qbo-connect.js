/**
 * Cloudflare Pages Function — Start QuickBooks Online OAuth connect
 *
 * POST /api/integrations/qbo-connect with Authorization: Bearer <token>
 * GET /api/integrations/qbo-connect?nonce=<short-lived-encrypted-nonce>
 *
 * Native clients first authenticate with a POST, then open the returned
 * short-lived nonce URL as a top-level browser navigation.
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

import { getQboClientId, getQboClientSecret, getQboRedirectUri, getSupabaseUrl, getSupabaseAnonKey, QBO_AUTH_URL, QBO_SCOPE } from '../_shared/qbo-env.js';

const SETTINGS_URL = 'https://mowgoapp.com/#/settings';
const STATE_COOKIE = 'qbo_oauth_state';
const STATE_TTL_SECONDS = 600;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function nonceKey(env) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(getQboClientSecret(env)));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function createNonce(userId, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = encoder.encode(JSON.stringify({ userId, expiresAt: Date.now() + STATE_TTL_SECONDS * 1000 }));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await nonceKey(env), payload));
  const nonce = new Uint8Array(iv.length + ciphertext.length);
  nonce.set(iv);
  nonce.set(ciphertext, iv.length);
  return base64UrlEncode(nonce);
}

async function consumeNonce(value, env) {
  const nonce = base64UrlDecode(value);
  if (nonce.length <= 12) return null;
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce.slice(0, 12) },
    await nonceKey(env),
    nonce.slice(12),
  );
  const payload = JSON.parse(decoder.decode(plaintext));
  if (!payload.userId || !payload.expiresAt || payload.expiresAt < Date.now()) return null;
  return payload.userId;
}

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
  const nonce = url.searchParams.get('nonce');
  if (!nonce) {
    return Response.redirect(`${SETTINGS_URL}?qbo=error&reason=auth_required`, 302);
  }

  let userId;
  try {
    userId = await consumeNonce(nonce, env);
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

export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return Response.json({ error: 'Authentication required' }, { status: 401 });

  let userId;
  try {
    userId = await verifyToken(token, env);
  } catch {
    return Response.json({ error: 'Authentication failed' }, { status: 401 });
  }
  if (!userId) return Response.json({ error: 'Invalid token' }, { status: 401 });

  try {
    const nonce = await createNonce(userId, env);
    const url = new URL(request.url);
    url.search = '';
    url.searchParams.set('nonce', nonce);
    return Response.json({ url: url.toString() });
  } catch (err) {
    console.error('qbo-connect: failed to create nonce', err?.message || err);
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }
}
