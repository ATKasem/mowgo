/**
 * Provider-neutral handling of billing webhooks.
 *
 * Providers translate their own payloads into NormalizedEvents (contract.js);
 * this module applies them to MowGo's data: plan tier, billing identity,
 * crew seats, referral rewards, win-back email, outbound 'payment.failed'
 * webhooks, and marking invoices paid.
 *
 * Ported from the former Stripe webhook. Idempotency: the caller dedups by
 * event id AFTER this returns, so every step here must be safe to repeat.
 */

import { dispatchWebhookEvent } from '../dispatch-webhook.js';
import { updateCrewQuantity } from '../update-crew-quantity.js';
import { PLANS } from './contract.js';
import { callRpc, eq, fetchUserEmail, insertRow, patchRows, selectRows, withTimeout } from './supabase.js';
import { appUrl } from './http.js';

// One MONTHLY month of the referred user's plan, regardless of interval
// (the promise is "a free month"). Prices match client/src/pages/Landing.jsx.
export const REFERRAL_CREDIT_CENTS = { solo: 3900, crew: 7900, premium: 19900 };

export async function handleBillingEvent(env, provider, event) {
  switch (event.type) {
    case 'subscription.active':
      return handleSubscriptionActive(env, provider, event);
    case 'subscription.canceled':
      return handleSubscriptionCanceled(env, provider, event);
    case 'subscription.payment_failed':
      return handleSubscriptionPaymentFailed(env, provider, event);
    case 'invoice_payment.succeeded':
      return settleInvoicePayment(env, provider, event);
    case 'invoice_payment.failed':
      // Nothing to change: the invoice stays unpaid and the payer can retry.
      return;
    default:
      // Unknown types are ignored so new provider events can't break the webhook.
      return;
  }
}

// --- Subscriptions ----------------------------------------------------------

async function handleSubscriptionActive(env, provider, event) {
  const tier = event.plan === 'free' ? 'free' : event.plan;
  if (tier !== 'free' && !PLANS.includes(tier)) {
    // Unmapped plan id — don't guess a tier.
    console.error(`billing: ${provider.name} event ${event.id} has unknown plan ${event.plan}`);
    return;
  }

  const profileId = await updateBillingProfile(env, provider, {
    userId: event.userId,
    customerId: event.customerId,
    subscriptionId: event.subscriptionId,
    tier,
  });
  if (tier === 'crew' && profileId) await updateCrewQuantity(env, profileId);
  if (event.isNew && profileId && tier !== 'free') {
    await rewardReferrer(env, provider, profileId, tier);
  }
}

async function handleSubscriptionCanceled(env, provider, event) {
  const resolvedId = await resolveProfileId(env, provider, event.userId, event.customerId);
  if (!resolvedId) return;

  const [before] = await selectRows(env, 'profiles', `id=${eq(resolvedId)}&select=id,tier`);
  const updated = await patchRows(env, 'profiles', `id=${eq(resolvedId)}`, {
    tier: 'free',
    cancelled_at: new Date().toISOString(),
    billing_subscription_id: null,
  });
  if (updated.length === 0) return;

  if (before && before.tier !== 'free') await logTierChange(env, resolvedId, 'free');

  if (before && PLANS.includes(before.tier)) {
    // Atomic claim so duplicate deliveries can't send the email twice.
    const claimed = await patchRows(
      env,
      'profiles',
      `id=${eq(resolvedId)}&winback_sent_at=is.null`,
      { winback_sent_at: new Date().toISOString() },
    ).catch(() => []);
    if (claimed.length > 0) await sendWinbackEmail(env, resolvedId, before.tier);
  }
}

async function handleSubscriptionPaymentFailed(env, provider, event) {
  try {
    const profileId = await resolveProfileId(env, provider, event.userId, event.customerId);
    if (!profileId) return;
    const [profile] = await selectRows(env, 'profiles', `id=${eq(profileId)}&select=id,business_name`);
    await dispatchWebhookEvent(env, profileId, 'payment.failed', {
      invoice_id: event.providerPaymentId || null,
      amount: typeof event.amountCents === 'number' ? event.amountCents / 100 : null,
      currency: event.currency || 'usd',
      business_name: profile?.business_name || null,
    });
  } catch {
    // Outbound fan-out is best-effort; never fail the webhook over it.
  }
}

