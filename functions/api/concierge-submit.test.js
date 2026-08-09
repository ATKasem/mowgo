import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from './concierge-submit.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

function csv(rowCount) {
  return ['name,address', ...Array.from({ length: rowCount }, (_, index) => `Client ${index + 1},${index + 1} Main St`)].join('\n');
}

test('rejects a missing authorization header before parsing oversized CSV input', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch'); };
  try {
    const request = new Request('https://mowgoapp.com/api/concierge-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ business_name: 'Test Lawn', client_count: 1, csv_content: csv(71) }),
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'Invalid token');
    assert.equal(fetchCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects a malformed authorization header before parsing CSV input', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch'); };
  try {
    const request = new Request('https://mowgoapp.com/api/concierge-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'token-without-bearer' },
      body: JSON.stringify({ business_name: 'Test Lawn', client_count: 1, csv_content: csv(71) }),
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 401);
    assert.equal(fetchCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects more than 70 parsed valid CSV rows after authentication and before queue writes', async () => {
  const originalFetch = globalThis.fetch;
  const fetchTargets = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    fetchTargets.push(target);
    if (target.includes('/auth/v1/user')) return Response.json({ id: '11111111-1111-4111-8111-111111111111' });
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/concierge-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      body: JSON.stringify({ business_name: 'Test Lawn', client_count: 1, csv_content: csv(71) }),
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /this file has 71/);
    assert.deepEqual(fetchTargets, ['https://example.supabase.co/auth/v1/user']);
  } finally { globalThis.fetch = originalFetch; }
});

test('persists the parsed valid row count instead of trusting client_count', async () => {
  const originalFetch = globalThis.fetch;
  let inserted;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/auth/v1/user')) return Response.json({ id: '11111111-1111-4111-8111-111111111111' });
    if (target.includes('/rpc/check_concierge_submit_rate_limit')) return Response.json(true);
    if (target.includes('/profiles?')) return Response.json([{ tier: 'solo', trial_ends_at: null }]);
    if (target.endsWith('/concierge_requests') && options.method === 'POST') {
      inserted = JSON.parse(options.body);
      return Response.json([{ id: '22222222-2222-4222-8222-222222222222', ...inserted }], { status: 201 });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/concierge-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token', 'cf-connecting-ip': '192.0.2.40' },
      body: JSON.stringify({ business_name: 'Test Lawn', client_count: 70, csv_content: csv(2) }),
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 201);
    assert.equal(inserted.client_count, 2);
    const responseBody = await response.json();
    assert.equal(responseBody.id, '22222222-2222-4222-8222-222222222222');
    assert.equal('csv_content' in responseBody, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('Discord alert uses the persisted parsed row count instead of client_count', async () => {
  const originalFetch = globalThis.fetch;
  let alert;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/auth/v1/user')) return Response.json({ id: '11111111-1111-4111-8111-111111111111' });
    if (target.includes('/rpc/check_concierge_submit_rate_limit')) return Response.json(true);
    if (target.includes('/profiles?')) return Response.json([{ tier: 'solo', trial_ends_at: null }]);
    if (target.endsWith('/concierge_requests')) return Response.json([{ id: '22222222-2222-4222-8222-222222222222' }], { status: 201 });
    if (target === 'https://discord.example/webhook') { alert = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/concierge-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token', 'cf-connecting-ip': '192.0.2.41' },
      body: JSON.stringify({ business_name: 'Test Lawn', client_count: 65, csv_content: csv(2) }),
    });
    const response = await onRequestPost({ request, env: { ...env, DISCORD_CONCIERGE_WEBHOOK_URL: 'https://discord.example/webhook' } });
    assert.equal(response.status, 201);
    assert.match(alert.content, /\*\*Clients:\*\* 2\n/);
    assert.doesNotMatch(alert.content, /\*\*Clients:\*\* 65\n/);
  } finally { globalThis.fetch = originalFetch; }
});
