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
    return { error: 'Connection failed. Check your internet and try again.' };
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
