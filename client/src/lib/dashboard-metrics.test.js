import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDate, summarizeDashboard, todayCommand, upcomingJobs, moneyToCollect,
  unfinishedJobCount, rainRiskDay, rainAffectedJobs, weatherBannerView, attentionItems,
  estimatedRateReview,
} from './dashboard-metrics.js';
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

test('todayCommand returns zeroed empty state with no next job', () => {
  const now = new Date(2026, 7, 9, 12);
  const result = todayCommand([], now);
  assert.deepEqual(result, { total: 0, done: 0, inProgress: 0, revenue: 0, nextJob: null });
});

test('todayCommand orders the next job by route order and skips done jobs', () => {
  const now = new Date(2026, 7, 9, 12);
  const jobs = [
    { id: 'c', scheduled_date: '2026-08-09', status: 'done', route_order: 1, clients: { name: 'A', rate: 40 } },
    { id: 'a', scheduled_date: '2026-08-09', status: 'scheduled', route_order: 3, scheduled_time: '10:00', clients: { name: 'B', address: '1 Elm St' } },
    { id: 'b', scheduled_date: '2026-08-09', status: 'scheduled', route_order: 2, scheduled_time: '09:00', clients: { name: 'C', address: '2 Oak St' } },
  ];
  const result = todayCommand(jobs, now);
  assert.equal(result.total, 3);
  assert.equal(result.done, 1);
  assert.equal(result.revenue, 40);
  assert.deepEqual(result.nextJob, { id: 'b', clientName: 'C', address: '2 Oak St', time: '09:00', status: 'scheduled' });
});

test('upcomingJobs excludes today, done jobs, and orders by date then route order', () => {
  const now = new Date(2026, 7, 9, 12);
  const jobs = [
    { id: 'today', scheduled_date: '2026-08-09', status: 'scheduled', route_order: 1 },
    { id: 'done-later', scheduled_date: '2026-08-11', status: 'done', route_order: 1 },
    { id: 'later-2', scheduled_date: '2026-08-11', status: 'scheduled', route_order: 2, clients: { name: 'Z' } },
    { id: 'later-1', scheduled_date: '2026-08-11', status: 'scheduled', route_order: 1, clients: { name: 'Y' } },
    { id: 'soonest', scheduled_date: '2026-08-10', status: 'in_progress', route_order: 5, clients: { name: 'X' } },
  ];
  const result = upcomingJobs(jobs, now);
  assert.deepEqual(result.map(job => job.id), ['soonest', 'later-1', 'later-2']);
});

test('upcomingJobs respects the limit', () => {
  const now = new Date(2026, 7, 9, 12);
  const jobs = Array.from({ length: 8 }, (_, i) => ({ id: `j${i}`, scheduled_date: '2026-08-11', status: 'scheduled', route_order: i }));
  assert.equal(upcomingJobs(jobs, now, 3).length, 3);
});

test('moneyToCollect excludes paid and voided invoices, isolates overdue', () => {
  const invoices = [
    { status: 'unpaid', amount: 30 },
    { status: 'overdue', amount: '20.5' },
    { status: 'paid', amount: 100 },
    { status: 'voided', amount: 60 },
  ];
  assert.deepEqual(moneyToCollect(invoices), { unpaidTotal: 50.5, unpaidCount: 2, overdueTotal: 20.5, overdueCount: 1 });
});

test('moneyToCollect returns zeroes for an empty list', () => {
  assert.deepEqual(moneyToCollect([]), { unpaidTotal: 0, unpaidCount: 0, overdueTotal: 0, overdueCount: 0 });
});

test('unfinishedJobCount only counts past-due, not-done jobs', () => {
  const now = new Date(2026, 7, 9, 12);
  const jobs = [
    { scheduled_date: '2026-08-08', status: 'scheduled' },
    { scheduled_date: '2026-08-08', status: 'done' },
    { scheduled_date: '2026-08-09', status: 'scheduled' },
    { scheduled_date: '2026-08-10', status: 'scheduled' },
  ];
  assert.equal(unfinishedJobCount(jobs, now), 1);
});

