import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { registerPaymentProvider, paymentsConfig, getPaymentProvider } from './registry.js';
import { amountToCents } from './billing-events.js';
import {
  FakeProvider, SUPABASE_URL, apiRequest, authOk, baseEnv, mockFetch, resetFake, rest,
} from './test-helpers.js';
import { onRequestGet as configGet } from '../../payments/config.js';
import { onRequestPost as checkoutPost } from '../../payments/subscription-checkout.js';
import { onRequestPost as portalPost } from '../../payments/billing-portal.js';
import { onRequestPost as cancelPost } from '../../payments/cancel-subscription.js';
import { onRequestPost as invoiceLinkPost } from '../../payments/invoice-link.js';
import { onRequestPost as webhookPost } from '../../payments/webhook.js';
import { updateCrewQuantity } from '../update-crew-quantity.js';

registerPaymentProvider('fake', FakeProvider);

let fetchMock;
beforeEach(() => resetFake());
afterEach(() => fetchMock?.restore());

const UUID = '11111111-2222-4333-8444-555555555555';
const noProviderEnv = { ...baseEnv, PAYMENTS_PROVIDER: '' };

describe('registry', () => {
  test('no provider configured → payments unavailable', () => {
    assert.equal(getPaymentProvider(noProviderEnv), null);
    assert.deepEqual(paymentsConfig(noProviderEnv), { provider: null, subscriptions: false, invoicePayments: false });
  });

  test('rise stub is never ready, even with credentials set', () => {
    const env = {
      PAYMENTS_PROVIDER: 'rise',
      RISE_API_BASE_URL: 'https://x', RISE_API_KEY: 'k', RISE_API_SECRET: 's',
      RISE_PLATFORM_MERCHANT_ID: 'm', RISE_WEBHOOK_SECRET: 'w', RISE_HOSTED_PAGE_HOSTS: 'pay.x',
    };
    assert.equal(getPaymentProvider(env), null);
  });

  test('a ready provider is reported', () => {
    assert.deepEqual(paymentsConfig(baseEnv), { provider: 'fake', subscriptions: true, invoicePayments: true });
    FakeProvider.behavior.ready = false;
    assert.equal(getPaymentProvider(baseEnv), null);
  });

  test('config endpoint returns the summary', async () => {
    const res = await configGet({ request: new Request('https://mowgoapp.com/api/payments/config'), env: noProviderEnv });
    assert.deepEqual(await res.json(), { provider: null, subscriptions: false, invoicePayments: false });
  });
});

test('amountToCents parses decimal strings exactly', () => {
  assert.equal(amountToCents('45.5'), 4550);
  assert.equal(amountToCents(45.05), 4505);
  assert.equal(amountToCents('100000'), 10000000);
  assert.equal(amountToCents('0'), null);
  assert.equal(amountToCents('-5'), null);
  assert.equal(amountToCents('1.234'), null);
  assert.equal(amountToCents(null), null);
});

