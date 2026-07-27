const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  constructStripeEvent,
  handleStripeEvent,
} = require('../stripe-subscriptions');

function createSupabase(profiles, invoices = {}) {
  const updates = [];
  return {
    updates,
    from(table) {
      const state = { table, filters: {} };
      const query = {
        select() { return query; },
        eq(column, value) {
          state.filters[column] = value;
          return query;
        },
        update(values) {
          updates.push({ table, values, filters: state.filters });
          return query;
        },
        async single() {
          if (table === 'profiles') {
            const profile = profiles.find((item) =>
              Object.entries(state.filters).every(([key, value]) => item[key] === value));
            return { data: profile || null, error: profile ? null : new Error('not found') };
          }
          const invoice = invoices[state.filters.id];
          return { data: invoice || null, error: invoice ? null : new Error('not found') };
        },
      };
      return query;
    },
  };
}

test('constructStripeEvent accepts a valid signature and rejects a tampered body', () => {
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const timestamp = '1700000000';
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const signature = `t=${timestamp},v1=${digest}`;
  const stripe = {
    webhooks: {
      constructEvent(rawBody, header, signingSecret) {
        const parts = Object.fromEntries(header.split(',').map((part) => part.split('=')));
        const expected = crypto.createHmac('sha256', signingSecret)
          .update(`${parts.t}.${rawBody.toString()}`)
          .digest('hex');
        if (parts.v1 !== expected) throw new Error('Webhook signature verification failed');
        return JSON.parse(rawBody.toString());
      },
    },
  };

  assert.equal(constructStripeEvent(stripe, Buffer.from(payload), signature, secret).id, 'evt_1');
  assert.throws(
    () => constructStripeEvent(stripe, Buffer.from(`${payload} `), signature, secret),
    /signature/i,
  );
});

test('subscription checkout upgrades the authenticated profile and preserves invoice handling', async () => {
  const supabase = createSupabase([{ id: 'user_1', stripe_customer_id: null, tier: 'free' }], {
    inv_1: { amount: 25 },
  });

  await handleStripeEvent({
    type: 'checkout.session.completed',
    data: { object: {
      mode: 'subscription',
      customer: 'cus_1',
      metadata: { user_id: 'user_1', tier: 'solo' },
    } },
  }, { supabase, priceToTier: {} });

  await handleStripeEvent({
    type: 'checkout.session.completed',
    data: { object: {
      mode: 'payment',
      amount_total: 2500,
      payment_intent: 'pi_1',
      metadata: { invoice_id: 'inv_1' },
    } },
  }, { supabase, priceToTier: {} });

  assert.deepEqual(supabase.updates[0], {
    table: 'profiles',
    values: { tier: 'solo', stripe_customer_id: 'cus_1' },
    filters: { id: 'user_1' },
  });
  assert.equal(supabase.updates[1].table, 'invoices');
  assert.equal(supabase.updates[1].values.status, 'paid');
});

test('subscription updates infer portal plan changes from the Stripe price', async () => {
  const supabase = createSupabase([{ id: 'user_1', stripe_customer_id: 'cus_1', tier: 'solo' }]);

  await handleStripeEvent({
    type: 'customer.subscription.updated',
    data: { object: {
      customer: 'cus_1',
      status: 'active',
      metadata: { user_id: 'user_1', tier: 'solo' },
      items: { data: [{ price: { id: 'price_crew' } }] },
    } },
  }, { supabase, priceToTier: { price_crew: 'crew' } });

  assert.equal(supabase.updates[0].values.tier, 'crew');
});

test('deleted subscriptions downgrade the customer profile to free', async () => {
  const supabase = createSupabase([{ id: 'user_1', stripe_customer_id: 'cus_1', tier: 'crew' }]);

  await handleStripeEvent({
    type: 'customer.subscription.deleted',
    data: { object: { customer: 'cus_1', metadata: {} } },
  }, { supabase, priceToTier: {} });

  assert.deepEqual(supabase.updates[0], {
    table: 'profiles',
    values: { tier: 'free' },
    filters: { stripe_customer_id: 'cus_1' },
  });
});