test('rainRiskDay prefers today over tomorrow and requires the 60% threshold', () => {
  const now = new Date(2026, 7, 9, 12);
  assert.equal(rainRiskDay([{ date: '2026-08-09', rain: 59 }, { date: '2026-08-10', rain: 61 }], now).date, '2026-08-10');
  assert.equal(rainRiskDay([{ date: '2026-08-09', rain: 60 }, { date: '2026-08-10', rain: 90 }], now).date, '2026-08-09');
  assert.equal(rainRiskDay([{ date: '2026-08-09', rain: 10 }], now), null);
  assert.equal(rainRiskDay([], now), null);
});

test('rainAffectedJobs filters to a date and excludes done jobs', () => {
  const jobs = [
    { id: 'a', scheduled_date: '2026-08-10', status: 'scheduled' },
    { id: 'b', scheduled_date: '2026-08-10', status: 'done' },
    { id: 'c', scheduled_date: '2026-08-11', status: 'scheduled' },
  ];
  assert.deepEqual(rainAffectedJobs(jobs, '2026-08-10').map(j => j.id), ['a']);
  assert.deepEqual(rainAffectedJobs(jobs, null), []);
});

test('weatherBannerView distinguishes loading, no-location, unavailable, and loaded', () => {
  assert.equal(weatherBannerView(null, true, false), 'loading');
  assert.equal(weatherBannerView(true, true, false), 'loading');
  assert.equal(weatherBannerView(false, false, false), 'no_location');
  assert.equal(weatherBannerView(true, false, false), 'unavailable');
  assert.equal(weatherBannerView(true, false, true), 'loaded');
});

test('attentionItems orders rain, overdue invoices, new leads, unfinished work — and drops zero items', () => {
  assert.deepEqual(attentionItems({
    rainRisk: { date: '2026-08-09', rain: 70 },
    rainAffectedCount: 3,
    overdueInvoiceCount: 2,
    overdueInvoiceTotal: 150,
    newLeadCount: 1,
    estimatedRateReviewCount: 2,
    unfinishedJobCount: 4,
  }), [
    { type: 'rain', count: 3, rainPercent: 70, date: '2026-08-09' },
    { type: 'overdue_invoices', count: 2, amount: 150 },
    { type: 'new_leads', count: 1 },
    { type: 'estimated_rate_review', count: 2 },
    { type: 'unfinished_jobs', count: 4 },
  ]);
  assert.deepEqual(attentionItems(), []);
});

test('attentionItems suppresses the rain item when a risk day exists but no jobs are affected', () => {
  assert.deepEqual(attentionItems({ rainRisk: { date: '2026-08-09', rain: 70 }, rainAffectedCount: 0 }), []);
});

test('estimatedRateReview flags eligible clients below both comparison thresholds', () => {
  const clients = [
    { id: 'low', name: 'Low', rate: 30 },
    { id: 'mid', name: 'Mid', rate: 60 },
    { id: 'high', name: 'High', rate: 90 },
  ];
  const jobs = clients.flatMap(client => [
    { client_id: client.id, status: 'done', duration_minutes: 60 },
    { client_id: client.id, status: 'done', duration_minutes: 60 },
  ]);

  const result = estimatedRateReview(clients, jobs);

  assert.equal(result.eligibleAverage, 60);
  assert.equal(result.flagged.length, 1);
  assert.deepEqual(result.flagged[0], {
    client: clients[0],
    clientId: 'low',
    completedJobCount: 2,
    scheduledMinutes: 60,
    estimatedHourlyRate: 30,
    comparisonPercent: 50,
  });
});

test('estimatedRateReview requires two completed jobs with positive rate and durations', () => {
  const clients = [
    { id: 'one-job', rate: 5 },
    { id: 'scheduled', rate: 5 },
    { id: 'zero-rate', rate: 0 },
    { id: 'bad-duration', rate: 5 },
    { id: 'eligible', rate: 100 },
  ];
  const jobs = [
    { client_id: 'one-job', status: 'done', duration_minutes: 60 },
    { client_id: 'scheduled', status: 'scheduled', duration_minutes: 60 },
    { client_id: 'scheduled', status: 'scheduled', duration_minutes: 60 },
    { client_id: 'zero-rate', status: 'done', duration_minutes: 60 },
    { client_id: 'zero-rate', status: 'done', duration_minutes: 60 },
    { client_id: 'bad-duration', status: 'done', duration_minutes: 60 },
    { client_id: 'bad-duration', status: 'done', duration_minutes: 0 },
    { client_id: 'eligible', status: 'done', duration_minutes: 60 },
    { client_id: 'eligible', status: 'done', duration_minutes: 60 },
  ];

  const result = estimatedRateReview(clients, jobs);

  assert.equal(result.eligibleAverage, 100);
  assert.deepEqual(result.flagged, []);
});

