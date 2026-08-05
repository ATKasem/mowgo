import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleDirUrl, buildAppleDirUrl, buildWazeStopUrl,
  buildSingleStopUrl, buildRouteLink,
} from './navLinks.js';

const stops = [
  { id: 'a', address: '123 Oak St, Edmond, OK', lat: 35.6528, lng: -97.4787 },
  { id: 'b', address: '456 Elm Ave, OKC, OK',   lat: 35.5219, lng: -97.4377 },
  { id: 'c', address: '789 Maple Dr, Edmond, OK', lat: 35.6535, lng: -97.4811 },
];
const anchor = { lat: 35.4676, lng: -97.5164 };

test('Google: origin + destination + | waypoints, commas encoded %2C, pipes %7C', () => {
  const { url, skipped, truncated } = buildGoogleDirUrl(anchor, stops);
  assert.equal(skipped, 0);
  assert.equal(truncated, false);
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&travelmode=driving&origin=35\.467600%2C-97\.516400&destination=35\.653500%2C-97\.481100&waypoints=/);
  assert.match(url, /waypoints=35\.652800%2C-97\.478700%7C35\.521900%2C-97\.437700$/);
});

test('Google: caps at 10 stops (9 waypoints + destination) and reports truncation', () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `s${i}`, address: `A ${i}`, lat: 35.5 + i / 1000, lng: -97.5 }));
  const { url, truncated } = buildGoogleDirUrl(anchor, many);
  assert.equal(truncated, true);
  const waypointCount = (url.match(/&waypoint=/g) || []).length;
  const wp = url.split('waypoints=')[1];
  assert.equal(wp.split('%7C').length, 9, 'exactly 9 waypoints at cap');
});

test('Google: stops without coords are skipped and counted', () => {
  const mixed = [...stops, { id: 'z', address: 'No coords yet', lat: null, lng: null }];
  const { skipped } = buildGoogleDirUrl(anchor, mixed);
  assert.equal(skipped, 1);
});

test('Apple: destination is the LAST stop, waypoints are the stops in between', () => {
  const { url, skipped, truncated } = buildAppleDirUrl(anchor, stops);
  assert.equal(skipped, 0);
  assert.equal(truncated, false);
  // source = anchor coords (raw comma per Apple docs); destination = LAST stop
  // address (encoded); waypoint = preceding stops (raw comma coords).
  assert.match(url, /^https:\/\/maps\.apple\.com\/directions\?mode=driving&source=35\.467600,-97\.516400&destination=789%20Maple%20Dr%2C%20Edmond%2C%20OK/);
  assert.match(url, /&waypoint=35\.652800,-97\.478700&waypoint=35\.521900,-97\.437700$/);
});

test('Apple: address with special characters is encoded (spaces, commas, ampersands, percent)', () => {
  const tricky = [
    { id: 'a', address: 'Elm Ave, OKC, OK', lat: 35.55, lng: -97.46 },
    { id: 'b', address: 'Main St & 5th Ave #2, OKC, OK 100%', lat: 35.52, lng: -97.44 },
  ];
  const { url } = buildAppleDirUrl(null, tricky);
  // destination (last stop) is the only place an address appears — must be fully encoded
  assert.match(url, /destination=Main%20St%20%26%205th%20Ave%20%232%2C%20OKC%2C%20OK%20100%25/);
});

test('Apple: caps at 10 stops defensively', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, address: `A ${i}`, lat: 35.5 + i / 1000, lng: -97.5 }));
  const { truncated, url } = buildAppleDirUrl(null, many);
  assert.equal(truncated, true);
  assert.equal((url.match(/&waypoint=/g) || []).length, 9, 'destination + 9 waypoints at cap');
});

test('Waze: single-stop ll + navigate=yes', () => {
  assert.equal(buildWazeStopUrl(stops[0]), 'https://waze.com/ul?ll=35.652800,-97.478700&navigate=yes');
});

test('buildSingleStopUrl: per-app shapes', () => {
  assert.equal(buildSingleStopUrl('waze', stops[0]), 'https://waze.com/ul?ll=35.652800,-97.478700&navigate=yes');
  assert.match(buildSingleStopUrl('apple', stops[0]), /^https:\/\/maps\.apple\.com\/\?daddr=35\.652800%2C-97\.478700$/);
  assert.match(buildSingleStopUrl('google', stops[0]), /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=35\.652800%2C-97\.478700$/);
});

test('buildRouteLink: waze returns null url (multi-stop unsupported)', () => {
  const res = buildRouteLink('waze', anchor, stops);
  assert.equal(res.url, null);
});
