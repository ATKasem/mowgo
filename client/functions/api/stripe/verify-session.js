/**
 * Cloudflare Pages Function — Verify Stripe Checkout Session
 * GET /api/stripe/verify-session?session_id=cs_...
 * Returns: { status: 'complete' | 'expired' | 'open', customer_email, ... }
 */

export async function onRequestGet(context) {
  const { request, env } = context;
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
      'Access-Control-Allow-Origin': 'https://mowflow.pages.dev',
    },
  });
}