test('estimatedRateReview excludes rates at either strict boundary and returns no false flags', () => {
  const clients = [
    { id: 'average-boundary', rate: 45 },
    { id: 'dollar-boundary', rate: 50 },
    { id: 'high', rate: 85 },
  ];
  const jobs = clients.flatMap(client => [
    { client_id: client.id, status: 'done', duration_minutes: 60 },
    { client_id: client.id, status: 'done', duration_minutes: 60 },
  ]);

  assert.deepEqual(estimatedRateReview(clients, jobs).flagged, []);
});

test('estimatedRateReview is null-safe and ignores malformed records', () => {
  assert.deepEqual(estimatedRateReview(null, undefined), { eligibleAverage: null, flagged: [] });
  assert.deepEqual(estimatedRateReview([
    null,
    { id: 'symbol-rate', rate: Symbol('rate') },
    { id: 'missing-rate' },
  ], [
    null,
    { client_id: 'symbol-rate', status: 'done', duration_minutes: Symbol('duration') },
    { client_id: 'symbol-rate', status: 'done', duration_minutes: 60 },
  ]), { eligibleAverage: null, flagged: [] });
});

test('dashboard helpers normalize null and non-array collections', () => {
  const now = new Date(2026, 7, 9, 12);
  assert.equal(summarizeDashboard(null, {}, now).todayJobsTotal, 0);
  assert.deepEqual(todayCommand('jobs', now), { total: 0, done: 0, inProgress: 0, revenue: 0, nextJob: null });
  assert.deepEqual(upcomingJobs(null, now), []);
  assert.deepEqual(moneyToCollect({}), { unpaidTotal: 0, unpaidCount: 0, overdueTotal: 0, overdueCount: 0 });
  assert.equal(unfinishedJobCount(null, now), 0);
  assert.equal(rainRiskDay({}, now), null);
  assert.deepEqual(rainAffectedJobs('jobs', '2026-08-09'), []);
});

test('dashboard helpers ignore malformed records and fields', () => {
  const now = new Date(2026, 7, 9, 12);
  const malformedJobs = [
    null, {},
    { scheduled_date: 12, status: 'scheduled' },
    { scheduled_date: 'bad-date', status: 'scheduled' },
    { scheduled_date: '2026-08-09', status: 'done', route_order: Symbol('route'), clients: { rate: Symbol('rate') } },
  ];
  const malformedInvoices = [
    null, {},
    { status: 'overdue', amount: 'not-money' },
    { status: 'overdue', amount: null },
    { status: 'overdue', amount: Symbol('amount') },
  ];

  assert.equal(summarizeDashboard(malformedJobs, malformedInvoices, now).outstanding, 0);
  assert.deepEqual(todayCommand(malformedJobs, now), { total: 1, done: 1, inProgress: 0, revenue: 0, nextJob: null });
  assert.deepEqual(upcomingJobs(malformedJobs, now), []);
  assert.deepEqual(moneyToCollect(malformedInvoices), { unpaidTotal: 0, unpaidCount: 0, overdueTotal: 0, overdueCount: 0 });
  assert.equal(unfinishedJobCount(malformedJobs, now), 0);
  assert.equal(rainRiskDay([null, {}, { date: '2026-08-09', rain: '80' }], now), null);
  assert.deepEqual(rainAffectedJobs(malformedJobs, '2026-08-09'), []);
  assert.deepEqual(attentionItems(null), []);
});

test('weather loaders request Fahrenheit and the current weather code', () => {
  const source = readFileSync(new URL('./data.js', import.meta.url), 'utf8');
  const forecastLoader = source.slice(source.indexOf('export async function getWeatherForLocation'), source.indexOf('export const SPRAY_RULE'));
  const conditionsLoader = source.slice(source.indexOf('export async function getDayConditions'), source.indexOf('// ===== Clients ====='));

  assert.match(forecastLoader, /temperature_unit:\s*'fahrenheit'/);
  assert.match(conditionsLoader, /current:\s*'temperature_2m,wind_speed_10m,weather_code'/);
  assert.match(conditionsLoader, /weatherCode/);
});
