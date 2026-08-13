/**
 * Redirect to Stripe Checkout via Cloudflare Pages Function.
 * The server-side endpoint handles Stripe API calls with the secret key.
 *
 * @param {'solo'|'crew'|'premium'} plan
 * @param {'month'|'year'} interval
 */
import { supabase } from './supabase';

export async function startCheckout(plan, interval = 'month') {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: 'Log in or create an account before subscribing.' };

    const res = await fetch('/api/stripe/checkout-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan, interval }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
      return { success: true };
    }

    return { error: data.error || 'Failed to start checkout' };
  } catch (err) {
    console.error('Checkout error:', err);
    // Transport-level failure (offline/timeout/network) — callers that resume an
    // intent must NOT treat this as a deterministic config error.
    return { error: 'Connection failed. Check your internet and try again.', retryable: true };
  }
}

/**
 * Resume a stored plan intent by granting a 14-day trial via Supabase RPC.
 * Used at app root (email-confirmation return) and after login/signup submit.
 * 7-day intent TTL (no more 30-min bug); idempotent grant_trial RPC; intent
 * cleared on success or no-op; kept on transport errors so the user can retry.
 * @returns {{status: 'granted'|'none'|'error', message?: string, retryable?: boolean}}
 */
let resumeInFlight = false;
export async function resumeCheckoutIntent() {
  if (resumeInFlight) return { status: 'granted' };
  const intent = localStorage.getItem('mowgo_plan_intent');
  if (!intent) return { status: 'none' };
  const interval = localStorage.getItem('mowgo_interval_intent');
  const intentTime = Number(localStorage.getItem('mowgo_intent_time') || 0);
  const age = Date.now() - intentTime;
  const validPlan = ['solo', 'crew', 'premium'].includes(intent);
  const validInterval = ['month', 'year'].includes(interval);
  const validAge = age >= 0 && age < 7 * 24 * 60 * 60 * 1000; // 7-day TTL
  if (!validPlan || !validInterval || !validAge) {
    // Stale, malformed, corrupt, or expired intent — never hijack a normal login.
    localStorage.removeItem('mowgo_plan_intent');
    localStorage.removeItem('mowgo_interval_intent');
    localStorage.removeItem('mowgo_intent_time');
    return { status: 'none' };
  }
  resumeInFlight = true;
  try {
    // Expire any past trial first so tier reverts to free (grant can then re-grant).
    // Best-effort — RPC failure does not block the grant attempt.
    try { await supabase.rpc('expire_trial'); } catch { /* non-fatal */ }

    // Check if user already has a real paid tier (not from a trial).
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('tier, trial_ends_at')
      .eq('id', user.id)
      .single();
    if (!profileErr && profile?.tier && profile.tier !== 'free' && !profile.trial_ends_at) {
      // Already a real paid subscriber — clear the intent.
      localStorage.removeItem('mowgo_plan_intent');
      localStorage.removeItem('mowgo_interval_intent');
      localStorage.removeItem('mowgo_intent_time');
      return { status: 'none' };
    }

    // Grant the trial via RPC (idempotent — no-ops if already active or tier != free).
    const { error: rpcErr, data: grantResult } = await supabase.rpc('grant_trial', { p_plan: intent });
    if (rpcErr) {
      // Transport / RPC failure — keep intent so the user can retry on next mount.
      return { status: 'error', message: rpcErr.message || 'Trial grant failed', retryable: true };
    }
    if (grantResult === false) {
      // RPC returned false (no-op: trial already used, already granted, etc.)
      // Intent consumed either way — the user's tier is already set.
      localStorage.removeItem('mowgo_plan_intent');
      localStorage.removeItem('mowgo_interval_intent');
      localStorage.removeItem('mowgo_intent_time');
      return { status: 'granted' };
    }
    // Granted (or no-op for active trial) — intent consumed either way.
    localStorage.removeItem('mowgo_plan_intent');
    localStorage.removeItem('mowgo_interval_intent');
    localStorage.removeItem('mowgo_intent_time');
    return { status: 'granted' };
  } catch (err) {
    // Defensive: any thrown error is transport-like — keep the intent for retry.
    return { status: 'error', message: err.message || 'Trial grant failed', retryable: true };
  } finally {
    resumeInFlight = false;
  }
}

export async function openCustomerPortal() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: 'Please log in to manage your subscription.' };

    const res = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
      return { success: true };
    }
    return { error: data.error || 'Unable to open subscription management.' };
  } catch (err) {
    console.error('Customer portal error:', err);
    return { error: 'Connection failed. Check your internet and try again.' };
  }
}
