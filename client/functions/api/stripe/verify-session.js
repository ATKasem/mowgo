/**
 * Cloudflare Pages Function — Verify Stripe Checkout Session
 * GET /api/stripe/verify-session?session_id=cs_...
 * Returns: { status: 'complete' | 'expired' | 'open', customer_email, ... }
 */

const ALLOWED_ORIGINS = ['https://mowflow.pages.dev', 'https://cleanflloww.pages.dev', 'https://mowflow.app'];

export async function onRequestGet(context) {
  const { request, env } = context;

  // Origin validation
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Forbidden' }, 403);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return json({ error: 'Invalid session ID' }, 400);
  }

  try {
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        },
      }
    );

    const session = await stripeResponse.json();

    if (session.error) {
      console.error('Stripe verify error:', session.error);
      return json({ status: 'error', error: session.error.message }, 400);
    }

    return json({
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email,
      subscription: session.subscription,
    });
  } catch (err) {
    console.error('Verify function error:', err);
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
