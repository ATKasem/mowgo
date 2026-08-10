import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchActiveNwsAlerts,
  normalizeNwsAlert,
  parseCoordinates,
} from './nws-alerts.js';

test('parseCoordinates accepts finite coordinates at geographic boundaries', () => {
  assert.deepEqual(parseCoordinates('90', '-180'), { latitude: 90, longitude: -180 });
  assert.deepEqual(parseCoordinates('-90', '180'), { latitude: -90, longitude: 180 });
});

test('parseCoordinates rejects missing, non-finite, and out-of-range values', () => {
  for (const values of [
    [null, '-97'], ['', '-97'], ['   ', '-97'], ['NaN', '-97'], ['Infinity', '-97'],
    ['90.0001', '-97'], ['35', '-180.0001'], ['35', '180.0001'],
  ]) {
    assert.equal(parseCoordinates(...values), null, values.join(','));
  }
});

test('normalizeNwsAlert returns only the notification fields and official URL', () => {
  const alert = normalizeNwsAlert({
    id: 'https://api.weather.gov/alerts/urn:oid:example',
    properties: {
      event: 'Tornado Warning',
      headline: 'Tornado Warning issued August 10 at 1:00PM CDT',
      severity: 'Extreme',
      urgency: 'Immediate',
      certainty: 'Observed',
      onset: '2026-08-10T18:00:00+00:00',
      effective: '2026-08-10T17:58:00+00:00',
      expires: '2026-08-10T18:45:00+00:00',
      ends: '2026-08-10T18:45:00+00:00',
      areaDesc: 'Oklahoma County, OK',
      instruction: 'Move to an interior room on the lowest floor.',
      web: 'https://www.weather.gov/oun/',
      description: 'Not exposed by this endpoint.',
    },
  });

  assert.deepEqual(alert, {
    source: 'National Weather Service',
    title: 'Tornado Warning issued August 10 at 1:00PM CDT',
    severity: 'Extreme',
    urgency: 'Immediate',
    certainty: 'Observed',
    onset: '2026-08-10T18:00:00+00:00',
    expires: '2026-08-10T18:45:00+00:00',
    area: 'Oklahoma County, OK',
    instruction: 'Move to an interior room on the lowest floor.',
    url: 'https://www.weather.gov/oun/',
  });
});

test('normalizeNwsAlert upgrades the official HTTP weather.gov link and rejects other hosts', () => {
  const base = { properties: { event: 'Wind Advisory' } };
  assert.equal(normalizeNwsAlert({
    ...base,
    id: 'https://attacker.example/alert',
    properties: { ...base.properties, web: 'http://www.weather.gov' },
  }).url, 'https://www.weather.gov/');
  assert.equal(normalizeNwsAlert({
    ...base,
    id: 'https://attacker.example/alert',
    properties: { ...base.properties, web: 'https://weather.gov.attacker.example' },
  }).url, null);
});

test('fetchActiveNwsAlerts uses the alerts endpoint, identifying headers, and normalizes data', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url: String(url), options };
    return Response.json({
      type: 'FeatureCollection',
      features: [{
        id: 'https://api.weather.gov/alerts/example',
        properties: {
          event: 'Flood Watch', severity: 'Severe', urgency: 'Future', certainty: 'Possible',
          effective: '2026-08-10T20:00:00Z', ends: '2026-08-11T02:00:00Z',
          areaDesc: 'Cleveland County', instruction: null,
        },
      }],
    });
  };

  const alerts = await fetchActiveNwsAlerts({
    latitude: 35.4676,
    longitude: -97.5164,
    userAgent: 'MowGo Weather (https://mowgoapp.com/contact)',
    fetchImpl,
  });

  assert.equal(request.url, 'https://api.weather.gov/alerts/active?point=35.4676%2C-97.5164');
  assert.equal(request.options.headers['User-Agent'], 'MowGo Weather (https://mowgoapp.com/contact)');
  assert.equal(request.options.headers.Accept, 'application/geo+json');
  assert.equal(request.options.signal instanceof AbortSignal, true);
  assert.equal(alerts[0].title, 'Flood Watch');
  assert.equal(alerts[0].onset, '2026-08-10T20:00:00Z');
  assert.equal(alerts[0].expires, '2026-08-11T02:00:00Z');
});

test('fetchActiveNwsAlerts fails closed on timeout, HTTP errors, and malformed data', async () => {
  await assert.rejects(
    fetchActiveNwsAlerts({
      latitude: 35, longitude: -97, userAgent: 'MowGo test contact', timeoutMs: 5,
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
    }),
    /timed out/i,
  );

  await assert.rejects(fetchActiveNwsAlerts({
    latitude: 35, longitude: -97, userAgent: 'MowGo test contact',
    fetchImpl: async () => new Response('upstream detail', { status: 503 }),
  }), /unavailable/i);

  await assert.rejects(fetchActiveNwsAlerts({
    latitude: 35, longitude: -97, userAgent: 'MowGo test contact',
    fetchImpl: async () => Response.json({ features: 'not-an-array' }),
  }), /invalid response/i);
});

test('fetchActiveNwsAlerts caches successful results by normalized point', async () => {
  const entries = new Map();
  const cache = {
    async match(key) { return entries.get(String(key))?.clone(); },
    async put(key, response) { entries.set(String(key), response.clone()); },
  };
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ type: 'FeatureCollection', features: [] });
  };
  const input = {
    latitude: 35.4676000, longitude: -97.5164000,
    userAgent: 'MowGo test contact', fetchImpl, cache,
  };

  assert.deepEqual(await fetchActiveNwsAlerts(input), []);
  assert.deepEqual(await fetchActiveNwsAlerts(input), []);
  assert.equal(calls, 1);
  const cached = [...entries.values()][0];
  assert.equal(cached.headers.get('Cache-Control'), 'public, max-age=120');
});

test('fetchActiveNwsAlerts does not cache upstream failures', async () => {
  let puts = 0;
  const cache = { match: async () => undefined, put: async () => { puts += 1; } };
  await assert.rejects(fetchActiveNwsAlerts({
    latitude: 35, longitude: -97, userAgent: 'MowGo test contact', cache,
    fetchImpl: async () => new Response('nope', { status: 500 }),
  }));
  assert.equal(puts, 0);
});
