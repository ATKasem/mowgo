/**
 * Cloudflare Pages Function — Verify Stripe Checkout Session
 * GET /api/stripe/verify-session?session_id=cs_...
 * Returns: { status: 'complete' | 'expired' | 'open', customer_email, ... }
 */

const ALLOWED_ORIGINS = ['https://mowgoapp.com'];

export async function onRequestGet(context) {
  const { request, env } = context;

  // Origin validation — only reject a present-but-disallowed origin.
  // Same-origin GETs from the deployed app send no Origin header, so absence
  // is allowed (the Bearer JWT + metadata user_id match below is the real gate).
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Forbidden' }, 403);
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401, origin);

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!env.STRIPE_SECRET_KEY || !supabaseUrl || !supabaseAnonKey) {
    console.error('Stripe or Supabase configuration is incomplete');
    return json({ error: 'Payment system not configured' }, 500, origin);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return json({ error: 'Invalid session ID' }, 400, origin);
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
    });
    if (!authResponse.ok) return json({ error: 'Unauthorized' }, 401, origin);
    const user = await authResponse.json();

    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        },
      }
    );

    const session = await stripeResponse.json();

    if (session.error) {
      console.error('Stripe verify error:', session.error);
      return json({ status: 'error', error: session.error.message }, 400, origin);
    }

    if (session.metadata?.user_id !== user.id) {
      return json({ error: 'Forbidden' }, 403, origin);
    }

    return json({
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email,
      subscription: session.subscription,
    }, 200, origin);
  } catch (err) {
    console.error('Verify function error:', err);
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
