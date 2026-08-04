const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const WEBHOOK_SECRET = 'whsec_test_secret';

async function loadWebhook() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'functions/api/stripe/webhook.js'),
    'utf8',
  );
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

function signedRequest(event, secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(event);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  return new Request('https://mowgo.app/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    },
    body,
  });
}

function webhookEnv() {
  return {
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_SECRET_KEY: 'sk_test_123',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_KEY: 'service_key',
    STRIPE_PRICE_SOLO: 'price_solo',
    STRIPE_PRICE_CREW: 'price_crew',
    STRIPE_PRICE_SOLO_ANNUAL: 'price_solo_annual',
    STRIPE_PRICE_CREW_ANNUAL: 'price_crew_annual',
  };
}

test('invalid signatures return 200 without making external requests', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    throw new Error('fetch should not be called');
  };

  try {
    const response = await onRequestPost({
      request: signedRequest({ type: 'customer.subscription.deleted' }, 'wrong_secret'),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    assert.equal(fetchCount, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('signed webhook requests older than five minutes are ignored', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    throw new Error('fetch should not be called');
  };

  try {
    const response = await onRequestPost({
      request: signedRequest(
        {
          type: 'customer.subscription.deleted',
          data: { object: { customer: 'cus_stale', metadata: { user_id: 'user_stale' } } },
        },
        WEBHOOK_SECRET,
        Math.floor(Date.now() / 1000) - 301,
      ),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    assert.equal(fetchCount, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('checkout completion resolves metadata user and stores the customer and price tier', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/v1/subscriptions/sub_1')) {
      return Response.json({
        id: 'sub_1',
        customer: 'cus_1',
        items: { data: [{ price: { id: 'price_crew' } }] },
      });
    }
    if (String(url).includes('/rest/v1/profiles?id=eq.user_1')) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestPost({
      request: signedRequest({
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            customer: 'cus_1',
            subscription: 'sub_1',
            metadata: { user_id: 'user_1' },
          },
        },
      }),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    const patch = requests.find(({ options }) => options.method === 'PATCH');
    assert.ok(patch);
    assert.deepEqual(JSON.parse(patch.options.body), {
      tier: 'crew',
      stripe_customer_id: 'cus_1',
    });
    assert.equal(patch.options.headers.apikey, 'service_key');
  } finally {
    global.fetch = originalFetch;
  }
});

test('subscription updates fall back to customer lookup and map the solo price', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('/rest/v1/profiles?stripe_customer_id=eq.cus_2')) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestPost({
      request: signedRequest({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_2',
            metadata: {},
            items: { data: [{ price: { id: 'price_solo' } }] },
          },
        },
      }),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    assert.match(requests[0].url, /stripe_customer_id=eq\.cus_2/);
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      tier: 'solo',
      stripe_customer_id: 'cus_2',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('annual checkout completion maps the annual crew price to the crew tier', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/v1/subscriptions/sub_annual_crew')) {
      return Response.json({
        id: 'sub_annual_crew',
        customer: 'cus_annual_crew',
        items: { data: [{ price: { id: 'price_crew_annual' } }] },
      });
    }
    if (String(url).includes('/rest/v1/profiles?id=eq.user_annual_crew')) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestPost({
      request: signedRequest({
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            customer: 'cus_annual_crew',
            subscription: 'sub_annual_crew',
            metadata: { user_id: 'user_annual_crew' },
          },
        },
      }),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    const patch = requests.find(({ options }) => options.method === 'PATCH');
    assert.ok(patch);
    assert.deepEqual(JSON.parse(patch.options.body), {
      tier: 'crew',
      stripe_customer_id: 'cus_annual_crew',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('annual subscription updates map the annual solo price to the solo tier', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('/rest/v1/profiles?stripe_customer_id=eq.cus_annual_solo')) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestPost({
      request: signedRequest({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_annual_solo',
            metadata: {},
            items: { data: [{ price: { id: 'price_solo_annual' } }] },
          },
        },
      }),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      tier: 'solo',
      stripe_customer_id: 'cus_annual_solo',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('subscription updates retry by customer when metadata user matches no profile', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(String(url));
    if (urls.length === 1) return Response.json([]);
    return Response.json([{ id: 'actual_user' }]);
  };

  try {
    const response = await onRequestPost({
      request: signedRequest({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_actual',
            metadata: { user_id: 'stale_user' },
            items: { data: [{ price: { id: 'price_crew' } }] },
          },
        },
      }),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    assert.equal(urls.length, 2);
    assert.match(urls[0], /profiles\?id=eq\.stale_user/);
    assert.match(urls[1], /profiles\?stripe_customer_id=eq\.cus_actual/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('subscription deletion sets the metadata user profile back to free', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  let patch;
  global.fetch = async (url, options = {}) => {
    patch = { url: String(url), options };
    return new Response(null, { status: 204 });
  };

  try {
    const response = await onRequestPost({
      request: signedRequest({
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_3',
            metadata: { user_id: 'user_3' },
          },
        },
      }),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    assert.match(patch.url, /profiles\?id=eq\.user_3/);
    assert.deepEqual(JSON.parse(patch.options.body), {
      tier: 'free',
      stripe_customer_id: 'cus_3',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('unhandled events return 200 without making external requests', async () => {
  const { onRequestPost } = await loadWebhook();
  const originalFetch = global.fetch;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
  };

  try {
    const response = await onRequestPost({
      request: signedRequest({ type: 'invoice.paid', data: { object: {} } }),
      env: webhookEnv(),
    });

    assert.equal(response.status, 200);
    assert.equal(fetchCount, 0);
  } finally {
    global.fetch = originalFetch;
  }
});
