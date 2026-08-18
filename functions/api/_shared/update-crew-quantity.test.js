import assert from 'node:assert/strict';
import test from 'node:test';

import { updateCrewQuantity } from './update-crew-quantity.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  STRIPE_SECRET_KEY: 'stripe-key',
  STRIPE_PRICE_CREW: 'price_crew_month',
  STRIPE_PRICE_CREW_ANNUAL: 'price_crew_year',
  STRIPE_PRICE_CREW_ADDON: 'price_addon_month',
  STRIPE_PRICE_CREW_ADDON_ANNUAL: 'price_addon_year',
};

function subscription({ id = 'sub_1', status = 'active', interval = 'month', pause_collection = null, addonQuantity } = {}) {
  const items = [{ id: 'si_base', quantity: 1, price: {
    id: interval === 'year' ? env.STRIPE_PRICE_CREW_ANNUAL : env.STRIPE_PRICE_CREW,
    recurring: { interval },
  } }];
  if (addonQuantity !== undefined) items.push({
    id: 'si_addon',
    quantity: addonQuantity,
    price: { id: interval === 'year' ? env.STRIPE_PRICE_CREW_ADDON_ANNUAL : env.STRIPE_PRICE_CREW_ADDON, recurring: { interval } },
  });
  return {
    id,
    status,
    pause_collection,
    metadata: { tier: 'crew' },
    items: { data: items },
  };
}

function mockFetch({ subscriptions = [subscription()], crewCount = 3 } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes('/profiles?id=eq.')) return Response.json([{ tier: 'crew', stripe_customer_id: 'cus_1' }]);
    if (url.includes('/subscriptions?')) return Response.json({ data: subscriptions });
    if (url.includes('/profiles?business_id=')) return Response.json(Array.from({ length: crewCount }, (_, i) => ({ id: `user_${i}` })));
    if (url.endsWith('/subscription_items')) return Response.json({ id: 'si_addon' });
    if (url.endsWith('/subscription_items/si_addon')) return Response.json({ id: 'si_addon' });
    throw new Error(`Unexpected request: ${url}`);
  };
  return calls;
}

test.afterEach(() => { delete globalThis.fetch; });

test('creates an annual add-on through the Subscription Items API', async () => {
  const calls = mockFetch({ subscriptions: [subscription({ interval: 'year' })] });
  await updateCrewQuantity(env, 'owner_1');

  const create = calls.find(call => call.url.endsWith('/subscription_items'));
  assert.equal(create?.init.method, 'POST');
  const body = new URLSearchParams(create.init.body);
  assert.equal(body.get('subscription'), 'sub_1');
  assert.equal(body.get('price'), env.STRIPE_PRICE_CREW_ADDON_ANNUAL);
  assert.equal(body.get('quantity'), '2');
});

test('does nothing when the annual add-on price is not configured', async () => {
  const calls = mockFetch({ subscriptions: [subscription({ interval: 'year' })] });
  await updateCrewQuantity({ ...env, STRIPE_PRICE_CREW_ADDON_ANNUAL: undefined }, 'owner_1');
  assert.equal(calls.some(call => call.url.endsWith('/subscription_items')), false);
});

test('updates an existing add-on with POST and removes it with DELETE', async () => {
  let calls = mockFetch({ subscriptions: [subscription({ addonQuantity: 1 })], crewCount: 4 });
  await updateCrewQuantity(env, 'owner_1');
  let mutation = calls.find(call => call.url.endsWith('/subscription_items/si_addon'));
  assert.equal(mutation?.init.method, 'POST');
  assert.equal(new URLSearchParams(mutation.init.body).get('quantity'), '3');

  calls = mockFetch({ subscriptions: [subscription({ addonQuantity: 2 })], crewCount: 1 });
  await updateCrewQuantity(env, 'owner_1');
  mutation = calls.find(call => call.url.endsWith('/subscription_items/si_addon'));
  assert.equal(mutation?.init.method, 'DELETE');
});

test('does not update canceled or paused subscriptions', async () => {
  for (const candidate of [
    subscription({ status: 'canceled' }),
    subscription({ status: 'paused' }),
    subscription({ pause_collection: { behavior: 'void' } }),
  ]) {
    const calls = mockFetch({ subscriptions: [candidate] });
    await updateCrewQuantity(env, 'owner_1');
    assert.equal(calls.some(call => call.url.endsWith('/subscription_items')), false);
  }
});

test('refuses to choose between multiple billable Crew subscriptions', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const calls = mockFetch({ subscriptions: [subscription({ id: 'sub_1' }), subscription({ id: 'sub_2' })] });
    await updateCrewQuantity(env, 'owner_1');
    assert.equal(calls.some(call => call.url.endsWith('/subscription_items')), false);
  } finally {
    console.error = originalError;
  }
});

test('serializes concurrent reconciliations for the same owner', async () => {
  const calls = mockFetch();
  await Promise.all([updateCrewQuantity(env, 'owner_1'), updateCrewQuantity(env, 'owner_1')]);
  const profileLookups = calls.filter(call => call.url.includes('/profiles?id=eq.'));
  assert.equal(profileLookups.length, 2);
  assert.equal(calls.filter(call => call.url.endsWith('/subscription_items')).length, 2);
});
