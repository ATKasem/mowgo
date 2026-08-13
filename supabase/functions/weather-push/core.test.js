import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEventKey,
  decideWeatherAlert,
  parseNwsPayload,
  parseOpenMeteoTomorrow,
  runWeatherPush,
} from './core.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';

test('parseOpenMeteoTomorrow derives tomorrow from the provider local daily dates', () => {
  const result = parseOpenMeteoTomorrow({
    daily: {
      time: ['2026-08-13', '2026-08-14'],
      precipitation_probability_max: [10, 72],
    },
  });
  assert.deepEqual(result, { date: '2026-08-14', rainProbability: 72 });
  assert.equal(parseOpenMeteoTomorrow({ daily: { time: [], precipitation_probability_max: [] } }), null);
});

test('parseNwsPayload keeps active official alerts and rejects malformed data', () => {
  const alerts = parseNwsPayload({ features: [
    { id: 'https://api.weather.gov/alerts/a', properties: { event: 'Flood Watch', severity: 'Severe', status: 'Actual' } },
    { id: 'test', properties: { event: 'Test Message', status: 'Test' } },
    { properties: {} },
  ] });
  assert.deepEqual(alerts, [{ id: 'https://api.weather.gov/alerts/a', event: 'Flood Watch', severity: 'Severe' }]);
  assert.equal(parseNwsPayload(null), null);
});

test('decideWeatherAlert alerts for rain threshold or NWS alert and stays suggestion-only', () => {
  assert.deepEqual(decideWeatherAlert({ date: '2026-08-13', rainProbability: 65, nwsAlerts: [], jobCount: 3 }), {
    title: 'MowGo weather heads-up',
    body: '65% rain chance tomorrow may affect 3 jobs. Review tomorrow\'s route in MowGo.',
    reasons: ['rain'],
  });
  const nws = decideWeatherAlert({ date: '2026-08-13', rainProbability: 20, nwsAlerts: [{ id: 'a', event: 'Severe Thunderstorm Warning', severity: 'Severe' }], jobCount: 1 });
  assert.match(nws.body, /Review tomorrow's route/);
  assert.doesNotMatch(nws.body, /rescheduled|moved/i);
  assert.equal(decideWeatherAlert({ date: '2026-08-13', rainProbability: 59, nwsAlerts: [], jobCount: 2 }), null);
  assert.equal(decideWeatherAlert({ date: '2026-08-13', rainProbability: 90, nwsAlerts: [], jobCount: 0 }), null);
});

test('buildEventKey is stable for one owner, local forecast date, and notification kind', async () => {
  const input = { ownerId: OWNER_ID, date: '2026-08-13', reasons: ['rain', 'nws'], nwsAlertIds: ['b', 'a'] };
  const first = await buildEventKey(input);
  const second = await buildEventKey({ ...input, reasons: ['nws', 'rain'], nwsAlertIds: ['a', 'b'] });
  assert.equal(first, second);
  assert.equal(first, `weather:alert:${OWNER_ID}:2026-08-13`);
  assert.ok(first.length <= 128);
  assert.equal(first, await buildEventKey({ ...input, reasons: ['nws'], nwsAlertIds: ['changed'] }));
  assert.notEqual(first, await buildEventKey({ ...input, date: '2026-08-14' }));
});

test('runWeatherPush fails closed on bad cron auth', async () => {
  const response = await runWeatherPush(new Request('https://example.test', { method: 'POST' }), {
    cronSecret: 'correct',
  });
  assert.equal(response.status, 401);
});

test('runWeatherPush sends once and deduplicates a repeated cron run', async () => {
  const reserved = new Set();
  const pushes = [];
  const deps = {
    cronSecret: 'correct',
    now: () => new Date('2026-08-12T12:00:00Z'),
    listOwnersWithTomorrowJobs: async dates => [{ id: OWNER_ID, latitude: 35.4, longitude: -97.5, jobDates: dates.includes('2026-08-14') ? ['2026-08-14', '2026-08-14'] : [] }],
    fetchWeather: async () => ({ date: '2026-08-14', rainProbability: 70, nwsAlerts: [] }),
    reserveEvent: async event => reserved.has(event.eventKey) ? null : (reserved.add(event.eventKey), 'lease-1'),
    releaseEvent: async (eventKey) => reserved.delete(eventKey),
    markSent: async () => {},
    sendPush: async message => { pushes.push(message); return true; },
  };
  const request = () => new Request('https://example.test', { method: 'POST', headers: { 'x-mowgo-cron-secret': 'correct' } });
  const first = await runWeatherPush(request(), deps);
  const second = await runWeatherPush(request(), deps);
  assert.deepEqual(await first.json(), { processed: 1, sent: 1, duplicate: 0, failed: 0 });
  assert.deepEqual(await second.json(), { processed: 1, sent: 0, duplicate: 1, failed: 0 });
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].userId, OWNER_ID);
});

