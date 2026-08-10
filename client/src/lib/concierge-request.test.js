import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conciergeRequestRpcState, dashboardConciergeView } from './concierge-request.js';

test('failed concierge status lookup fails open without inventing a request status', () => {
  assert.deepEqual(
    conciergeRequestRpcState({ data: [{ id: 'stale', status: 'pending' }], error: new Error('offline') }),
    { request: null, loadFailed: true },
  );

  assert.equal(dashboardConciergeView({
    demoMode: false,
    profile: { role: 'owner', tier: 'premium' },
    request: null,
    dismissed: false,
  }), 'prompt');

  const source = readFileSync(new URL('../pages/Dashboard.jsx', import.meta.url), 'utf8');
  assert.match(source, /requestLoadFailed && \([\s\S]*?role="alert"/);
  assert.match(source, /setRequest\(null\);[\s\S]*?setRequestLoadFailed\(true\)/);
  const failedPrompt = source.slice(source.indexOf('{requestLoadFailed && ('), source.indexOf('<Link to="/app/settings"', source.indexOf('{requestLoadFailed && (')));
  assert.doesNotMatch(failedPrompt, /ConciergeStatus/);
});

test('successful concierge status lookup preserves the single server status', () => {
  const request = { id: 'request-1', status: 'pending' };
  assert.deepEqual(
    conciergeRequestRpcState({ data: [request], error: null }),
    { request, loadFailed: false },
  );
  assert.equal(dashboardConciergeView({
    demoMode: false,
    profile: { role: 'owner', tier: 'solo' },
    request,
    dismissed: false,
  }), 'status');
});

test('concierge view keeps existing eligibility, loading, and dismissal gates', () => {
  const paidOwner = { role: 'owner', tier: 'crew' };
  assert.equal(dashboardConciergeView({ demoMode: false, profile: paidOwner, request: undefined, dismissed: false }), 'loading');
  assert.equal(dashboardConciergeView({ demoMode: false, profile: paidOwner, request: null, dismissed: true }), 'hidden');
  assert.equal(dashboardConciergeView({ demoMode: false, profile: { role: 'crew', tier: 'crew' }, request: null, dismissed: false }), 'hidden');
  assert.equal(dashboardConciergeView({ demoMode: false, profile: { role: 'owner', tier: 'free' }, request: null, dismissed: false }), 'hidden');
  assert.equal(dashboardConciergeView({ demoMode: true, profile: paidOwner, request: null, dismissed: false }), 'hidden');
});
