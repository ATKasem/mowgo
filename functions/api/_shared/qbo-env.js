/**
 * Centralized env var access for the QuickBooks Online integration.
 * Throws descriptive errors so a missing CF Pages env var fails loudly
 * at the call site instead of surfacing as an opaque fetch/auth error.
 */

function required(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getQboClientId(env) {
  return required(env, 'QBO_CLIENT_ID');
}

export function getQboClientSecret(env) {
  return required(env, 'QBO_CLIENT_SECRET');
}

export function getQboRedirectUri(env) {
  return required(env, 'QBO_REDIRECT_URI');
}

export function getSupabaseUrl(env) {
  return required(env, 'SUPABASE_URL');
}

export function getSupabaseServiceKey(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!key) {
    throw new Error('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');
  }
  return key;
}

export function getSupabaseAnonKey(env) {
  return env.SUPABASE_ANON_KEY || getSupabaseServiceKey(env);
}

export const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
export const QBO_SCOPE = 'com.intuit.quickbooks.accounting';