describe('subscription-checkout', () => {
  const call = (env, opts) => checkoutPost({ request: apiRequest('/api/payments/subscription-checkout', opts), env });

  test('rejects foreign browser origins before anything else', async () => {
    fetchMock = mockFetch([]);
    const res = await call(baseEnv, { origin: 'https://evil.example', body: { plan: 'solo' } });
    assert.equal(res.status, 403);
    assert.equal(fetchMock.calls.length, 0);
  });

  test('401 without a valid token', async () => {
    fetchMock = mockFetch([{ method: 'GET', match: (u) => u.endsWith('/auth/v1/user'), reply: () => new Response('no', { status: 401 }) }]);
    const res = await call(baseEnv, { body: { plan: 'solo' } });
    assert.equal(res.status, 401);
  });

  test('400 on invalid plan or interval', async () => {
    fetchMock = mockFetch([authOk()]);
    assert.equal((await call(baseEnv, { body: { plan: 'gold' } })).status, 400);
    assert.equal((await call(baseEnv, { body: { plan: 'solo', interval: 'week' } })).status, 400);
  });

  test('503 payments_unavailable when no provider is live', async () => {
    fetchMock = mockFetch([authOk()]);
    const res = await call(noProviderEnv, { body: { plan: 'crew' } });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'payments_unavailable');
  });

  test('creates a customer, checks for an active plan, returns the hosted URL', async () => {
    let savedPatch;
    fetchMock = mockFetch([
      authOk('user-1', 'owner@example.com'),
      rest('GET', 'profiles', (url) => (url.includes('trial_ends_at')
        ? [{ id: 'user-1', trial_ends_at: null }]
        : [{ id: 'user-1', billing_provider: null, billing_customer_id: null }])),
      { method: 'GET', match: (u) => u.includes('/auth/v1/admin/users/user-1'), reply: () => ({ email: 'owner@example.com' }) },
      rest('PATCH', 'profiles', (url, init) => { savedPatch = init.body; return [{ id: 'user-1' }]; }),
    ]);
    const res = await call(baseEnv, { body: { plan: 'crew', interval: 'year', platform: 'android' } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { url: 'https://pay.fake.test/checkout/1' });
    assert.deepEqual(savedPatch, { billing_provider: 'fake', billing_customer_id: 'cus_new' });

    const checkout = FakeProvider.calls.find((c) => c.method === 'createSubscriptionCheckout').args;
    assert.equal(checkout.customerId, 'cus_new');
    assert.equal(checkout.plan, 'crew');
    assert.equal(checkout.interval, 'year');
    assert.equal(checkout.trialDays, 14);
    // Native apps return through the deep-link bounce page.
    assert.equal(checkout.returnUrls.success, 'https://mowgoapp.com/#/portal-return?result=upgraded');
  });

  test('no second trial after the in-app trial; web return URLs', async () => {
    fetchMock = mockFetch([
      authOk(),
      rest('GET', 'profiles', (url) => (url.includes('trial_ends_at')
        ? [{ id: 'user-1', trial_ends_at: '2026-01-01T00:00:00Z' }]
        : [{ id: 'user-1', billing_provider: 'fake', billing_customer_id: 'cus_1' }])),
    ]);
    const res = await call(baseEnv, { origin: 'https://mowgoapp.com', body: { plan: 'solo' } });
    assert.equal(res.status, 200);
    const checkout = FakeProvider.calls.find((c) => c.method === 'createSubscriptionCheckout').args;
    assert.equal(checkout.trialDays, 0);
    assert.equal(checkout.customerId, 'cus_1');
    assert.equal(checkout.returnUrls.success, 'https://mowgoapp.com/#/subscribe?checkout=success');
  });

  test('409 when already subscribed (double-billing guard)', async () => {
    FakeProvider.behavior.getActiveSubscription = () => ({ id: 'sub_1', plan: 'solo', status: 'active' });
    fetchMock = mockFetch([
      authOk(),
      rest('GET', 'profiles', () => [{ id: 'user-1', trial_ends_at: null, billing_provider: 'fake', billing_customer_id: 'cus_1' }]),
    ]);
    const res = await call(baseEnv, { body: { plan: 'solo' } });
    assert.equal(res.status, 409);
    assert.equal(FakeProvider.calls.some((c) => c.method === 'createSubscriptionCheckout'), false);
  });

  test('502 when the provider returns a URL on a host it does not own', async () => {
    FakeProvider.behavior.createSubscriptionCheckout = () => ({ url: 'https://evil.example/pay' });
    fetchMock = mockFetch([
      authOk(),
      rest('GET', 'profiles', () => [{ id: 'user-1', trial_ends_at: null, billing_provider: 'fake', billing_customer_id: 'cus_1' }]),
    ]);
    const res = await call(baseEnv, { body: { plan: 'solo' } });
    assert.equal(res.status, 502);
    assert.equal(JSON.stringify(await res.json()).includes('evil'), false);
  });
});

describe('billing-portal and cancel-subscription', () => {
  test('400 when the user has no billing account with this provider', async () => {
    fetchMock = mockFetch([authOk(), rest('GET', 'profiles', () => [{ billing_provider: 'other', billing_customer_id: 'x' }])]);
    const res = await portalPost({ request: apiRequest('/api/payments/billing-portal', { body: {} }), env: baseEnv });
    assert.equal(res.status, 400);
  });

  test('portal returns the hosted URL', async () => {
    fetchMock = mockFetch([authOk(), rest('GET', 'profiles', () => [{ billing_provider: 'fake', billing_customer_id: 'cus_1' }])]);
    const res = await portalPost({ request: apiRequest('/api/payments/billing-portal', { body: { platform: 'ios' } }), env: baseEnv });
    assert.deepEqual(await res.json(), { url: 'https://pay.fake.test/portal/1' });
    assert.equal(FakeProvider.calls[0].args.returnUrl, 'https://mowgoapp.com/#/portal-return?result=portal');
  });

  test('cancel passes the stored subscription id', async () => {
    fetchMock = mockFetch([authOk(), rest('GET', 'profiles', () => [{
      billing_provider: 'fake', billing_customer_id: 'cus_1', billing_subscription_id: 'sub_9',
    }])]);
    const res = await cancelPost({ request: apiRequest('/api/payments/cancel-subscription', { body: {} }), env: baseEnv });
    assert.deepEqual(await res.json(), { success: true });
    assert.deepEqual(FakeProvider.calls[0], { method: 'cancelSubscription', args: { customerId: 'cus_1', subscriptionId: 'sub_9' } });
  });

  test('503 when no provider is live', async () => {
    fetchMock = mockFetch([authOk()]);
    const res = await cancelPost({ request: apiRequest('/api/payments/cancel-subscription', { body: {} }), env: noProviderEnv });
    assert.equal(res.status, 503);
  });
});

