import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, optimizeRoute, tourDistance } from './optimizeRoute.js';

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
