/**
 * Request/response helpers shared by /api/payments/* endpoints.
 *
 * Auth is a Supabase bearer token (no cookies), so cross-site request
 * forgery doesn't apply; the Origin check only stops other websites from
 * calling these endpoints from a browser. Native apps send no Origin header.
 */

import { PaymentsUnavailableError, ProviderNotImplementedError, ProviderRequestError } from './errors.js';

const ALLOWED_ORIGINS = ['https://mowgoapp.com'];
const PLATFORMS = ['web', 'ios', 'android'];

export function supabaseConfig(env) {
  return {
    url: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  };
}

export function appUrl(env) {
  return String(env.APP_URL || 'https://mowgoapp.com').replace(/\/$/, '');
}

/** Returns a 403 Response for a disallowed browser origin, else null. */
export function rejectForeignOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Forbidden' }, 403);
  return null;
}

export function json(data, status = 200, request = null) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const origin = request?.headers?.get?.('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

/** Resolve the Supabase user for the request's bearer token, or null. */
export async function authenticate(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const { url, anonKey } = supabaseConfig(env);
  if (!token || !url || !anonKey) return null;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? { ...user, accessToken: token } : null;
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

/** 'web' when called from the website, else the app's declared platform. */
export function platformOf(request, body) {
  if (request.headers.get('origin')) return 'web';
  return PLATFORMS.includes(body?.platform) && body.platform !== 'web' ? body.platform : 'ios';
}

/**
 * Where hosted pages send the payer back. Native apps return through
 * /#/portal-return, which deep-links into the app (custom-scheme redirects
 * aren't accepted by every processor's hosted page).
 */
export function returnUrls(env, platform, kind) {
  const base = appUrl(env);
  const native = platform !== 'web';
  switch (kind) {
    case 'subscription':
      return native
        ? { success: `${base}/#/portal-return?result=upgraded`, cancel: `${base}/#/portal-return?result=canceled` }
        : { success: `${base}/#/subscribe?checkout=success`, cancel: `${base}/#/subscribe` };
    case 'portal':
      return { success: native ? `${base}/#/portal-return?result=portal` : `${base}/#/settings` };
    case 'merchant':
      return { success: native ? `${base}/#/portal-return?result=merchant` : `${base}/#/settings?merchant=returned` };
    case 'invoice':
      // The payer is usually the business's customer, not a MowGo user.
      return { success: `${base}/#/payment-complete`, cancel: `${base}/#/payment-complete?canceled=1` };
    default:
      throw new Error(`Unknown return kind: ${kind}`);
  }
}

/** Refuse to hand clients anything but an https URL on the provider's own hosts. */
export function checkedHostedUrl(provider, url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ProviderRequestError(provider.name, 'hosted page URL is not a valid URL');
  }
  if (parsed.protocol !== 'https:' || !provider.isAllowedHostedPageHost(parsed.hostname)) {
    throw new ProviderRequestError(provider.name, `hosted page URL host not allowed: ${parsed.hostname}`);
  }
  return parsed.toString();
}

/** Map payment-layer errors to responses; anything else is a 500. */
export function errorResponse(error, request, context) {
  if (error instanceof PaymentsUnavailableError || error instanceof ProviderNotImplementedError) {
    return json({ error: 'Card payments are coming soon.', code: 'payments_unavailable' }, 503, request);
  }
  if (error instanceof ProviderRequestError) {
    console.error(`${context}:`, error.message);
    return json({ error: 'The payment service is unavailable. Please try again.', code: 'provider_error' }, 502, request);
  }
  console.error(`${context}:`, error);
  return json({ error: 'Something went wrong' }, 500, request);
}
