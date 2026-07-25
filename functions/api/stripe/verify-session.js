/**
 * Cloudflare Pages Function — Verify Stripe Checkout Session
 * GET /api/stripe/verify-session?session_id=cs_...
 * Headers: Authorization: Bearer <supabase access token>
 * Returns: { status: 'complete' | 'expired' | 'open', payment_status, subscription }
 *
 * The session must belong to the caller. Session IDs travel through browser
 * history and referrers, so possession of one is not proof of ownership.
 */

import { requireUser, isAllowedOrigin } from '../_lib/auth.js';

const DEFAULT_ORIGINS = ['https://mowflow.pages.dev', 'https://cleanflloww.pages.dev', 'https://mowflow.app'];

function allowedOrigins(env) {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

export async function onRequestGet(context) {
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

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return json({ error: 'Invalid session ID' }, 400, origin, allowed);
  }

  try {
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
      console.error('Stripe verify error:', session.error.type, session.error.message);
      return json({ error: 'Unable to verify session' }, 400, origin, allowed);
    }

    // Ownership check — do not reveal anything about someone else's session.
    const sessionOwner = session.client_reference_id || session.metadata?.user_id;
    if (sessionOwner !== user.id) {
      console.warn('verify-session ownership mismatch');
      return json({ error: 'Not found' }, 404, origin, allowed);
    }

    return json({
      status: session.status,
      payment_status: session.payment_status,
      subscription: session.subscription,
    }, 200, origin, allowed);
  } catch (err) {
    console.error('Verify function error:', err);
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
