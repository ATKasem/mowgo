const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function loadFunction() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'functions/api/stripe/verify-session.js'),
    'utf8',
  );
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

function request(token) {
  const headers = { origin: 'https://mowgo.app' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('https://mowgo.app/api/stripe/verify-session?session_id=cs_test_1', {
    headers,
  });
}

function env() {
  return {
    STRIPE_SECRET_KEY: 'sk_test_123',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
  };
}

test('session verification requires Supabase authentication', async () => {
  const { onRequestGet } = await loadFunction();
  const response = await onRequestGet({ request: request(), env: env() });
  assert.equal(response.status, 401);
});

test('session verification rejects a Stripe session owned by another user', async () => {
  const { onRequestGet } = await loadFunction();
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'user_1' });
    if (String(url).includes('/v1/checkout/sessions/')) {
      return Response.json({
        status: 'complete',
        metadata: { user_id: 'user_2' },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestGet({ request: request('jwt_1'), env: env() });
    assert.equal(response.status, 403);
  } finally {
    global.fetch = originalFetch;
  }
});

test('session verification returns a session owned by the authenticated user', async () => {
  const { onRequestGet } = await loadFunction();
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'user_1' });
    if (String(url).includes('/v1/checkout/sessions/')) {
      return Response.json({
        status: 'complete',
        payment_status: 'paid',
        customer_details: { email: 'owner@example.com' },
        subscription: 'sub_1',
        metadata: { user_id: 'user_1' },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestGet({ request: request('jwt_1'), env: env() });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).subscription, 'sub_1');
  } finally {
    global.fetch = originalFetch;
  }
});
