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
 * Resume a paid-plan checkout from a stored intent (localStorage, shared across tabs).
 * Used at app root (email-confirmation return) and after login/signup submit.
 * Protections: plan/interval whitelist + 30-min TTL; intent cleared on deterministic
 * errors, kept on transport errors so the user can retry.
 * @returns {{status: 'started'|'none'|'error', message?: string}}
 */
let resumeInFlight = false;
export async function resumeCheckoutIntent() {
  if (resumeInFlight) return { status: 'started' };
  const intent = localStorage.getItem('mowgo_plan_intent');
  if (!intent) return { status: 'none' };
  const interval = localStorage.getItem('mowgo_interval_intent');
  const intentTime = Number(localStorage.getItem('mowgo_intent_time') || 0);
  const age = Date.now() - intentTime;
  const valid = ['solo', 'crew', 'premium'].includes(intent)
    && ['month', 'year'].includes(interval)
    && age >= 0 && age < 30 * 60 * 1000;
  if (!valid) {
    // Stale, malformed, corrupt, or expired intent — never hijack a normal login.
    localStorage.removeItem('mowgo_plan_intent');
    localStorage.removeItem('mowgo_interval_intent');
    localStorage.removeItem('mowgo_intent_time');
    return { status: 'none' };
  }
  resumeInFlight = true;
  try {
    const r = await startCheckout(intent, interval);
    if (r?.error) {
      if (r.retryable) {
        // Transport failure — keep the intent so the user can retry.
        resumeInFlight = false;
        return { status: 'error', message: r.error, retryable: true };
      }
      // Deterministic failure (validation/config) — drop the intent so the next
      // login goes to /app instead of retrying forever.
      localStorage.removeItem('mowgo_plan_intent');
      localStorage.removeItem('mowgo_interval_intent');
      localStorage.removeItem('mowgo_intent_time');
      resumeInFlight = false;
      return { status: 'error', message: r.error };
    }
    // startCheckout redirects to Stripe on success — only then drop the intent
    localStorage.removeItem('mowgo_plan_intent');
    localStorage.removeItem('mowgo_interval_intent');
    localStorage.removeItem('mowgo_intent_time');
    return { status: 'started' };
  } catch (checkoutError) {
    // Defensive: any thrown error is transport-like — keep the intent for retry.
    resumeInFlight = false;
    return { status: 'error', message: checkoutError.message || 'Payment failed', retryable: true };
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
