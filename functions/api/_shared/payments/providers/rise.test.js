import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { RiseProvider } from './rise.js';
import { ProviderNotImplementedError, ProviderRequestError } from '../errors.js';

const env = {
  RISE_API_BASE_URL: 'https://sandbox.example-rise.test/checkout/v3',
  RISE_API_KEY: 'key',
  RISE_API_SECRET: 'secret',
  RISE_PLATFORM_MERCHANT_ID: 'platform-1',
  RISE_WEBHOOK_SECRET: 'whsec',
  RISE_HOSTED_PAGE_HOSTS: 'pay.example-rise.test, Checkout.Example-Rise.test',
  RISE_PLAN_SOLO_MONTH: 'plan_solo_m',
  RISE_PLAN_CREW_YEAR: 'plan_crew_y',
};

function fakeFetch(respond) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return respond(url, init);
  };
  return { calls, impl };
}

describe('RiseProvider scaffold', () => {
  test('never ready until IMPLEMENTED is flipped, even with full credentials', () => {
    assert.equal(new RiseProvider(env).isReady(), false);
  });

  test('hosted-page host allowlist is exact and case-insensitive', () => {
    const rise = new RiseProvider(env);
    assert.equal(rise.isAllowedHostedPageHost('pay.example-rise.test'), true);
    assert.equal(rise.isAllowedHostedPageHost('checkout.example-rise.test'), true);
    assert.equal(rise.isAllowedHostedPageHost('evil.pay.example-rise.test'), false);
    assert.equal(rise.isAllowedHostedPageHost('example-rise.test'), false);
    assert.equal(new RiseProvider({}).isAllowedHostedPageHost('pay.example-rise.test'), false);
  });

  test('planId / planFor map both ways from env', () => {
    const rise = new RiseProvider(env);
    assert.equal(rise.planId('solo', 'month'), 'plan_solo_m');
    assert.deepEqual(rise.planFor('plan_crew_y'), { plan: 'crew', interval: 'year' });
    assert.equal(rise.planFor('plan_unknown'), null);
    assert.equal(rise.planFor(undefined), null);
    assert.throws(() => rise.planId('premium', 'month'), ProviderRequestError);
    assert.throws(() => rise.planId('gold', 'month'), ProviderRequestError);
  });

  test('unimplemented methods throw ProviderNotImplementedError; credit and webhook fail safe', async () => {
    const rise = new RiseProvider(env);
    for (const method of [
      'ensureCustomer', 'getActiveSubscription', 'createSubscriptionCheckout', 'createBillingPortal',
      'cancelSubscription', 'setExtraSeats', 'createMerchantOnboarding', 'createInvoicePayment',
    ]) {
      await assert.rejects(rise[method]({}), ProviderNotImplementedError, method);
    }
    assert.equal(await rise.applyAccountCredit({}), false);
    assert.equal(await rise.parseWebhook(new Request('https://x.test', { method: 'POST', body: '{}' })), null);
  });
});

describe('RiseProvider.request', () => {
  test('sends Basic auth, JSON body and query under the base path', async () => {
    const f = fakeFetch(() => new Response(JSON.stringify({ id: 'p1' }), { status: 200 }));
    const rise = new RiseProvider(env, f.impl);
    const data = await rise.request('POST', '/payment', { body: { amount: 1200 }, query: { echo: 'true' } });
    assert.deepEqual(data, { id: 'p1' });
    const { url, init } = f.calls[0];
    assert.equal(url, 'https://sandbox.example-rise.test/checkout/v3/payment?echo=true');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, `Basic ${btoa('key:secret')}`);
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(init.body, JSON.stringify({ amount: 1200 }));
    assert.ok(init.signal, 'request has a timeout signal');
  });

  test('GET without a body sends no Content-Type; empty response → null', async () => {
    const f = fakeFetch(() => new Response(null, { status: 204 }));
    const rise = new RiseProvider(env, f.impl);
    assert.equal(await rise.request('GET', 'contract/9'), null);
    assert.equal(f.calls[0].init.headers['Content-Type'], undefined);
    assert.equal(f.calls[0].url, 'https://sandbox.example-rise.test/checkout/v3/contract/9');
  });

  test('refuses non-https or invalid base URLs', async () => {
    const f = fakeFetch(() => new Response('{}'));
    await assert.rejects(new RiseProvider({ ...env, RISE_API_BASE_URL: 'http://x.test' }, f.impl).request('GET', 'a'), ProviderRequestError);
    await assert.rejects(new RiseProvider({ ...env, RISE_API_BASE_URL: '' }, f.impl).request('GET', 'a'), ProviderRequestError);
    assert.equal(f.calls.length, 0);
  });

  test('a path cannot escape to another host', async () => {
    const f = fakeFetch(() => new Response('{}'));
    const rise = new RiseProvider(env, f.impl);
    await assert.rejects(rise.request('GET', 'https://evil.example/steal'), ProviderRequestError);
    assert.equal(f.calls.length, 0);
    // Protocol-relative paths are stripped to a relative path under the base.
    await rise.request('GET', '//evil.example/steal');
    assert.equal(f.calls[0].url, 'https://sandbox.example-rise.test/checkout/v3/evil.example/steal');
  });

  test('errors do not leak response bodies', async () => {
    const f = fakeFetch(() => new Response('{"card":"4111111111111111"}', { status: 400 }));
    const rise = new RiseProvider(env, f.impl);
    await assert.rejects(rise.request('POST', 'payment', { body: {} }), (error) => {
      assert.ok(error instanceof ProviderRequestError);
      assert.match(error.message, /returned 400/);
      assert.doesNotMatch(error.message, /4111/);
      return true;
    });
  });

  test('network failures and non-JSON become ProviderRequestError', async () => {
    const down = new RiseProvider(env, async () => { throw new TypeError('fetch failed'); });
    await assert.rejects(down.request('GET', 'a'), ProviderRequestError);
    const html = new RiseProvider(env, async () => new Response('<html>', { status: 200 }));
    await assert.rejects(html.request('GET', 'a'), ProviderRequestError);
  });
});
