/**
 * Cloudflare Pages Function — Stripe Subscription Checkout
 * POST /api/stripe/checkout-subscription
 * Body: { plan: 'solo' | 'crew' }
 * Returns: { url: 'https://checkout.stripe.com/...' }
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const { plan } = await request.json();

    const priceId = plan === 'solo'
      ? (env.STRIPE_PRICE_SOLO || env.VITE_STRIPE_PRICE_SOLO)
      : (env.STRIPE_PRICE_CREW || env.VITE_STRIPE_PRICE_CREW);

    if (!priceId) {
      return jsonResponse({ error: 'Price ID not configured' }, 500);
    }

    const trialDays = parseInt(env.STRIPE_TRIAL_DAYS || env.VITE_STRIPE_TRIAL_DAYS, 10) || 7;
    const origin = request.headers.get('origin') || env.APP_URL || 'https://mowflow.pages.dev';

    // Call Stripe API to create a Checkout Session
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        mode: 'subscription',
        'subscription_data[trial_period_days]': String(trialDays),
        'success_url': `${origin}/#/subscribe?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${origin}/#/pricing`,
        'allow_promotion_codes': 'true',
      }).toString(),
    });

    const session = await stripeResponse.json();

    if (session.error) {
      return jsonResponse({ error: session.error.message }, 400);
    }

    return jsonResponse({ url: session.url });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
