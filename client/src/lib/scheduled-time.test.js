import test from 'node:test';
import assert from 'node:assert/strict';
import { formatScheduledTime as format } from './scheduled-time.js';

// ICU versions differ on the space before AM/PM (U+0020 vs U+202F).
const formatScheduledTime = (...args) => format(...args).replace(/\u202f/g, ' ');

test('Postgres TIME values show as a locale short time', () => {
  assert.equal(formatScheduledTime('08:00:00'), '8:00 AM');
  assert.equal(formatScheduledTime('08:00'), '8:00 AM');
  assert.equal(formatScheduledTime('13:30:00'), '1:30 PM');
  assert.equal(formatScheduledTime('00:05:00'), '12:05 AM');
  assert.equal(formatScheduledTime('12:00:00.000000'), '12:00 PM');
});

test('Spanish uses the es-US short time', () => {
  assert.match(formatScheduledTime('08:00:00', 'es'), /^8:00\s?a\.?\s?m\.?$/);
});

test('empty and unparseable values', () => {
  assert.equal(formatScheduledTime(null), '');
  assert.equal(formatScheduledTime(undefined), '');
  assert.equal(formatScheduledTime(''), '');
  assert.equal(formatScheduledTime('soon'), 'soon');
  assert.equal(formatScheduledTime('24:00:00'), '24:00:00');
  assert.equal(formatScheduledTime('08:75'), '08:75');
});
