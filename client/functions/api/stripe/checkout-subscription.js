/**
 * Cloudflare Pages Function — Stripe Subscription Checkout
 * POST /api/stripe/checkout-subscription
 * Body: { plan: 'solo' | 'crew' }
 * Returns: { url: 'https://checkout.stripe.com/...' }
 */

const ALLOWED_ORIGINS = ['https://mowflow.pages.dev', 'https://cleanflloww.pages.dev', 'https://mowflow.app'];

export async function onRequestPost(context) {
  const { request, env } = context;

  // Origin validation
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const { plan } = await request.json();

    // Validate plan
    if (!['solo', 'crew'].includes(plan)) {
      return json({ error: 'Invalid plan' }, 400);
    }

    const priceId = plan === 'solo' ? env.STRIPE_PRICE_SOLO : env.STRIPE_PRICE_CREW;
    if (!priceId) {
      return json({ error: 'Price ID not configured' }, 500);
    }

    const trialDays = parseInt(env.STRIPE_TRIAL_DAYS, 10) || 14;
    const appUrl = env.APP_URL || origin || 'https://mowflow.pages.dev';

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
        success_url: `${appUrl}/#/subscribe?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/#/pricing`,
        allow_promotion_codes: 'true',
      }).toString(),
    });

    const session = await stripeResponse.json();

    if (session.error) {
      console.error('Stripe checkout error:', session.error.type, session.error.message);
      return json({ error: 'Unable to start checkout. Please try again.' }, 400);
    }

    return json({ url: session.url });
  } catch (err) {
    console.error('Checkout function error:', err);
    return json({ error: 'Something went wrong' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
    },
  });
}