describe('invoice-link', () => {
  const call = (env, body = { invoice_id: UUID }) => invoiceLinkPost({ request: apiRequest('/api/payments/invoice-link', { body }), env });
  const invoiceRow = (overrides = {}) => ({
    id: UUID, amount: '120.00', status: 'unpaid', payment_provider: null, provider_payment_id: null,
    payment_link_url: null, payment_link_amount_cents: null, clients: { name: 'Pat' }, ...overrides,
  });
  const activeMerchant = rest('GET', 'merchant_accounts', () => [{ provider_merchant_id: 'mer_1', status: 'active' }]);

  test('400 on a missing or malformed invoice id', async () => {
    fetchMock = mockFetch([authOk()]);
    assert.equal((await call(baseEnv, {})).status, 400);
    assert.equal((await call(baseEnv, { invoice_id: '1; drop' })).status, 400);
  });

  test('only looks up the caller\'s own invoice', async () => {
    fetchMock = mockFetch([authOk('owner-9'), rest('GET', 'invoices', () => [])]);
    const res = await call(baseEnv);
    assert.equal(res.status, 404);
    const lookup = fetchMock.calls.find((c) => c.url.includes('/rest/v1/invoices'));
    assert.match(lookup.url, /user_id=eq\.owner-9/);
  });

  test('409 for paid or voided invoices', async () => {
    fetchMock = mockFetch([authOk(), rest('GET', 'invoices', () => [invoiceRow({ status: 'paid' })])]);
    assert.equal((await call(baseEnv)).status, 409);
    fetchMock.restore();
    fetchMock = mockFetch([authOk(), rest('GET', 'invoices', () => [invoiceRow({ status: 'voided' })])]);
    assert.equal((await call(baseEnv)).status, 409);
  });

  test('409 merchant_not_ready until the business has an active merchant account', async () => {
    fetchMock = mockFetch([
      authOk(), rest('GET', 'invoices', () => [invoiceRow()]),
      rest('GET', 'merchant_accounts', () => [{ provider_merchant_id: 'mer_1', status: 'pending' }]),
    ]);
    const res = await call(baseEnv);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'merchant_not_ready');
  });

  test('reuses the stored link while the amount is unchanged', async () => {
    fetchMock = mockFetch([
      authOk(),
      rest('GET', 'invoices', () => [invoiceRow({
        payment_provider: 'fake', provider_payment_id: 'pay_1',
        payment_link_url: 'https://pay.fake.test/inv/1', payment_link_amount_cents: 12000,
      })]),
      activeMerchant,
    ]);
    const res = await call(baseEnv);
    assert.deepEqual(await res.json(), { url: 'https://pay.fake.test/inv/1' });
    assert.equal(FakeProvider.calls.length, 0);
  });

  test('amount changed → new link that tells the provider to cancel the old one', async () => {
    let patch;
    let patchUrl;
    fetchMock = mockFetch([
      authOk(),
      rest('GET', 'invoices', () => [invoiceRow({
        payment_provider: 'fake', provider_payment_id: 'pay_1',
        payment_link_url: 'https://pay.fake.test/inv/1', payment_link_amount_cents: 10000,
      })]),
      activeMerchant,
      rest('PATCH', 'invoices', (url, init) => { patchUrl = url; patch = init.body; return [{ id: UUID }]; }),
    ]);
    const res = await call(baseEnv);
    assert.deepEqual(await res.json(), { url: 'https://pay.fake.test/inv/2' });
    const args = FakeProvider.calls[0].args;
    assert.equal(args.amountCents, 12000);
    assert.equal(args.merchantAccountId, 'mer_1');
    assert.equal(args.previousProviderPaymentId, 'pay_1');
    assert.match(patchUrl, /provider_payment_id=eq\.pay_1/);
    assert.match(patchUrl, /status=in\.\(unpaid,overdue\)/);
    assert.deepEqual(patch, {
      payment_provider: 'fake', provider_payment_id: 'pay_2',
      payment_link_url: 'https://pay.fake.test/inv/2', payment_link_amount_cents: 12000,
    });
  });

  test('409 when a concurrent request already replaced the link', async () => {
    fetchMock = mockFetch([
      authOk(), rest('GET', 'invoices', () => [invoiceRow()]), activeMerchant,
      rest('PATCH', 'invoices', () => []),
    ]);
    const res = await call(baseEnv);
    assert.equal(res.status, 409);
  });
});