test('runWeatherPush uses local tomorrow at a timezone boundary for jobs and event metadata', async () => {
  let candidateDates;
  let reservedEvent;
  const deps = {
    cronSecret: 'correct',
    now: () => new Date('2026-08-12T23:30:00Z'),
    listOwnersWithTomorrowJobs: async dates => {
      candidateDates = dates;
      return [{ id: OWNER_ID, latitude: 21.3, longitude: -157.8, jobDates: ['2026-08-13'] }];
    },
    fetchWeather: async () => ({ date: '2026-08-13', rainProbability: 80, nwsAlerts: [] }),
    reserveEvent: async event => { reservedEvent = event; return 'lease-boundary'; },
    releaseEvent: async () => {},
    markSent: async () => {},
    sendPush: async () => true,
  };
  const request = new Request('https://example.test', { method: 'POST', headers: { 'x-mowgo-cron-secret': 'correct' } });
  assert.deepEqual(await (await runWeatherPush(request, deps)).json(), { processed: 1, sent: 1, duplicate: 0, failed: 0 });
  assert.deepEqual(candidateDates, ['2026-08-12', '2026-08-13', '2026-08-14']);
  assert.equal(reservedEvent.forecastDate, '2026-08-13');
  assert.equal(reservedEvent.eventKey, `weather:alert:${OWNER_ID}:2026-08-13`);
});

test('runWeatherPush does not notify when the owner has no job on local tomorrow', async () => {
  let reserved = false;
  const deps = {
    cronSecret: 'correct',
    now: () => new Date('2026-08-12T23:30:00Z'),
    listOwnersWithTomorrowJobs: async () => [{ id: OWNER_ID, latitude: 1, longitude: 1, jobDates: ['2026-08-14'] }],
    fetchWeather: async () => ({ date: '2026-08-13', rainProbability: 90, nwsAlerts: [] }),
    reserveEvent: async () => { reserved = true; return 'lease'; },
    sendPush: async () => true,
  };
  const request = new Request('https://example.test', { method: 'POST', headers: { 'x-mowgo-cron-secret': 'correct' } });
  assert.deepEqual(await (await runWeatherPush(request, deps)).json(), { processed: 1, sent: 0, duplicate: 0, failed: 0 });
  assert.equal(reserved, false);
});

test('runWeatherPush releases a failed reservation so the next cron can retry', async () => {
  const reserved = new Set();
  let attempts = 0;
  const deps = {
    cronSecret: 'correct',
    now: () => new Date('2026-08-12T12:00:00Z'),
    listOwnersWithTomorrowJobs: async () => [{ id: OWNER_ID, latitude: 35.4, longitude: -97.5, jobDates: ['2026-08-13'] }],
    fetchWeather: async () => ({ date: '2026-08-13', rainProbability: 80, nwsAlerts: [] }),
    reserveEvent: async event => reserved.has(event.eventKey) ? null : (reserved.add(event.eventKey), `lease-${attempts + 1}`),
    releaseEvent: async eventKey => reserved.delete(eventKey),
    markSent: async () => {},
    sendPush: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('push unavailable');
      return true;
    },
  };
  const request = () => new Request('https://example.test', { method: 'POST', headers: { 'x-mowgo-cron-secret': 'correct' } });
  assert.deepEqual(await (await runWeatherPush(request(), deps)).json(), { processed: 1, sent: 0, duplicate: 0, failed: 1 });
  assert.deepEqual(await (await runWeatherPush(request(), deps)).json(), { processed: 1, sent: 1, duplicate: 0, failed: 0 });
});
