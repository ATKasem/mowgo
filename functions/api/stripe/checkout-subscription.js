/**
 * Cloudflare Pages Function — Stripe Subscription Checkout
 * POST /api/stripe/checkout-subscription
 * Headers: Authorization: Bearer <supabase access token>
 * Body: { plan: 'solo' | 'crew' }
 * Returns: { url: 'https://checkout.stripe.com/...' }
 *
 * The session is stamped with client_reference_id so the resulting subscription
 * can be tied back to an account — both by verify-session and by any webhook
 * that grants the paid tier.
 */

import { requireUser, isAllowedOrigin } from '../_lib/auth.js';

const DEFAULT_ORIGINS = ['https://mowflow.pages.dev', 'https://cleanflloww.pages.dev', 'https://mowflow.app'];

function allowedOrigins(env) {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const allowed = allowedOrigins(env);
  const origin = request.headers.get('origin');

  if (!isAllowedOrigin(origin, allowed)) {
    return json({ error: 'Forbidden' }, 403, null, allowed);
  }

  const { user, error: authError } = await requireUser(request, env);
  if (!user) {
    const status = authError === 'auth_unavailable' ? 503 : 401;
    return json({ error: authError || 'unauthorized' }, status, origin, allowed);
  }

  if (!env.STRIPE_SECRET_KEY) {
    console.error('Stripe secret key not configured');
    return json({ error: 'Payment system not configured' }, 500, origin, allowed);
  }

  try {
    const { plan } = await request.json();

    if (!['solo', 'crew'].includes(plan)) {
      return json({ error: 'Invalid plan' }, 400, origin, allowed);
    }

    const priceId = plan === 'solo'
      ? (env.STRIPE_PRICE_SOLO || env.VITE_STRIPE_PRICE_SOLO)
      : (env.STRIPE_PRICE_CREW || env.VITE_STRIPE_PRICE_CREW);
    if (!priceId) {
      return json({ error: 'Price ID not configured' }, 500, origin, allowed);
    }

    const trialDays = parseInt(env.STRIPE_TRIAL_DAYS || env.VITE_STRIPE_TRIAL_DAYS || '14', 10) || 14;
    const appUrl = env.APP_URL || origin;

    const params = new URLSearchParams({
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: 'subscription',
      'subscription_data[trial_period_days]': String(trialDays),
      success_url: `${appUrl}/#/subscribe?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#/pricing`,
      allow_promotion_codes: 'true',
      // Ties the session — and the subscription it creates — to this account.
      client_reference_id: user.id,
      'metadata[user_id]': user.id,
      'subscription_data[metadata][user_id]': user.id,
    });
    if (user.email) params.set('customer_email', user.email);

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeResponse.json();

    if (session.error) {
      console.error('Stripe checkout error:', session.error.type, session.error.message);
      return json({ error: 'Unable to start checkout. Please try again.' }, 400, origin, allowed);
    }

    return json({ url: session.url }, 200, origin, allowed);
  } catch (err) {
    console.error('Checkout function error:', err);
    return json({ error: 'Something went wrong' }, 500, origin, allowed);
  }
}

function json(data, status = 200, origin = null, allowed = DEFAULT_ORIGINS) {
  const headers = { 'Content-Type': 'application/json' };
  if (isAllowedOrigin(origin, allowed)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return new Response(JSON.stringify(data), { status, headers });
}
