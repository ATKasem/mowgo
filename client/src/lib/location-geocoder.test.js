import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLocationGeocoder, LocationGeocodeCanceledError, LocationGeocodeError, persistProfileWithResolvedLocation } from './location-geocoder.js';

function deferredResponse() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return {
    promise,
    respond(result) {
      release({ ok: true, json: async () => ({ results: [result] }) });
    },
  };
}

test('Enter-style profile submission waits for geocoding before it persists', async () => {
  const request = deferredResponse();
  const geocoder = createLocationGeocoder(() => request.promise);
  const persisted = [];
  const saving = persistProfileWithResolvedLocation(
    { business_name: 'MowGo' },
    'Oklahoma City, OK',
    geocoder,
    async profile => persisted.push(profile),
  );

  await Promise.resolve();
  assert.equal(persisted.length, 0);
  request.respond({ name: 'Oklahoma City', latitude: 35.4676, longitude: -97.5164 });
  await saving;
  assert.deepEqual(persisted, [{ business_name: 'MowGo', latitude: 35.4676, longitude: -97.5164 }]);
});

test('a changed query cannot persist coordinates from an older request', async () => {
  const requests = [deferredResponse(), deferredResponse()];
  let requestIndex = 0;
  const geocoder = createLocationGeocoder(() => requests[requestIndex++].promise);
  const oldLookup = geocoder.resolve('Edmond, OK');
  const oldLookupCanceled = assert.rejects(oldLookup, LocationGeocodeCanceledError);
  const persisted = [];
  const saving = persistProfileWithResolvedLocation({}, 'Norman, OK', geocoder, async profile => persisted.push(profile));

  requests[0].respond({ name: 'Edmond', latitude: 35.6528, longitude: -97.4781 });
  await oldLookupCanceled;
  assert.equal(persisted.length, 0);
  requests[1].respond({ name: 'Norman', latitude: 35.2226, longitude: -97.4395 });
  await saving;
  assert.deepEqual(persisted, [{ latitude: 35.2226, longitude: -97.4395 }]);
});

test('removing a location invalidates an in-flight lookup', async () => {
  const request = deferredResponse();
  const geocoder = createLocationGeocoder(() => request.promise);
  const lookup = geocoder.resolve('Tulsa, OK');
  const lookupCanceled = assert.rejects(lookup, LocationGeocodeCanceledError);
  geocoder.cancel();
  request.respond({ name: 'Tulsa', latitude: 36.154, longitude: -95.9928 });
  await lookupCanceled;
});

test('clearing an input invalidates its lookup before empty-query submission', async () => {
  const request = deferredResponse();
  const geocoder = createLocationGeocoder(() => request.promise);
  const baseProfile = { business_name: 'MowGo', latitude: null, longitude: null };
  const lookup = geocoder.resolve('Edmond, OK');
  const lookupCanceled = assert.rejects(lookup, LocationGeocodeCanceledError);

  // Settings changeLocationQuery cancels before it commits the new input value.
  geocoder.cancel();
  request.respond({ name: 'Edmond', latitude: 35.6528, longitude: -97.4781 });
  await lookupCanceled;

  const persisted = [];
  await persistProfileWithResolvedLocation(baseProfile, '', geocoder, async profile => persisted.push(profile));
  assert.deepEqual(persisted, [baseProfile]);
});

