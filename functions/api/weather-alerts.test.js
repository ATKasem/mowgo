import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet } from './weather-alerts.js';

test('endpoint rejects invalid coordinates without contacting NWS', async () => {
  let calls = 0;
  const response = await onRequestGet({
    request: new Request('https://mowgoapp.com/api/weather-alerts?latitude=91&longitude=-97'),
    env: { NWS_USER_AGENT: 'MowGo test contact' },
    data: { fetchImpl: async () => { calls += 1; } },
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), { error: 'Valid latitude and longitude are required.' });
});

test('endpoint fails closed when its identifying User-Agent is not configured', async () => {
  const response = await onRequestGet({
    request: new Request('https://mowgoapp.com/api/weather-alerts?latitude=35&longitude=-97'),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Weather alerts are unavailable.' });
});

test('endpoint returns a generic 502 when NWS fails', async () => {
  const response = await onRequestGet({
    request: new Request('https://mowgoapp.com/api/weather-alerts?latitude=35&longitude=-97'),
    env: { NWS_USER_AGENT: 'MowGo test contact' },
    data: { fetchImpl: async () => new Response('secret upstream detail', { status: 500 }) },
  });
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Weather alerts are unavailable.' });
});

test('endpoint permits short client caching only for successful alert data', async () => {
  const response = await onRequestGet({
    request: new Request('https://mowgoapp.com/api/weather-alerts?latitude=35&longitude=-97'),
    env: { NWS_USER_AGENT: 'MowGo test contact' },
    data: { fetchImpl: async () => Response.json({ type: 'FeatureCollection', features: [] }) },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60');
  assert.deepEqual(await response.json(), { alerts: [] });
});
