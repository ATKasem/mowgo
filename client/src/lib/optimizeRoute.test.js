import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineKm,
  optimizeRoute,
  optimizeRouteByZone,
  suggestDay,
  tourDistance,
} from './optimizeRoute.js';

// OKC-area demo coordinates
const OKC = { lat: 35.4676, lng: -97.5164 };
const EDMOND = { lat: 35.6528, lng: -97.4787 };
const OKC_E = { lat: 35.5219, lng: -97.4377 };
const NICHOLS = { lat: 35.5512, lng: -97.5447 };

test('haversineKm: known OKC→Edmond distance ~21km', () => {
  const d = haversineKm(OKC, EDMOND);
  assert.ok(d > 18 && d < 24, `got ${d}`);
});

test('optimizeRoute: 3 stops ordered nearest-first from anchor', () => {
  const jobs = [
    { id: 'a', lat: EDMOND.lat, lng: EDMOND.lng },
    { id: 'b', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'c', lat: NICHOLS.lat, lng: NICHOLS.lng },
  ];
  const order = optimizeRoute(jobs, OKC);
  assert.equal(order[0], 'b');
});

test('optimizeRoute: tour shorter than input order', () => {
  const jobs = [
    { id: 'a', lat: EDMOND.lat, lng: EDMOND.lng },
    { id: 'b', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'c', lat: NICHOLS.lat, lng: NICHOLS.lng },
  ];
  const order = optimizeRoute(jobs, OKC);
  const byId = Object.fromEntries(jobs.map(j => [j.id, j]));
  const tour = order.map(id => byId[id]);
  assert.ok(tourDistance(tour) <= tourDistance(jobs), 'optimized tour must not be longer');
});

test('optimizeRoute: unaddressable jobs keep their relative place', () => {
  const jobs = [
    { id: 'a', lat: EDMOND.lat, lng: EDMOND.lng },
    { id: 'x', lat: null, lng: null },
    { id: 'b', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'c', lat: NICHOLS.lat, lng: NICHOLS.lng },
  ];
  const order = optimizeRoute(jobs, OKC);
  assert.equal(order[1], 'x');
});

test('optimizeRoute: no anchor starts from first stop', () => {
  const jobs = [
    { id: 'a', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'b', lat: EDMOND.lat, lng: EDMOND.lng },
    { id: 'c', lat: NICHOLS.lat, lng: NICHOLS.lng },
  ];
  const order = optimizeRoute(jobs, null);
  assert.equal(order.length, 3);
  assert.equal(order[0], 'a');
});

test('optimizeRoute: <2 addressable returns original order', () => {
  const jobs = [
    { id: 'a', lat: null, lng: null },
    { id: 'b', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'c', lat: null, lng: null },
  ];
  assert.deepEqual(optimizeRoute(jobs, OKC), ['a', 'b', 'c']);
});

test('optimizeRoute: 2-opt is anchor-aware (never worsens the anchor-inclusive total)', () => {
  // 1D counterexample from Claude Code review: Y is anchor-nearest, but an
  // inter-stop-only 2-opt would move it off the front for a worse real drive.
  const anchor = { lat: 0, lng: 0 };
  const jobs = [
    { id: 'y', lat: 0, lng: 1 },
    { id: 'm1', lat: 0, lng: -2 },
    { id: 'm2', lat: 0, lng: -5 },
    { id: 'x', lat: 0, lng: 9 },
  ];
  const withAnchorTotal = tour => haversineKm(anchor, tour[0]) + tourDistance(tour);
  const inputTotal = withAnchorTotal(jobs);
  const order = optimizeRoute(jobs, anchor);
  const byId = Object.fromEntries(jobs.map(j => [j.id, j]));
  assert.ok(withAnchorTotal(order.map(id => byId[id])) <= inputTotal,
    `anchor-inclusive total must not worsen: ${withAnchorTotal(order.map(id => byId[id]))} vs ${inputTotal}`);
});

test('optimizeRoute: empty and single-job arrays', () => {
  assert.deepEqual(optimizeRoute([], OKC), []);
  assert.deepEqual(optimizeRoute([{ id: 'a', lat: 1, lng: 2 }], OKC), ['a']);
});

