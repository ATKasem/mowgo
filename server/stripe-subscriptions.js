const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const VALID_TIERS = new Set(['solo', 'crew']);

function constructStripeEvent(stripe, rawBody, signature, webhookSecret) {
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function updateProfile(supabase, filters, values) {
  let query = supabase.from('profiles').update(values);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { error } = await query;
  if (error) throw error;
}

async function subscriptionIdentity(subscription, priceToTier) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const priceTier = priceToTier[priceId];
  const metadataTier = subscription.metadata?.tier;
  return {
    userId: subscription.metadata?.user_id || null,
    tier: VALID_TIERS.has(priceTier)
      ? priceTier
      : (VALID_TIERS.has(metadataTier) ? metadataTier : null),
  };
}

async function handleInvoiceCheckout(session, supabase) {
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) throw httpError(400, 'Missing invoice_id');

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('amount')
    .eq('id', invoiceId)
    .single();
  if (error || !invoice) throw httpError(404, 'Invoice not found');

  const paidCents = session.amount_total || 0;
  const invoiceCents = Math.round(Number(invoice.amount) * 100);
  if (!Number.isSafeInteger(invoiceCents) || paidCents !== invoiceCents) {
    throw httpError(400, `Amount mismatch: invoice=${invoiceCents} cents, paid=${paidCents} cents`);
  }

  const { error: updateError } = await supabase.from('invoices').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: session.payment_intent,
  }).eq('id', invoiceId);
  if (updateError) throw updateError;
}

async function handleSubscriptionCheckout(session, { supabase, stripe, priceToTier }) {
  let metadata = session.metadata || {};
  if ((!metadata.user_id || !metadata.tier) && session.subscription && stripe) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    metadata = { ...subscription.metadata, ...metadata };
  }

  if (!metadata.user_id || !VALID_TIERS.has(metadata.tier)) {
    throw new Error('Subscription Checkout session is missing valid user_id/tier metadata');
  }

  await updateProfile(
    supabase,
    { id: metadata.user_id },
    { tier: metadata.tier, stripe_customer_id: session.customer },
  );
}

async function handleStripeEvent(event, { supabase, stripe, priceToTier = {} }) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'subscription') {
        await handleSubscriptionCheckout(session, { supabase, stripe, priceToTier });
      } else {
        await handleInvoiceCheckout(session, supabase);
      }
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const { userId, tier } = await subscriptionIdentity(subscription, priceToTier);
      if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) break;
      if (!tier) throw new Error('Could not map subscription price to a MowGo tier');
      const filters = userId ? { id: userId } : { stripe_customer_id: subscription.customer };
      await updateProfile(supabase, filters, { tier });
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const filters = subscription.metadata?.user_id
        ? { id: subscription.metadata.user_id }
        : { stripe_customer_id: subscription.customer };
      await updateProfile(supabase, filters, { tier: 'free' });
      break;
    }
    default:
      break;
  }
}

module.exports = { constructStripeEvent, handleStripeEvent };
