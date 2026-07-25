/**
 * Shared request auth for Pages Functions.
 *
 * Files and directories prefixed with `_` are not routed by Cloudflare Pages,
 * so this module is importable without becoming an endpoint itself.
 *
 * Origin checks are NOT authentication — the header is set freely by any
 * non-browser client. Anything that spends money or returns customer data
 * must call requireUser().
 *
 * Env vars: SUPABASE_URL, SUPABASE_ANON_KEY
 */

/**
 * Resolve the Supabase user for a request's bearer token.
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function requireUser(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { user: null, error: 'not_configured' };
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return { user: null, error: 'unauthorized' };

  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return { user: null, error: 'unauthorized' };

    const user = await res.json();
    if (!user?.id) return { user: null, error: 'unauthorized' };
    return { user, error: null };
  } catch (err) {
    console.error('Auth lookup failed:', err);
    return { user: null, error: 'auth_unavailable' };
  }
}

/**
 * Origin allowlist. Defence in depth for browsers (CSRF-ish protection);
 * never the only gate on an endpoint.
 */
export function isAllowedOrigin(origin, allowed) {
  return Boolean(origin) && allowed.includes(origin);
}
