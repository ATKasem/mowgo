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
      const tier = tierForSubscription(subscription, env);
      if (tier !== null) {
        await updateProfile({
          env,
          userId: object.metadata?.user_id,
          customerId: customerIdOf(object.customer) || customerIdOf(subscription.customer),
          tier,
        });
      }
    } else if (event.type === 'customer.subscription.updated') {
      const tier = tierForSubscription(object, env);
      if (tier !== null) {
        await updateProfile({
          env,
          userId: object.metadata?.user_id,
          customerId: customerIdOf(object.customer),
          tier,
        });
      }
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
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_PRICE_SOLO',
    'STRIPE_PRICE_CREW',
    'STRIPE_PRICE_PREMIUM',
  ];
  // Tolerate legacy SUPABASE_SERVICE_KEY naming (set in older CF env configs)
  if (!env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Webhook configuration is incomplete');
  }
  if (required.filter((name) => name !== 'SUPABASE_SERVICE_ROLE_KEY').some((name) => !env[name])) {
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
  const premiumPrices = [env.STRIPE_PRICE_PREMIUM, env.STRIPE_PRICE_PREMIUM_ANNUAL].filter(Boolean);
  const crewPrices = [env.STRIPE_PRICE_CREW, env.STRIPE_PRICE_CREW_ANNUAL].filter(Boolean);
  const soloPrices = [env.STRIPE_PRICE_SOLO, env.STRIPE_PRICE_SOLO_ANNUAL].filter(Boolean);
  if (priceIds.length === 0) return 'free';
  if (priceIds.some((id) => premiumPrices.includes(id))) return 'premium';
  if (priceIds.some((id) => crewPrices.includes(id))) return 'crew';
  if (priceIds.some((id) => soloPrices.includes(id))) return 'solo';
  return null;
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

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

  // Bound best-effort calls so a stalled Supabase request can never delay the webhook
  const withTimeout = (promise, ms = 4000) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('tier-log timeout')), ms))]);

  // Best-effort tier-change logging for churn-by-tier tracking.
  // Never breaks the payment flow: any failure here is swallowed.
  async function logTierChange(resolvedUserId, newTier) {
    if (!resolvedUserId) return;
    try {
      await withTimeout(fetch(`${env.SUPABASE_URL}/rest/v1/tier_events`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ user_id: resolvedUserId, tier: newTier, source: 'webhook' }),
      }));
    } catch (e) {
      // logging is best-effort — never fail the webhook over it
    }
  }

  // Fetch the PREVIOUS tier BEFORE patching (change detection must read pre-state).
  async function previousTier(filter) {
    try {
      const res = await withTimeout(fetch(
        `${env.SUPABASE_URL}/rest/v1/profiles?${filter}&select=id,tier`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ));
      if (!res.ok) return null;
      const [row] = await res.json();
      return row || null;
    } catch (e) {
      return null;
    }
  }

  if (userId) {
    const before = await previousTier(`id=eq.${encodeURIComponent(userId)}`);
    const matched = await patchProfile(env, `id=eq.${encodeURIComponent(userId)}`, profile);
    if (matched || !customerId) {
      if (before && before.tier !== tier) await logTierChange(userId, tier);
      return;
    }
  }

  // Fallback: identify by customer id — read pre-state first, then patch, then log
  const before = await previousTier(`stripe_customer_id=eq.${encodeURIComponent(customerId)}`);
  const matchedByCustomer = await patchProfile(
    env,
    `stripe_customer_id=eq.${encodeURIComponent(customerId)}`,
    profile,
  );
  if (matchedByCustomer && before && before.tier !== tier) {
    await logTierChange(before.id, tier);
  }
}

async function patchProfile(env, filter, profile) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?${filter}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
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
