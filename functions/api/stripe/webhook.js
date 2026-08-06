/**
 * Cloudflare Pages Function — Stripe subscription webhook
 * POST /api/stripe/webhook
 */

import { dispatchWebhookEvent } from '../_shared/dispatch-webhook.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
// Monthly price in cents per tier — sourced from client/src/pages/Landing.jsx
// plans array (Solo $39, Crew $79, Premium $199). A referral always earns
// ONE MONTHLY month of credit regardless of whether the referred user chose
// monthly or annual billing (the promise is "a free month", not "a free
// billing cycle").
const REFERRAL_CREDIT_CENTS = { solo: 3900, crew: 7900, premium: 19900 };
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
    'invoice.payment_failed',
  ].includes(event.type)) {
    return ok();
  }

  // Fast-path check ONLY — do not mark the event seen yet. Marking it before
  // processing means any transient failure AFTER this point (e.g. a
  // Supabase timeout mid-handler) would leave the dedup row inserted while
  // the actual tier update never happened; Stripe's retry would then see
  // "already processed" and the user would be stuck on the wrong tier
  // forever (HIGH-2). markEventProcessed() only runs after processing
  // succeeds, below.
  if (await wasEventProcessed(event.id, env)) return ok();

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
                  // Don't gate on this call's `earned` return value: a PRIOR
                  // delivery may have already flipped status to 'earned' and
                  // then crashed before the Stripe credit was applied.
                  // applyReferralCredit re-checks (status='earned' AND
                  // credit_applied=false) via claim_referral_credit itself,
                  // so calling it unconditionally here also recovers that
                  // crash case instead of losing the credit silently.
                  const applied = await applyReferralCredit(env, serviceKey, prof.referred_by, tier, prof.id);
                  // Only notify once a REAL Stripe credit has been applied —
                  // the email promises "you earned a free month"; it must not
                  // go out before that's actually true (CRITICAL fix).
                  if (applied) {
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
    } else if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionDeleted(object, env);
    } else if (event.type === 'invoice.payment_failed') {
      await handlePaymentFailed(object, env);
    }

    // Mark AFTER successful processing (see comment above the fast-path
    // check). ON CONFLICT DO NOTHING makes this safe if two deliveries of
    // the same event both make it this far — the row already exists.
    await markEventProcessed(event.id, env);

    return ok();
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
}

async function wasEventProcessed(eventId, env) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!eventId || !env.SUPABASE_URL || !serviceKey) return false;
  try {
    const response = await withTimeout(fetch(
      `${env.SUPABASE_URL}/rest/v1/webhook_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    ));
    if (!response.ok) throw new Error(`dedup select returned ${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    // Fail OPEN on the check itself (matches prior behavior) — an
    // unreachable dedup table must not block real payment processing.
    console.error('Stripe webhook dedup check failed; continuing processing:', error);
    return false;
  }
}

async function markEventProcessed(eventId, env) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!eventId || !env.SUPABASE_URL || !serviceKey) return;
  try {
    const response = await withTimeout(fetch(`${env.SUPABASE_URL}/rest/v1/webhook_events`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({ event_id: eventId }),
    }));
    if (!response.ok) console.error('Stripe webhook dedup insert failed:', response.status);
  } catch (error) {
    // Best-effort — processing already succeeded; don't turn this into a
    // 500 that makes Stripe retry an already-completed event.
    console.error('Stripe webhook dedup insert failed:', error);
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
async function fetchProfile(env, serviceKey, filter, select = 'id,tier') {
  try {
    const res = await withTimeout(fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?${filter}&select=${select}`,
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
    // Becoming paid again clears the win-back marker so a FUTURE
    // cancellation still earns its own win-back email (see
    // 20260806200000_referral_credit_claim.sql).
    ...(tier !== 'free' ? { winback_sent_at: null } : {}),
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

  if (resolvedUserId && before && ['solo', 'crew', 'premium'].includes(before.tier)) {
    // Atomic claim: only the delivery that wins this compare-and-swap sends
    // the email, so a concurrent/duplicate cancellation delivery can't send
    // it twice (HIGH-2 — dedup no longer blocks re-processing up front).
    const claimed = await claimWinback(env, serviceKey, resolvedUserId);
    if (claimed) {
      await sendWinbackEmail(env, serviceKey, resolvedUserId, before.tier);
    }
  }
}

// Atomically claims the right to send this user's win-back email
// (winback_sent_at IS NULL -> now()). Returns false if another delivery
// already claimed it. Cleared by updateProfile whenever the user pays again.
async function claimWinback(env, serviceKey, userId) {
  try {
    const res = await withTimeout(fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&winback_sent_at=is.null`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ winback_sent_at: new Date().toISOString() }),
      },
    ));
    if (!res.ok) return false;
    const updated = await res.json();
    return Array.isArray(updated) && updated.length > 0;
  } catch (e) {
    return false;
  }
}