/**
 * Apply plan + billing identity to the profile. Identifies by MowGo user id
 * first, then by (provider, customer id) when it matches exactly one profile.
 * Returns the profile id that was updated, or null.
 */
async function updateBillingProfile(env, provider, { userId, customerId, subscriptionId, tier }) {
  if (!userId && !customerId) throw new Error('Billing event has no profile identity');

  const patch = {
    tier,
    billing_provider: provider.name,
    ...(customerId ? { billing_customer_id: customerId } : {}),
    ...(subscriptionId !== undefined ? { billing_subscription_id: subscriptionId || null } : {}),
    // Paying again re-arms a future win-back email.
    ...(tier !== 'free' ? { winback_sent_at: null } : {}),
    // A real subscription consumes the in-app trial (trial-first flow).
    trial_tier: null,
    trial_started_at: null,
    trial_ends_at: null,
  };

  const resolvedId = await resolveProfileId(env, provider, userId, customerId);
  if (!resolvedId) return null;

  const [before] = await selectRows(env, 'profiles', `id=${eq(resolvedId)}&select=id,tier`);
  const updated = await patchRows(env, 'profiles', `id=${eq(resolvedId)}`, patch);
  if (updated.length === 0) return null;
  if (before && before.tier !== tier) await logTierChange(env, resolvedId, tier);
  return resolvedId;
}

async function resolveProfileId(env, provider, userId, customerId) {
  if (userId) {
    const rows = await selectRows(env, 'profiles', `id=${eq(userId)}&select=id`);
    if (rows.length === 1) return rows[0].id;
    if (!customerId) return null;
  }
  if (!customerId) return null;
  // PostgREST PATCH by a non-unique filter would hit every match, so resolve
  // to exactly one profile and patch by primary key.
  const rows = await selectRows(
    env,
    'profiles',
    `billing_provider=${eq(provider.name)}&billing_customer_id=${eq(customerId)}&select=id`,
  );
  if (rows.length === 1) return rows[0].id;
  if (rows.length > 1) {
    console.warn(`billing: ambiguous ${provider.name} customer ${customerId} matches ${rows.length} profiles; updating none`);
  }
  return null;
}

async function logTierChange(env, userId, tier) {
  try {
    await insertRow(env, 'tier_events', { user_id: userId, tier, source: 'webhook' });
  } catch {
    // Analytics only — never fail the webhook over it.
  }
}

// --- Referrals --------------------------------------------------------------

async function rewardReferrer(env, provider, referredUserId, tier) {
  try {
    const [profile] = await selectRows(env, 'profiles', `id=${eq(referredUserId)}&select=id,referred_by`);
    if (!profile?.referred_by) return;

    const earnRes = await callRpc(env, 'earn_referral_credit', { p_referred_user_id: referredUserId });
    if (!earnRes.ok) return;
    // Don't gate on earn's return value: an earlier delivery may have earned it
    // and crashed before the credit was applied. claim_referral_credit inside
    // applyReferralCredit re-checks, which also recovers that case.
    const applied = await applyReferralCredit(env, provider, profile.referred_by, tier, referredUserId);
    if (applied) await sendReferralEarnEmail(env, profile.referred_by, referredUserId);
  } catch {
    // Referrals are best-effort; never fail the webhook over them.
  }
}

async function applyReferralCredit(env, provider, referrerId, tier, referredUserId) {
  const amountCents = REFERRAL_CREDIT_CENTS[tier];
  if (!amountCents || !referrerId) return false;

  // Reserve first (atomic DB claim), then call the provider — the external
  // call can't share a transaction, so this is the only way to avoid a
  // double credit under duplicate delivery.
  let claimed;
  try {
    const claimRes = await callRpc(env, 'claim_referral_credit', { p_referred_user_id: referredUserId });
    if (!claimRes.ok) return false;
    claimed = await claimRes.json();
  } catch {
    return false;
  }
  if (claimed !== true) return false;

  const reconcile = (why) => console.error(
    `Referral credit: ${why} for referrer ${referrerId} — credit CLAIMED but NOT applied, needs manual reconciliation`,
  );
  try {
    const customerId = await ensureBillingCustomer(env, provider, referrerId);
    if (!customerId) {
      reconcile(`could not resolve ${provider.name} customer`);
      return false;
    }
    const ok = await provider.applyAccountCredit({
      customerId,
      amountCents,
      description: 'MowGo referral credit — one free month',
    });
    if (!ok) reconcile(`${provider.name} did not apply the credit`);
    return ok === true;
  } catch (error) {
    reconcile(`unexpected error (${error?.message || error})`);
    return false;
  }
}