test('Settings input changes use the lookup-invalidating handler', () => {
  const source = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  assert.match(source, /onChange=\{event => changeLocationQuery\(event\.target\.value\)\}/);
  assert.match(source, /function changeLocationQuery\(value\) \{[\s\S]*?locationGeocoder\.current\.cancel\(\)/);
});

test('a canceled lookup suppresses its late failure', async () => {
  let release;
  const response = new Promise(resolve => { release = resolve; });
  const geocoder = createLocationGeocoder(() => response);
  const lookup = geocoder.resolve('Broken lookup');
  const lookupCanceled = assert.rejects(lookup, LocationGeocodeCanceledError);
  geocoder.cancel();
  release({ ok: false });
  await lookupCanceled;
});

test('canceling an in-flight profile save rejects explicitly without persisting', async () => {
  const request = deferredResponse();
  const geocoder = createLocationGeocoder(() => request.promise);
  const persisted = [];
  const saving = persistProfileWithResolvedLocation(
    { business_name: 'Updated name', latitude: 35.4676, longitude: -97.5164 },
    'Norman, OK',
    geocoder,
    async profile => persisted.push(profile),
  );

  geocoder.cancel();
  request.respond({ name: 'Norman', latitude: 35.2226, longitude: -97.4395 });

  await assert.rejects(saving, LocationGeocodeCanceledError);
  assert.deepEqual(persisted, []);

  const source = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  assert.match(source, /err instanceof LocationGeocodeCanceledError[\s\S]*?setLocationError\(tr\('Location changed while saving\. Retry to save your changes\.'\)\)/);
  assert.match(source, /async function save\(e\) \{[\s\S]*?setSaved\(false\);[\s\S]*?persistProfileWithResolvedLocation/);
});

test('production save reuses this session\'s matching resolved location without another network lookup', async () => {
  const profile = { business_name: 'Renamed Demo', latitude: 35.4676, longitude: -97.5164 };
  const persisted = [];
  const geocoder = { resolve: () => { throw new Error('unexpected lookup'); } };
  const resolvedLocation = { query: 'Oklahoma City, OK', label: 'Oklahoma City, Oklahoma', latitude: 35.4676, longitude: -97.5164 };
  const result = await persistProfileWithResolvedLocation(
    profile,
    'Oklahoma City, OK',
    geocoder,
    async value => persisted.push(value),
    { demoMode: false, resolvedLocation },
  );

  assert.deepEqual(persisted, [profile]);
  assert.deepEqual(result, { profile, resolved: resolvedLocation, locationWarning: false });
});

test('production geocode failure saves other profile fields with a location warning', async () => {
  const profile = { business_name: 'Renamed Demo', latitude: 35.4676, longitude: -97.5164 };
  const persisted = [];
  const geocoder = { resolve: async () => { throw new LocationGeocodeError('offline'); } };
  const result = await persistProfileWithResolvedLocation(
    profile,
    'Norman, OK',
    geocoder,
    async value => persisted.push(value),
    { demoMode: false },
  );

  assert.deepEqual(persisted, [profile]);
  assert.deepEqual(result, { profile, resolved: null, locationWarning: true });
});

test('failed changed location persists unrelated fields with the last persisted coordinates', async () => {
  const draftProfile = { business_name: 'Renamed', latitude: 35.6528, longitude: -97.4781 };
  const persistedProfile = { business_name: 'Renamed', latitude: 35.4676, longitude: -97.5164 };
  const persisted = [];
  const result = await persistProfileWithResolvedLocation(
    draftProfile,
    'Norman, OK',
    { resolve: async () => { throw new LocationGeocodeError('offline'); } },
    async value => persisted.push(value),
    { profileOnLocationFailure: persistedProfile },
  );

  assert.deepEqual(persisted, [persistedProfile]);
  assert.deepEqual(result, { profile: persistedProfile, resolved: null, locationWarning: true });
});

test('demo save stays local and does not require a location lookup', async () => {
  const profile = { business_name: 'Demo Rename', latitude: 35.4676, longitude: -97.5164 };
  const persisted = [];
  const result = await persistProfileWithResolvedLocation(
    profile,
    'New demo location',
    { resolve: () => { throw new Error('unexpected lookup'); } },
    async value => persisted.push(value),
    { demoMode: true },
  );

  assert.deepEqual(persisted, [profile]);
  assert.deepEqual(result, { profile, resolved: null, locationWarning: false });
});

test('a resolved location is reused only while its exact query is unchanged', async () => {
  const resolvedLocation = { query: 'Edmond, OK', label: 'Edmond, Oklahoma', latitude: 35.6528, longitude: -97.4781 };
  let lookups = 0;
  const replacement = { query: 'Norman, OK', label: 'Norman, Oklahoma', latitude: 35.2226, longitude: -97.4395 };
  const persisted = [];

  await persistProfileWithResolvedLocation(
    { business_name: 'MowGo' },
    'Norman, OK',
    { resolve: async () => { lookups += 1; return replacement; } },
    async value => persisted.push(value),
    { resolvedLocation },
  );

  assert.equal(lookups, 1);
  assert.deepEqual(persisted, [{ business_name: 'MowGo', latitude: 35.2226, longitude: -97.4395 }]);
});

test('Settings does not show the Saved state when location resolution warned', () => {
  const source = readFileSync(new URL('../pages/Settings.jsx', import.meta.url), 'utf8');
  assert.match(source, /if \(!saveResult\.locationWarning\) \{[\s\S]*?setSaved\(true\)/);
  assert.match(source, /const saveLocationGeneration = locationUiGeneration\.current;[\s\S]*?saveLocationGeneration !== locationUiGeneration\.current[\s\S]*?Location changed while saving/);
});