// Payment-failure webhook fan-out (MEDIUM-3: dead 'payment.failed' event).
// Fires the user's configured outbound webhooks — best-effort, never fails
// the Stripe webhook itself.
async function handlePaymentFailed(invoice, env) {
  try {
    const customerId = customerIdOf(invoice.customer);
    if (!customerId) return;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) return;
    const profile = await fetchProfile(env, serviceKey, `stripe_customer_id=eq.${encodeURIComponent(customerId)}`, 'id,business_name');
    if (!profile) return;
    await dispatchWebhookEvent(env, profile.id, 'payment.failed', {
      invoice_id: invoice.id,
      amount: typeof invoice.amount_due === 'number' ? invoice.amount_due / 100 : null,
      currency: invoice.currency || 'usd',
      business_name: profile.business_name || null,
    });
  } catch (e) {
    // best-effort — never fail the webhook over outbound dispatch
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

// Applies a REAL Stripe customer-balance credit for an earned referral
// (CRITICAL fix — previously earn_referral_credit only flipped DB rows,
// no money ever moved). Returns true only once the Stripe credit has
// actually been applied.
async function applyReferralCredit(env, serviceKey, referrerId, tier, referredUserId) {
  const amountCents = REFERRAL_CREDIT_CENTS[tier];
  if (!amountCents || !referrerId || !env.STRIPE_SECRET_KEY) return false;

  // Reserve first (atomic DB claim), THEN call Stripe. The Stripe call is an
  // external side effect that can't share a transaction with the claim, so
  // claiming before calling Stripe is the only way to guarantee no
  // double-credit under concurrent/duplicate webhook delivery.
  let claimed;
  try {
    const claimRes = await withTimeout(fetch(`${env.SUPABASE_URL}/rest/v1/rpc/claim_referral_credit`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_referred_user_id: referredUserId }),
    }));
    if (!claimRes.ok) return false;
    claimed = await claimRes.json();
  } catch (e) {
    return false;
  }
  if (claimed !== true) return false; // already applied by another delivery, or nothing pending

  try {
    const customerId = await resolveOrCreateStripeCustomer(env, serviceKey, referrerId);
    if (!customerId) {
      console.error(`Referral credit: could not resolve Stripe customer for referrer ${referrerId} — credit CLAIMED but NOT applied, needs manual reconciliation`);
      return false;
    }

    const txRes = await fetch(`${STRIPE_API}/customers/${encodeURIComponent(customerId)}/balance_transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        // Negative amount = credit in the customer's favor (Stripe convention).
        amount: String(-amountCents),
        currency: 'usd',
        description: 'MowGo referral credit — one free month',
      }).toString(),
    });
    const tx = await txRes.json();
    if (!txRes.ok || tx.error) {
      console.error(
        `Referral credit: Stripe balance_transaction failed for referrer ${referrerId} (customer ${customerId}) — credit CLAIMED but NOT applied, needs manual reconciliation:`,
        tx?.error?.message || txRes.status,
      );
      return false;
    }

    return true;
  } catch (e) {
    console.error(
      `Referral credit: unexpected error applying credit for referrer ${referrerId} — credit CLAIMED but NOT applied, needs manual reconciliation:`,
      e?.message || e,
    );
    return false;
  }
}

// Resolve the referrer's Stripe customer id, creating one if they've never
// checked out (mirrors the customer-creation + rollback-on-save-failure
// pattern in stripe/checkout-subscription.js).
async function resolveOrCreateStripeCustomer(env, serviceKey, userId) {
  const profRes = await withTimeout(fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?select=id,stripe_customer_id&id=eq.${encodeURIComponent(userId)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  ));
  if (!profRes.ok) return null;
  const [prof] = await profRes.json();
  if (!prof) return null;
  if (prof.stripe_customer_id) return prof.stripe_customer_id;

  const email = await fetchUserEmail(env, serviceKey, userId);
  if (!email) return null;

  const customerRes = await fetch(`${STRIPE_API}/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, 'metadata[supabase_user_id]': userId }).toString(),
  });
  const customer = await customerRes.json();
  if (!customerRes.ok || customer.error) return null;

  const saveRes = await withTimeout(fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripe_customer_id: customer.id }),
    },
  ));
  if (!saveRes.ok) {
    const del = await fetch(`${STRIPE_API}/customers/${encodeURIComponent(customer.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    if (!del.ok) console.error('Referral credit: could not clean up orphan Stripe customer', customer.id);
    return null;
  }

  return customer.id;
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
