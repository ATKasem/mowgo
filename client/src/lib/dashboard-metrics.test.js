import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, summarizeDashboard } from './dashboard-metrics.js';
import { hasTeamAccess } from './constants.js';
import { readFileSync } from 'node:fs';

test('team access is owner- and tier-aware', () => {
  assert.equal(hasTeamAccess({ role: 'owner', tier: 'free' }), false);
  assert.equal(hasTeamAccess({ role: 'owner', tier: 'solo' }), false);
  assert.equal(hasTeamAccess({ role: 'owner', tier: 'crew' }), true);
  assert.equal(hasTeamAccess({ role: 'owner', tier: 'premium' }), true);
  assert.equal(hasTeamAccess({ tier: 'premium' }), false);
  assert.equal(hasTeamAccess({ role: 'crew', tier: 'crew' }), false);
});

test('Dashboard renders team progress errors outside the progress visibility gate', () => {
  const source = readFileSync(new URL('../pages/Dashboard.jsx', import.meta.url), 'utf8');
  const errorIndex = source.indexOf("{hasTeamAccess(profile) && teamError && (");
  const progressIndex = source.indexOf("{hasTeamAccess(profile) && visibleTeamProgress.show && (");
  assert.notEqual(errorIndex, -1);
  assert.notEqual(progressIndex, -1);
  assert.ok(errorIndex < progressIndex);
});

test('summarizes real job and invoice values at local date boundaries', () => {
  const now = new Date(2026, 7, 9, 12);
  const jobs = [
    { client_id: 'a', scheduled_date: '2026-08-09', status: 'done', recurrence: 'weekly', clients: { rate: 45 } },
    { client_id: 'b', scheduled_date: '2026-08-09', status: 'in_progress', recurrence: 'none', clients: { rate: 80 } },
    { client_id: 'c', scheduled_date: '2026-08-03', status: 'done', recurrence: 'none', clients: { rate: 55 } },
    { client_id: 'd', scheduled_date: '2026-08-02', status: 'done', recurrence: 'weekly', clients: { rate: 100 } },
    { client_id: 'a', scheduled_date: '2026-08-16', status: 'scheduled', recurrence: 'weekly', clients: { rate: 45 } },
  ];
  const result = summarizeDashboard(jobs, [
    { status: 'sent', amount: 45 },
    { status: 'paid', amount: 55 },
    { status: 'overdue', amount: '20' },
  ], now);

  assert.equal(localDate(0, now), '2026-08-09');
  assert.deepEqual(result, {
    todayRevenue: 45, todayJobsTotal: 2, todayJobsDone: 1, todayJobsInProgress: 1,
    outstanding: 65, weeklyRevenue: 100, weeklyJobs: 3, weeklyJobsDone: 2,
    activeClients: 4, recurringClients: 1,
  });
});

test('returns zeroes for an empty assigned-work set', () => {
  const result = summarizeDashboard([], [], new Date(2026, 7, 9));
  assert.equal(result.todayJobsTotal, 0);
  assert.equal(result.weeklyJobs, 0);
  assert.equal(result.outstanding, 0);
});

test('localDate uses the local calendar day near UTC midnight', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(localDate(0, new Date('2026-08-10T00:30:00.000Z')), '2026-08-09');
  } finally {
    process.env.TZ = previousTimezone;
  }
});