/** The user's provider customer id, creating and saving one if needed. */
export async function ensureBillingCustomer(env, provider, userId) {
  const [profile] = await selectRows(
    env,
    'profiles',
    `id=${eq(userId)}&select=id,billing_provider,billing_customer_id`,
  );
  if (!profile) return null;
  const existing = profile.billing_provider === provider.name ? profile.billing_customer_id : null;
  if (existing) return existing;

  const email = await fetchUserEmail(env, userId);
  const customerId = await provider.ensureCustomer({ userId, email, existingCustomerId: null });
  if (!customerId) return null;
  const saved = await patchRows(env, 'profiles', `id=${eq(userId)}`, {
    billing_provider: provider.name,
    billing_customer_id: customerId,
  });
  return saved.length > 0 ? customerId : null;
}

// --- Invoice payments ---------------------------------------------------------

/** Integer cents from a numeric/decimal-string invoice amount, or null. */
export function amountToCents(value) {
  const match = String(value ?? '').match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

async function settleInvoicePayment(env, provider, event) {
  const { invoiceId, userId, providerPaymentId, amountCents } = event;
  if (!invoiceId || !userId || !providerPaymentId) {
    console.error(`billing: ${provider.name} payment event ${event.id} is missing invoice/user/payment ids`);
    return;
  }

  const [invoice] = await selectRows(
    env,
    'invoices',
    `id=${eq(invoiceId)}&user_id=${eq(userId)}&select=id,amount,status,payment_provider,provider_payment_id`,
  );
  // Problems below are logged, not thrown: retrying won't fix them, and a
  // throw would make the provider redeliver forever.
  if (!invoice) {
    console.error(`billing: payment ${providerPaymentId} references unknown invoice ${invoiceId}`);
    return;
  }
  if (invoice.status === 'paid') return;
  if (invoice.payment_provider !== provider.name || invoice.provider_payment_id !== providerPaymentId) {
    console.error(`billing: payment ${providerPaymentId} doesn't match invoice ${invoiceId}'s current payment — needs manual review`);
    return;
  }
  if (amountToCents(invoice.amount) !== amountCents) {
    console.error(`billing: payment ${providerPaymentId} amount ${amountCents} != invoice ${invoiceId} amount — needs manual review`);
    return;
  }
  if (invoice.status === 'voided') {
    console.error(`billing: payment ${providerPaymentId} received for VOIDED invoice ${invoiceId} — refund or reconcile manually`);
    return;
  }

  await patchRows(
    env,
    'invoices',
    `id=${eq(invoiceId)}&user_id=${eq(userId)}&provider_payment_id=${eq(providerPaymentId)}&status=in.(unpaid,overdue)`,
    { status: 'paid', paid_at: new Date().toISOString() },
  );
}

// --- Email ------------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !to) return;
  await withTimeout(fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'MowGo <invoices@mowgoapp.com>', to, subject, html }),
  }));
}

export function winbackContent(previousTier, baseUrl) {
  const subscribeUrl = `${baseUrl}/#/subscribe`;
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

async function sendWinbackEmail(env, userId, previousTier) {
  try {
    const email = await fetchUserEmail(env, userId);
    const { subject, html } = winbackContent(previousTier, appUrl(env));
    await sendEmail(env, email, subject, html);
  } catch {
    // Best-effort.
  }
}

async function sendReferralEarnEmail(env, referrerId, referredUserId) {
  try {
    const email = await fetchUserEmail(env, referrerId);
    const [referred] = await selectRows(env, 'profiles', `id=${eq(referredUserId)}&select=business_name`);
    const html = `<p>You just earned a <strong>free month</strong> on MowGo!</p><p>${escapeHtml(referred?.business_name || 'A crew')} subscribed using your referral code.</p><p>Your credit will be applied to your next renewal automatically.</p>`;
    await sendEmail(env, email, 'You earned a free month on MowGo', html);
  } catch {
    // Best-effort.
  }
}
