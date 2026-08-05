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

test('Google: origin + destination + |-separated waypoints', () => {
  const { url, skipped, truncated } = buildGoogleDirUrl(anchor, stops);
  assert.equal(skipped, 0);
  assert.equal(truncated, false);
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=35\.467600,-97\.516400&destination=35\.653500,-97\.481100&waypoints=/);
  assert.match(url, /waypoints=35\.652800%2C-97\.478700\|35\.521900%2C-97\.437700/);
});

test('Google: truncates past 10 stops (8 waypoints + destination)', () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `s${i}`, address: `A ${i}`, lat: 35.5 + i / 1000, lng: -97.5 }));
  const { truncated } = buildGoogleDirUrl(anchor, many);
  assert.equal(truncated, true);
});

test('Google: stops without coords are skipped and counted', () => {
  const mixed = [...stops, { id: 'z', address: 'No coords yet', lat: null, lng: null }];
  const { skipped } = buildGoogleDirUrl(anchor, mixed);
  assert.equal(skipped, 1);
});

test('Apple: unified URL with destination address + multiple waypoint params', () => {
  const { url, skipped } = buildAppleDirUrl(anchor, stops);
  assert.equal(skipped, 0);
  assert.match(url, /^https:\/\/maps\.apple\.com\/directions\?mode=driving&source=35\.467600,-97\.516400&destination=123%20Oak%20St%2C%20Edmond%2C%20OK/);
  assert.match(url, /&waypoint=35\.521900%2C-97\.437700&waypoint=35\.653500%2C-97\.481100$/);
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