test('optimizeRouteByZone: jobs in two zones are grouped by zone', () => {
  const jobs = [
    { id: 'north-1', zone_id: 'north', lat: 35.7, lng: -97.5 },
    { id: 'south-1', zone_id: 'south', lat: 35.3, lng: -97.5 },
    { id: 'north-2', zone_id: 'north', lat: 35.71, lng: -97.5 },
    { id: 'south-2', zone_id: 'south', lat: 35.31, lng: -97.5 },
  ];
  const zoneMap = new Map([
    ['north', { name: 'North', color: '#0000ff' }],
    ['south', { name: 'South', color: '#ff0000' }],
  ]);

  const order = optimizeRouteByZone(jobs, OKC, zoneMap);
  const zones = order.map(id => jobs.find(job => job.id === id).zone_id);
  assert.ok(
    zones.join(',') === 'north,north,south,south'
      || zones.join(',') === 'south,south,north,north',
    `zones must be contiguous, got ${zones}`,
  );
});

test('optimizeRoute: zone centroids determine which zone comes first', () => {
  const anchor = { lat: 0, lng: 0 };
  const jobs = [
    { id: 'spread-near', zone_id: 'spread', lat: 0, lng: 0.1 },
    { id: 'spread-far', zone_id: 'spread', lat: 0, lng: 10 },
    { id: 'compact-1', zone_id: 'compact', lat: 0, lng: 2 },
    { id: 'compact-2', zone_id: 'compact', lat: 0, lng: 2.1 },
  ];
  const zoneMap = new Map([
    ['spread', { name: 'Spread', color: '#0000ff' }],
    ['compact', { name: 'Compact', color: '#ff0000' }],
  ]);

  assert.deepEqual(
    optimizeRoute(jobs, anchor, zoneMap),
    ['compact-1', 'compact-2', 'spread-near', 'spread-far'],
  );
});

test('optimizeRouteByZone: runs route optimization within each zone', () => {
  const anchor = { lat: 0, lng: 0 };
  const jobs = [
    { id: 'far', zone_id: 'only', lat: 0, lng: 3 },
    { id: 'near', zone_id: 'only', lat: 0, lng: 1 },
    { id: 'middle', zone_id: 'only', lat: 0, lng: 2 },
  ];
  const zoneMap = new Map([['only', { name: 'Only', color: '#0000ff' }]]);

  assert.deepEqual(optimizeRouteByZone(jobs, anchor, zoneMap), ['near', 'middle', 'far']);
});

test('optimizeRouteByZone: unzoned jobs go last', () => {
  const jobs = [
    { id: 'unzoned-1', zone_id: null, lat: 35.47, lng: -97.51 },
    { id: 'zoned', zone_id: 'far', lat: 36.5, lng: -97.5 },
    { id: 'unzoned-2', lat: 35.48, lng: -97.51 },
  ];
  const zoneMap = new Map([['far', { name: 'Far', color: '#0000ff' }]]);

  assert.deepEqual(optimizeRouteByZone(jobs, OKC, zoneMap), ['zoned', 'unzoned-1', 'unzoned-2']);
});

test('optimizeRoute: works without a zone map', () => {
  const anchor = { lat: 0, lng: 0 };
  const jobs = [
    { id: 'far', zone_id: 'a', lat: 0, lng: 10 },
    { id: 'near', zone_id: 'b', lat: 0, lng: 1 },
    { id: 'middle', zone_id: 'a', lat: 0, lng: 2 },
  ];

  assert.deepEqual(optimizeRoute(jobs, anchor), ['near', 'middle', 'far']);
});

test('suggestDay: picks closest day', () => {
  const byDay = {
    1: [{ lat: 35.5, lng: -97.5 }, { lat: 35.51, lng: -97.52 }], // Monday - OKC area
    3: [{ lat: 36.1, lng: -96.1 }], // Wednesday - Tulsa area
  };
  const newClient = { lat: 35.49, lng: -97.51 }; // OKC area
  const result = suggestDay(byDay, newClient);
  assert.equal(result.dayIndex, 1);
  assert.equal(result.dayName, 'Monday');
  assert.ok(result.avgDistanceKm < 10, `got ${result.avgDistanceKm}`);
});

test('suggestDay: returns null when no days have jobs', () => {
  assert.equal(suggestDay({}, { lat: 35.5, lng: -97.5 }), null);
  assert.equal(suggestDay({ 2: [], 4: null }, { lat: 35.5, lng: -97.5 }), null);
});

test('suggestDay: ignores empty/missing day arrays when picking closest', () => {
  const byDay = {
    0: [],
    2: [{ lat: 35.4676, lng: -97.5164 }], // OKC
  };
  const result = suggestDay(byDay, { lat: 35.47, lng: -97.51 });
  assert.equal(result.dayIndex, 2);
});