describe('webhook', () => {
  const post = (env = baseEnv) => webhookPost({ request: new Request('https://mowgoapp.com/api/payments/webhook', { method: 'POST', body: '{}' }), env });

  test('acknowledges and ignores everything when no provider is live', async () => {
    fetchMock = mockFetch([]);
    const res = await post(noProviderEnv);
    assert.equal(res.status, 200);
    assert.equal(fetchMock.calls.length, 0);
  });

  test('invalid signature → 200 with no processing', async () => {
    FakeProvider.behavior.parseWebhook = () => null;
    fetchMock = mockFetch([]);
    assert.equal((await post()).status, 200);
    assert.equal(fetchMock.calls.length, 0);
  });

  test('subscription.active sets tier + billing identity, logs tier change, then dedups', async () => {
    FakeProvider.behavior.parseWebhook = () => [{
      id: 'evt_1', type: 'subscription.active', userId: 'user-1', customerId: 'cus_1', subscriptionId: 'sub_1', plan: 'solo',
    }];
    const patches = [];
    const inserts = [];
    fetchMock = mockFetch([
      rest('GET', 'webhook_events', () => []),
      rest('GET', 'profiles', () => [{ id: 'user-1', tier: 'free' }]),
      rest('PATCH', 'profiles', (url, init) => { patches.push(init.body); return [{ id: 'user-1' }]; }),
      rest('POST', 'tier_events', (url, init) => { inserts.push(['tier_events', init.body]); return new Response(null, { status: 201 }); }),
      rest('POST', 'webhook_events', (url, init) => { inserts.push(['webhook_events', init.body]); return new Response(null, { status: 201 }); }),
    ]);
    assert.equal((await post()).status, 200);
    assert.equal(patches[0].tier, 'solo');
    assert.equal(patches[0].billing_provider, 'fake');
    assert.equal(patches[0].billing_customer_id, 'cus_1');
    assert.equal(patches[0].billing_subscription_id, 'sub_1');
    assert.equal(patches[0].trial_ends_at, null);
    assert.deepEqual(inserts[0], ['tier_events', { user_id: 'user-1', tier: 'solo', source: 'webhook' }]);
    assert.deepEqual(inserts[1], ['webhook_events', { event_id: 'fake:evt_1', provider: 'fake' }]);
  });

  test('already-processed events are skipped', async () => {
    FakeProvider.behavior.parseWebhook = () => [{ id: 'evt_1', type: 'subscription.active', userId: 'user-1', plan: 'solo' }];
    fetchMock = mockFetch([rest('GET', 'webhook_events', () => [{ event_id: 'fake:evt_1' }])]);
    assert.equal((await post()).status, 200);
    assert.equal(fetchMock.calls.length, 1);
  });

  test('a processing failure returns 500 and is NOT marked processed', async () => {
    FakeProvider.behavior.parseWebhook = () => [{ id: 'evt_2', type: 'subscription.active', userId: 'user-1', plan: 'crew' }];
    fetchMock = mockFetch([
      rest('GET', 'webhook_events', () => []),
      rest('GET', 'profiles', () => [{ id: 'user-1', tier: 'free' }]),
      rest('PATCH', 'profiles', () => new Response('boom', { status: 500 })),
    ]);
    assert.equal((await post()).status, 500);
    assert.equal(fetchMock.calls.some((c) => c.method === 'POST' && c.url.includes('webhook_events')), false);
  });

  test('unknown plans are ignored instead of guessed', async () => {
    FakeProvider.behavior.parseWebhook = () => [{ id: 'evt_3', type: 'subscription.active', userId: 'user-1', plan: 'gold' }];
    fetchMock = mockFetch([
      rest('GET', 'webhook_events', () => []),
      rest('POST', 'webhook_events', () => new Response(null, { status: 201 })),
    ]);
    assert.equal((await post()).status, 200);
    assert.equal(fetchMock.calls.some((c) => c.method === 'PATCH'), false);
  });

  test('customer-id fallback refuses ambiguous matches', async () => {
    FakeProvider.behavior.parseWebhook = () => [{ id: 'evt_4', type: 'subscription.canceled', customerId: 'cus_dup' }];
    fetchMock = mockFetch([
      rest('GET', 'webhook_events', () => []),
      rest('GET', 'profiles', () => [{ id: 'a' }, { id: 'b' }]),
      rest('POST', 'webhook_events', () => new Response(null, { status: 201 })),
    ]);
    assert.equal((await post()).status, 200);
    assert.equal(fetchMock.calls.some((c) => c.method === 'PATCH'), false);
  });

  describe('invoice_payment.succeeded', () => {
    const event = (overrides = {}) => ({
      id: 'evt_p', type: 'invoice_payment.succeeded', invoiceId: UUID, userId: 'owner-1',
      providerPaymentId: 'pay_2', amountCents: 12000, currency: 'usd', ...overrides,
    });
    const setup = (invoice) => {
      const patches = [];
      fetchMock = mockFetch([
        rest('GET', 'webhook_events', () => []),
        rest('GET', 'invoices', () => (invoice ? [invoice] : [])),
        rest('PATCH', 'invoices', (url, init) => { patches.push({ url, body: init.body }); return [{ id: UUID }]; }),
        rest('POST', 'webhook_events', () => new Response(null, { status: 201 })),
      ]);
      return patches;
    };
    const matching = { id: UUID, amount: '120.00', status: 'unpaid', payment_provider: 'fake', provider_payment_id: 'pay_2' };

    test('marks the invoice paid when ids and amount match', async () => {
      FakeProvider.behavior.parseWebhook = () => [event()];
      const patches = setup(matching);
      assert.equal((await post()).status, 200);
      assert.equal(patches.length, 1);
      assert.equal(patches[0].body.status, 'paid');
      assert.match(patches[0].url, /provider_payment_id=eq\.pay_2/);
      assert.match(patches[0].url, /status=in\.\(unpaid,overdue\)/);
    });

    for (const [name, invoice, overrides] of [
      ['amount mismatch', matching, { amountCents: 10000 }],
      ['stale payment id', matching, { providerPaymentId: 'pay_1' }],
      ['voided invoice', { ...matching, status: 'voided' }, {}],
      ['already paid', { ...matching, status: 'paid' }, {}],
      ['unknown invoice', null, {}],
      ['other provider', { ...matching, payment_provider: 'rise' }, {}],
    ]) {
      test(`does not mark paid: ${name}`, async () => {
        FakeProvider.behavior.parseWebhook = () => [event(overrides)];
        const patches = setup(invoice);
        assert.equal((await post()).status, 200);
        assert.equal(patches.length, 0);
      });
    }
  });
});

