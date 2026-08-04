/**
 * Cloudflare Pages Function — Stripe subscription webhook
 * POST /api/stripe/webhook
 */

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!await hasValidSignature(body, signature, env.STRIPE_WEBHOOK_SECRET)) {
    // Do not reveal signature validity or invite repeated malicious deliveries.
    return ok();
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return ok();
  }

  if (![
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ].includes(event.type)) {
    return ok();
  }

  try {
    requireConfiguration(env);
    const object = event.data?.object;
    if (!object) return ok();

    if (event.type === 'checkout.session.completed') {
      if (object.mode !== 'subscription') return ok();

      const subscription = await getSubscription(object.subscription, env);
      await updateProfile({
        env,
        userId: object.metadata?.user_id,
        customerId: customerIdOf(object.customer) || customerIdOf(subscription.customer),
        tier: tierForSubscription(subscription, env),
      });
    } else if (event.type === 'customer.subscription.updated') {
      await updateProfile({
        env,
        userId: object.metadata?.user_id,
        customerId: customerIdOf(object.customer),
        tier: tierForSubscription(object, env),
      });
    } else {
      await updateProfile({
        env,
        userId: object.metadata?.user_id,
        customerId: customerIdOf(object.customer),
        tier: 'free',
      });
    }

    return ok();
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
}

async function hasValidSignature(body, header, secret) {
  if (!header || !secret) return false;

  const parts = header.split(',');
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  try {
    const signedAt = Number(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(signedAt) || Math.abs(now - signedAt) > SIGNATURE_TOLERANCE_SECONDS) {
      return false;
    }

    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    for (const signature of signatures) {
      const bytes = hexToBytes(signature);
      if (bytes && await globalThis.crypto.subtle.verify(
        'HMAC',
        key,
        bytes,
        encoder.encode(`${timestamp}.${body}`),
      )) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function hexToBytes(value) {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g), (byte) => parseInt(byte, 16));
}

function requireConfiguration(env) {
  const required = [
    'STRIPE_SECRET_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'STRIPE_PRICE_SOLO',
    'STRIPE_PRICE_CREW',
  ];
  if (required.some((name) => !env[name])) {
    throw new Error('Webhook configuration is incomplete');
  }
}

async function getSubscription(subscription, env) {
  const id = typeof subscription === 'string' ? subscription : subscription?.id;
  if (!id) throw new Error('Checkout Session has no subscription');

  const response = await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error('Could not load Stripe subscription');
  return data;
}

function tierForSubscription(subscription, env) {
  const priceIds = (subscription.items?.data || []).map((item) => (
    typeof item.price === 'string' ? item.price : item.price?.id
  ));
  const crewPrices = [env.STRIPE_PRICE_CREW, env.STRIPE_PRICE_CREW_ANNUAL].filter(Boolean);
  const soloPrices = [env.STRIPE_PRICE_SOLO, env.STRIPE_PRICE_SOLO_ANNUAL].filter(Boolean);
  if (priceIds.some((id) => crewPrices.includes(id))) return 'crew';
  if (priceIds.some((id) => soloPrices.includes(id))) return 'solo';
  return 'free';
}

function customerIdOf(customer) {
  return typeof customer === 'string' ? customer : customer?.id;
}

async function updateProfile({ env, userId, customerId, tier }) {
  if (!userId && !customerId) throw new Error('Event has no profile identity');

  const profile = {
    tier,
    ...(customerId ? { stripe_customer_id: customerId } : {}),
  };

  if (userId) {
    const matched = await patchProfile(
      env,
      `id=eq.${encodeURIComponent(userId)}`,
      profile,
    );
    if (matched || !customerId) return;
  }

  await patchProfile(
    env,
    `stripe_customer_id=eq.${encodeURIComponent(customerId)}`,
    profile,
  );
}

async function patchProfile(env, filter, profile) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?${filter}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) throw new Error('Could not update billing profile');
  if (response.status === 204) return true;

  const updated = await response.json();
  return !Array.isArray(updated) || updated.length > 0;
}

function ok() {
  return new Response('ok', { status: 200 });
}
