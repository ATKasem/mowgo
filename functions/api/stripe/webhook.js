/**
 * Cloudflare Pages Function — Stripe subscription webhook
 * POST /api/stripe/webhook
 */

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const withTimeout = (promise, ms = 4000) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), ms))]);

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

  if (await isDuplicateEvent(event.id, env)) return ok();

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

        // Referral earn (service-role only, never fails the webhook)
        try {
          const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
          const customerId = customerIdOf(object.customer) || customerIdOf(subscription.customer);
          if (customerId && serviceKey) {
            // Fetch profile by customer id (scoped fetch, not widening fetchProfile's hardcoded select)
            const profileRes = await withTimeout(fetch(
              `${env.SUPABASE_URL}/rest/v1/profiles?select=id,referred_by&stripe_customer_id=eq.${encodeURIComponent(customerId)}`,
              { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY}` } }
            ));
            if (profileRes.ok) {
              const [prof] = await profileRes.json();
              if (prof?.referred_by) {
                // Atomic cap+earn via service-role RPC (webhook already has dedup guard).
                // RPC returns JSON boolean: true = earned, false = cap reached / no pending row.
                const earnRes = await withTimeout(fetch(`${env.SUPABASE_URL}/rest/v1/rpc/earn_referral_credit`, {
                  method: 'POST',
                  headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ p_referred_user_id: prof.id }),
                }));
                if (earnRes.ok) {
                  const earned = await earnRes.json();
                  // Only notify on an actual earn — cap hit leaves the row pending, no email.
                  // Pass BOTH ids: referrerId is the email recipient, referredUserId is
                  // the person who subscribed (their name goes in the copy).
                  if (earned === true) {
                    await sendReferralEarnEmail(env, serviceKey, prof.referred_by, prof.id);
                  }
                }
              }
            }
          }
        } catch (e) {
          // best-effort — never fail the webhook over referrals
        }
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
      await handleSubscriptionDeleted(object, env);
    }

    return ok();
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
}

async function isDuplicateEvent(eventId, env) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!eventId || !env.SUPABASE_URL || !serviceKey) return false;
  try {
    const response = await withTimeout(fetch(`${env.SUPABASE_URL}/rest/v1/webhook_events`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify({ event_id: eventId }),
    }));
    if (!response.ok) throw new Error(`dedup insert returned ${response.status}`);
    const inserted = await response.json();
    return Array.isArray(inserted) && inserted.length === 0;
  } catch (error) {
    console.error('Stripe webhook dedup failed; continuing processing:', error);
    return false;
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

// Best-effort tier-change logging for churn-by-tier tracking.
// Never breaks the payment flow: any failure here is swallowed.
async function logTierChange(env, serviceKey, resolvedUserId, newTier) {
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

// Fetch the PREVIOUS profile state BEFORE patching (change detection must read pre-state).
async function fetchProfile(env, serviceKey, filter) {
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

async function updateProfile({ env, userId, customerId, tier }) {
  if (!userId && !customerId) throw new Error('Event has no profile identity');

  const profile = {
    tier,
    ...(customerId ? { stripe_customer_id: customerId } : {}),
  };

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

  if (userId) {
    const before = await fetchProfile(env, serviceKey, `id=eq.${encodeURIComponent(userId)}`);
    const matched = await patchProfile(env, `id=eq.${encodeURIComponent(userId)}`, profile);
    if (matched || !customerId) {
      if (before && before.tier !== tier) await logTierChange(env, serviceKey, userId, tier);
      return;
    }
  }

  // Fallback: identify by customer id — read pre-state first, then patch, then log
  const before = await fetchProfile(env, serviceKey, `stripe_customer_id=eq.${encodeURIComponent(customerId)}`);
  const matchedByCustomer = await patchProfile(
    env,
    `stripe_customer_id=eq.${encodeURIComponent(customerId)}`,
    profile,
  );
  if (matchedByCustomer && before && before.tier !== tier) {
    await logTierChange(env, serviceKey, before.id, tier);
  }
}

// Cancellation win-back/downsell flow (customer.subscription.deleted).
// Reads the PRE-STATE tier before flipping to free so the win-back email can be framed
// correctly, and so a stray/duplicate cancel event (already free) sends nothing.
async function handleSubscriptionDeleted(object, env) {
  const userId = object.metadata?.user_id;
  const customerId = customerIdOf(object.customer);
  if (!userId && !customerId) return;

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  const filter = userId
    ? `id=eq.${encodeURIComponent(userId)}`
    : `stripe_customer_id=eq.${encodeURIComponent(customerId)}`;

  const before = await fetchProfile(env, serviceKey, filter);

  const patch = {
    tier: 'free',
    cancelled_at: new Date().toISOString(),
    ...(customerId ? { stripe_customer_id: customerId } : {}),
  };
  const matched = await patchProfile(env, filter, patch);
  if (!matched) return;

  const resolvedUserId = before?.id || userId;
  if (before && before.tier !== 'free') {
    await logTierChange(env, serviceKey, resolvedUserId, 'free');
  }

  if (before && ['solo', 'crew', 'premium'].includes(before.tier)) {
    await sendWinbackEmail(env, serviceKey, resolvedUserId, before.tier);
  }
}

async function fetchUserEmail(env, serviceKey, userId) {
  if (!userId) return null;
  try {
    const res = await withTimeout(fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ));
    if (!res.ok) return null;
    const data = await res.json();
    return data?.email || null;
  } catch (e) {
    return null;
  }
}

function winbackContent(previousTier, appUrl) {
  const subscribeUrl = `${appUrl}/subscribe`;
  if (previousTier === 'crew') {
    return {
      subject: "Don't lose your crew setup — Solo keeps you running at $39/mo",
      html: `<p>You cancelled Crew. Your clients, schedule and invoices are all still here. Solo keeps scheduling, invoicing, routes and rain delay running at $39/mo (no per-user fees).</p><p><a href="${subscribeUrl}">Switch in one click</a></p>`,
    };
  }
  if (previousTier === 'premium') {
    return {
      subject: 'Your premium setup is waiting',
      html: `<p>Your data is still here. Re-activate anytime in one click: <a href="${subscribeUrl}">${subscribeUrl}</a>. 30-day money-back guarantee still applies.</p>`,
    };
  }
  return {
    subject: 'We made it easy to come back',
    html: `<p>Your data is still here. Re-activate anytime in one click: <a href="${subscribeUrl}">${subscribeUrl}</a>. 30-day money-back guarantee still applies.</p>`,
  };
}

// Best-effort, bounded, never fails the webhook (repo convention — see logTierChange above).
async function sendWinbackEmail(env, serviceKey, userId, previousTier) {
  if (!env.RESEND_API_KEY) return;
  try {
    const email = await fetchUserEmail(env, serviceKey, userId);
    if (!email) return;
    const appUrl = (env.APP_URL || 'https://mowgoapp.com').replace(/\/$/, '');
    const { subject, html } = winbackContent(previousTier, appUrl);
    await withTimeout(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: 'MowGo <invoices@mowgoapp.com>', to: email, subject, html }),
    }));
  } catch (e) {
    // win-back email is best-effort — never fail the webhook over it
  }
}

// Minimal HTML escaping for user-controlled strings interpolated into emails.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Referral earn notification — emailed to referrer when their referred user pays.
// Best-effort, never fails the webhook. Uses existing fetchUserEmail + Resend helpers.
// referrerId = email recipient; referredUserId = the user who subscribed (their
// business_name personalizes the copy — MEDIUM-3: the spec's "{referred business}
// just subscribed to MowGo." means the REFERRED user's name, not the recipient's).
async function sendReferralEarnEmail(env, serviceKey, referrerId, referredUserId) {
  if (!env.RESEND_API_KEY || !referrerId) return;
  try {
    const email = await fetchUserEmail(env, serviceKey, referrerId);
    if (!email) return;
    const referredName = await getReferredName(env, serviceKey, referredUserId);
    const subject = 'You earned a free month on MowGo';
    const html = `<p>You just earned a <strong>free month</strong> on MowGo!</p><p>${escapeHtml(referredName || 'A crew')} subscribed using your referral code.</p><p>Your credit will be applied to your next renewal automatically.</p>`;
    await withTimeout(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: 'MowGo <invoices@mowgoapp.com>', to: email, subject, html }),
    }));
  } catch (e) {
    // best-effort — never fail the webhook over referrals
  }
}

// Fetch a user's business_name (for email personalization).
async function getReferredName(env, serviceKey, userId) {
  try {
    const res = await withTimeout(fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?select=business_name&id=eq.${encodeURIComponent(userId)}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ));
    if (!res.ok) return null;
    const [row] = await res.json();
    return row?.business_name || null;
  } catch (e) {
    return null;
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
