import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyRpcErrorStatus, onRequestGet, onRequestPost } from './concierge.js';

const env = {
  CONCIERGE_ADMIN_CODE: 'correct horse battery staple',
  CONCIERGE_ADMIN_USER_IDS: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

test('admin list rejects an unauthorized request before touching Supabase', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch'); };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge?action=list', {
      headers: { 'cf-connecting-ip': '192.0.2.10', 'x-admin-code': 'wrong' },
    });
    const response = await onRequestGet({ request, env });
    assert.equal(response.status, 401);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('done action is idempotent only after review and requires a completed checklist', async () => {
  const originalFetch = globalThis.fetch;
  const rpcCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) {
      return Response.json([{
        id: '11111111-1111-4111-8111-111111111111',
        user_id: '22222222-2222-4222-8222-222222222222',
        status: 'review',
        operator_checklist: { clients_verified: true, first_week_verified: true, customer_ready: true },
      }]);
    }
    if (String(url).includes('/rpc/concierge_complete_review') && options.method === 'POST') {
      rpcCalls.push(JSON.parse(options.body));
      return Response.json({ status: 'done', done_at: new Date().toISOString() });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': '192.0.2.11', 'x-admin-code': env.CONCIERGE_ADMIN_CODE },
      body: JSON.stringify({ action: 'done', request_id: '11111111-1111-4111-8111-111111111111' }),
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0].p_operator_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('done action rejects bypassing human review without writing', async () => {
  const originalFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) {
      return Response.json([{ id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', status: 'importing', operator_checklist: {} }]);
    }
    writes += 1;
    return Response.json([]);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': '192.0.2.12', 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'done', request_id: '11111111-1111-4111-8111-111111111111' }) });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 409);
    assert.equal(writes, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('repeated import returns the recorded result without creating duplicate clients', async () => {
  const originalFetch = globalThis.fetch;
  let clientWrites = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) {
      return Response.json([{ id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', status: 'importing', imported_client_ids: ['33333333-3333-4333-8333-333333333333'] }]);
    }
    if (String(url).includes('/clients') && options.method === 'POST') clientWrites += 1;
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': '192.0.2.13', 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'import', request_id: '11111111-1111-4111-8111-111111111111' }) });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).already_complete, true);
    assert.equal(clientWrites, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('import rejects an inactive request before profile lookup or CSV processing', async () => {
  const originalFetch = globalThis.fetch;
  const fetchedUrls = [];
  globalThis.fetch = async (url, options = {}) => {
    fetchedUrls.push(String(url));
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) {
      return Response.json([{ id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', status: 'review', csv_content: null }]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': '192.0.2.15', 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'import', request_id: '11111111-1111-4111-8111-111111111111' }) });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'Request cannot be imported from its current state');
    assert.equal(fetchedUrls.some(url => url.includes('/profiles?')), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('maps a database state error to 409 with the operator-visible message', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) return Response.json([{ id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', status: 'importing' }]);
    if (String(url).includes('/rpc/concierge_schedule_first_week')) return Response.json({ code: '22023', message: 'request must be importing' }, { status: 400 });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': '192.0.2.14', 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'schedule', request_id: '11111111-1111-4111-8111-111111111111' }) });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'request must be importing');
  } finally { globalThis.fetch = originalFetch; }
});

test('classifies every RPC state precondition as a conflict', () => {
  for (const message of [
    'completed human review is required',
    'not enough first-week schedule slots',
    'existing schedule verification is required',
  ]) assert.equal(classifyRpcErrorStatus('22023', message), 409, message);

  assert.equal(classifyRpcErrorStatus('22023', 'client list must contain 1 to 70 rows'), 400);
});

test('skip requires non-blank operator notes and does not write when validation fails', async () => {
  const originalFetch = globalThis.fetch;
  let rpcCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) return Response.json([{ id: '11111111-1111-4111-8111-111111111111', status: 'pending' }]);
    if (String(url).includes('/rpc/')) rpcCalls += 1;
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    for (const notes of ['   ', 'x'.repeat(4001)]) {
      const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': `192.0.2.${notes.length}`, 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'skip', request_id: '11111111-1111-4111-8111-111111111111', notes }) });
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 400);
    }
    assert.equal(rpcCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('skip trims notes, records the authenticated operator, and returns the RPC request', async () => {
  const originalFetch = globalThis.fetch;
  let rpcBody;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) return Response.json([{ id: '11111111-1111-4111-8111-111111111111', status: 'importing' }]);
    if (String(url).includes('/rpc/concierge_skip_request')) {
      rpcBody = JSON.parse(options.body);
      return Response.json({ id: '11111111-1111-4111-8111-111111111111', status: 'skipped', skip_notes: 'customer asked to stop' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': '192.0.2.21', 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'skip', request_id: '11111111-1111-4111-8111-111111111111', notes: '  customer asked to stop  ' }) });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.deepEqual(rpcBody, { p_request_id: '11111111-1111-4111-8111-111111111111', p_notes: 'customer asked to stop', p_operator_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    assert.equal((await response.json()).request.status, 'skipped');
  } finally { globalThis.fetch = originalFetch; }
});

test('skip requires schedule undo when jobs or a schedule timestamp remain', async () => {
  const originalFetch = globalThis.fetch;
  let item;
  let rpcCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) return Response.json([item]);
    if (String(url).includes('/rpc/')) rpcCalls += 1;
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    for (const scheduleState of [
      { scheduled_job_ids: ['33333333-3333-4333-8333-333333333333'], scheduled_at: null },
      { scheduled_job_ids: [], scheduled_at: '2026-08-09T12:00:00.000Z' },
    ]) {
      item = { id: '11111111-1111-4111-8111-111111111111', status: 'importing', ...scheduleState };
      const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': `192.0.2.${scheduleState.scheduled_at ? 24 : 23}`, 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'skip', request_id: item.id, notes: 'customer asked to stop' }) });
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error, 'Undo the first-week schedule before closing this request');
    }
    assert.equal(rpcCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('review request can undo its schedule before being skipped', async () => {
  const originalFetch = globalThis.fetch;
  let rpcBody;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) return Response.json([{
      id: '11111111-1111-4111-8111-111111111111',
      status: 'review',
      scheduled_at: '2026-08-09T12:00:00.000Z',
      scheduled_job_ids: ['33333333-3333-4333-8333-333333333333'],
    }]);
    if (String(url).includes('/rpc/concierge_undo_first_week')) {
      rpcBody = JSON.parse(options.body);
      return Response.json({ deleted: 1, retained_changed: 0, success: true });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': '192.0.2.25', 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'undo_schedule', request_id: '11111111-1111-4111-8111-111111111111' }) });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.deepEqual(rpcBody, { p_request_id: '11111111-1111-4111-8111-111111111111', p_operator_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  } finally { globalThis.fetch = originalFetch; }
});

test('repeated skip is idempotent and does not call the RPC again', async () => {
  const originalFetch = globalThis.fetch;
  let rpcCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(url).includes('/concierge_requests?') && !options.method) return Response.json([{ id: '11111111-1111-4111-8111-111111111111', status: 'skipped', skip_notes: 'original reason' }]);
    if (String(url).includes('/rpc/')) rpcCalls += 1;
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const request = new Request('https://mowgoapp.com/api/admin/concierge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer operator-token', 'cf-connecting-ip': '192.0.2.22', 'x-admin-code': env.CONCIERGE_ADMIN_CODE }, body: JSON.stringify({ action: 'skip', request_id: '11111111-1111-4111-8111-111111111111', notes: 'different reason' }) });
    const response = await onRequestPost({ request, env });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.already_complete, true);
    assert.equal(result.request.skip_notes, 'original reason');
    assert.equal(rpcCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
