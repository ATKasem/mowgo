import test from 'node:test';
import assert from 'node:assert/strict';
import { compareDayOrder, sortJobs } from './job-order.js';

const ids = jobs => jobs.map(j => j.id);

test('route order first, unordered last', () => {
  const jobs = [
    { id: 'c', route_order: null, scheduled_time: '07:00:00' },
    { id: 'b', route_order: 2, scheduled_time: '08:00' },
    { id: 'a', route_order: 1, scheduled_time: '15:00:00' },
  ];
  assert.deepEqual(ids([...jobs].sort(compareDayOrder)), ['a', 'b', 'c']);
});

test('ties break on HH:mm time (untimed last), then id — never status', () => {
  const jobs = [
    { id: 'z', route_order: 99, scheduled_time: null, status: 'scheduled' },
    { id: 'y', route_order: 99, scheduled_time: '09:00:00', status: 'done' },
    { id: 'x', route_order: 99, scheduled_time: '09:00', status: 'in_progress' },
    { id: 'w', route_order: 99, scheduled_time: '08:30:00', status: 'scheduled' },
  ];
  assert.deepEqual(ids([...jobs].sort(compareDayOrder)), ['w', 'x', 'y', 'z']);
  const started = jobs.map(j => (j.id === 'w' ? { ...j, status: 'done' } : j));
  assert.deepEqual(ids([...started].reverse().sort(compareDayOrder)), ['w', 'x', 'y', 'z']);
});

test('sortJobs groups by date and does not mutate the input', () => {
  const jobs = [
    { id: '2', scheduled_date: '2026-10-26', route_order: 1 },
    { id: '1', scheduled_date: '2026-10-25', route_order: 2 },
    { id: '0', scheduled_date: '2026-10-25', route_order: 1 },
  ];
  assert.deepEqual(ids(sortJobs(jobs)), ['0', '1', '2']);
  assert.deepEqual(ids(jobs), ['2', '1', '0']);
});
