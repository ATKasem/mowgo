const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function loadFunction(relativePath) {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

function request(body, token) {
  const headers = { origin: 'https://mowgo.app', 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('https://mowgo.app/api/stripe/checkout-subscription', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('web subscription checkout requires Supabase authentication', async () => {
  const { onRequestPost } = await loadFunction('functions/api/stripe/checkout-subscription.js');
  const response = await onRequestPost({
    request: request({ plan: 'solo' }),
    env: { STRIPE_SECRET_KEY: 'sk_test_123' },
  });
  assert.equal(response.status, 401);
});

test('web subscription checkout reuses the profile customer and sends identity metadata', async () => {
  const { onRequestPost } = await loadFunction('functions/api/stripe/checkout-subscription.js');
  const originalFetch = global.fetch;
  const stripeBodies = [];
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) {
      return Response.json({ id: 'user_1', email: 'owner@example.com' });
    }
    if (String(url).includes('/rest/v1/profiles')) {
      return Response.json([{ stripe_customer_id: 'cus_existing' }]);
    }
    if (String(url).endsWith('/v1/checkout/sessions')) {
      stripeBodies.push(new URLSearchParams(options.body));
      return Response.json({ url: 'https://checkout.stripe.test/session' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestPost({
      request: request({ plan: 'crew' }, 'jwt_1'),
      env: {
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_PRICE_CREW: 'price_crew',
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_KEY: 'service',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(stripeBodies[0].get('customer'), 'cus_existing');
    assert.equal(stripeBodies[0].get('metadata[user_id]'), 'user_1');
    assert.equal(stripeBodies[0].get('metadata[tier]'), 'crew');
    assert.equal(stripeBodies[0].get('subscription_data[metadata][user_id]'), 'user_1');
    assert.equal(stripeBodies[0].get('subscription_data[trial_period_days]'), '14');
  } finally {
    global.fetch = originalFetch;
  }
});

test('customer portal authenticates the user and creates a session for their saved customer', async () => {
  const { onRequestPost } = await loadFunction('functions/api/stripe/create-portal-session.js');
  const originalFetch = global.fetch;
  let portalBody;
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'user_1' });
    if (String(url).includes('/rest/v1/profiles')) {
      return Response.json([{ stripe_customer_id: 'cus_existing' }]);
    }
    if (String(url).endsWith('/v1/billing_portal/sessions')) {
      portalBody = new URLSearchParams(options.body);
      return Response.json({ url: 'https://billing.stripe.test/session' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestPost({
      request: request({}, 'jwt_1'),
      env: {
        STRIPE_SECRET_KEY: 'sk_test_123',
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_KEY: 'service',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(portalBody.get('customer'), 'cus_existing');
  } finally {
    global.fetch = originalFetch;
  }
});
