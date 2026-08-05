/**
 * Cloudflare Pages Function — Stripe Subscription Checkout
 * POST /api/stripe/checkout-subscription
 * Body: { plan: 'solo' | 'crew' | 'premium', interval: 'month' | 'year' }
 * Returns: { url: 'https://checkout.stripe.com/...' }
 */

const ALLOWED_ORIGINS = ['https://mowgo.pages.dev', 'https://mowgoapp.com'];

export async function onRequestPost(context) {
  const { request, env } = context;

  // Origin validation — require header from browser requests
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Forbidden' }, 403);
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401, origin);

  // Guard: Stripe secret key must be configured before making API calls
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!env.STRIPE_SECRET_KEY || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Stripe or Supabase server configuration is incomplete');
    return json({ error: 'Payment system not configured' }, 500, origin);
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
    });
    if (!authResponse.ok) return json({ error: 'Unauthorized' }, 401, origin);
    const user = await authResponse.json();

    const { plan, interval = 'month' } = await request.json();

    // Validate plan + billing interval
    if (!['solo', 'crew', 'premium'].includes(plan)) {
      return json({ error: 'Invalid plan' }, 400, origin);
    }
    if (!['month', 'year'].includes(interval)) {
      return json({ error: 'Invalid billing interval' }, 400, origin);
    }

    const annual = interval === 'year';
    const priceIds = {
      solo: annual ? env.STRIPE_PRICE_SOLO_ANNUAL : env.STRIPE_PRICE_SOLO,
      crew: annual ? env.STRIPE_PRICE_CREW_ANNUAL : env.STRIPE_PRICE_CREW,
      premium: annual ? env.STRIPE_PRICE_PREMIUM_ANNUAL : env.STRIPE_PRICE_PREMIUM,
    };
    const priceId = priceIds[plan];
    if (!priceId) {
      return json({ error: 'Price ID not configured' }, 500, origin);
    }

    const trialDays = parseInt(env.STRIPE_TRIAL_DAYS || '14', 10) || 14;
    const appUrl = origin || env.APP_URL || 'https://mowgoapp.com';

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=stripe_customer_id`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      },
    );
    if (!profileResponse.ok) throw new Error('Could not load billing profile');
    const [profile] = await profileResponse.json();
    if (!profile) return json({ error: 'Profile not found' }, 404, origin);

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email || '',
          'metadata[supabase_user_id]': user.id,
        }).toString(),
      });
      const customer = await customerResponse.json();
      if (!customerResponse.ok || customer.error) throw new Error('Could not create Stripe customer');
      customerId = customer.id;

      const saveResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ stripe_customer_id: customerId }),
        },
      );
      if (!saveResponse.ok) {
        const deleteResponse = await fetch(
          `https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
          },
        );
        if (!deleteResponse.ok) {
          console.error('Could not clean up Stripe customer after profile save failure', customerId);
        }
        throw new Error('Could not save Stripe customer');
      }
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        mode: 'subscription',
        'subscription_data[trial_period_days]': String(trialDays),
        'metadata[user_id]': user.id,
        'metadata[tier]': plan,
        'metadata[interval]': interval,
        'subscription_data[metadata][user_id]': user.id,
        'subscription_data[metadata][tier]': plan,
        'subscription_data[metadata][interval]': interval,
        success_url: `${appUrl}/#/subscribe?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/#/`,
        allow_promotion_codes: 'true',
        'payment_method_types[0]': 'card',
      }).toString(),
    });

    const session = await stripeResponse.json();

    if (session.error) {
      console.error('Stripe checkout error:', session.error.type, session.error.message);
      return json({ error: 'Unable to start checkout. Please try again.' }, 400, origin);
    }

    return json({ url: session.url }, 200, origin);
  } catch (err) {
    console.error('Checkout function error:', err);
    return json({ error: 'Something went wrong' }, 500, origin);
  }
}

function json(data, status = 200, origin = null) {
  const headers = { 'Content-Type': 'application/json' };
  // Echo back the validated origin so multi-domain setups work
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return new Response(JSON.stringify(data), { status, headers });
}