describe('updateCrewQuantity', () => {
  test('bills members beyond the first as extra seats', async () => {
    fetchMock = mockFetch([
      rest('GET', 'profiles', (url) => (url.includes('business_id')
        ? [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]
        : [{ tier: 'crew', billing_provider: 'fake', billing_customer_id: 'cus_1', billing_subscription_id: 'sub_1' }])),
    ]);
    await updateCrewQuantity(baseEnv, 'owner-1');
    assert.deepEqual(FakeProvider.calls, [{ method: 'setExtraSeats', args: { customerId: 'cus_1', subscriptionId: 'sub_1', extraSeats: 2 } }]);
  });

  test('no-op for non-crew tiers, other providers, or no live provider', async () => {
    for (const profile of [
      { tier: 'solo', billing_provider: 'fake', billing_customer_id: 'cus_1' },
      { tier: 'crew', billing_provider: 'stripe', billing_customer_id: 'cus_1' },
    ]) {
      fetchMock = mockFetch([rest('GET', 'profiles', () => [profile])]);
      await updateCrewQuantity(baseEnv, 'owner-1');
      fetchMock.restore();
    }
    fetchMock = mockFetch([]);
    await updateCrewQuantity(noProviderEnv, 'owner-1');
    assert.equal(FakeProvider.calls.length, 0);
  });

  test('never throws to the caller', async () => {
    FakeProvider.behavior.setExtraSeats = () => { throw new Error('provider down'); };
    fetchMock = mockFetch([rest('GET', 'profiles', (url) => (url.includes('business_id') ? [] : [{ tier: 'crew', billing_provider: 'fake', billing_customer_id: 'c' }]))]);
    await updateCrewQuantity(baseEnv, 'owner-1');
  });
});

void SUPABASE_URL;
