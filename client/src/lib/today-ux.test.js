import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayConditionsView, meaningfulDayConditions, teamProgressView } from './today-ux.js';

test('day conditions are empty when every meaningful value is unavailable', () => {
  assert.equal(meaningfulDayConditions(null), false);
  assert.equal(meaningfulDayConditions({ currentTemp: null, windMph: null, soilTempF: null, rain7dInches: null }), false);
  assert.equal(meaningfulDayConditions({ currentTemp: 0, windMph: null, soilTempF: null, rain7dInches: null }), true);
});

test('day conditions distinguish loading, unavailable, and missing-location states', () => {
  assert.equal(dayConditionsView(null, true, null), 'loading');
  assert.equal(dayConditionsView(true, true, null), 'loading');
  assert.equal(dayConditionsView(false, false, null), 'no-location');
  assert.equal(dayConditionsView(true, false, null), 'unavailable');
  assert.equal(dayConditionsView(true, false, { currentTemp: 72 }), 'ready');
});

test('Today owns an explicit conditions loading state and uses shared team access checks', () => {
  const source = readFileSync(new URL('../pages/Today.jsx', import.meta.url), 'utf8');
  assert.match(source, /const \[conditionsLoading, setConditionsLoading\] = useState\(true\)/);
  assert.match(source, /hasTeamAccess\(profile\)/);
  assert.doesNotMatch(source, /TEAM_ACCESS_TIERS\.includes\(profile\?\.tier\)/);
});

test('owner-only progress is hidden', () => {
  assert.deepEqual(teamProgressView([
    { id: 'owner', role: 'owner', total: 0, done: 0, in_progress: 0 },
  ]), { show: false, rows: [], empty: false });
});

test('real crew with no assignments gets an empty state without an owner 0/0 row', () => {
  assert.deepEqual(teamProgressView([
    { id: 'owner', role: 'owner', total: 0, done: 0, in_progress: 0 },
    { id: 'crew-1', role: 'crew', total: 0, done: 0, in_progress: 0 },
  ]), { show: true, rows: [], empty: true });
});

test('mixed assignments show only members with meaningful progress', () => {
  const owner = { id: 'owner', role: 'owner', total: 0, done: 0, in_progress: 0 };
  const assignedCrew = { id: 'crew-1', role: 'crew', total: 2, done: 1, in_progress: 1 };
  const idleCrew = { id: 'crew-2', role: 'crew', total: 0, done: 0, in_progress: 0 };
  assert.deepEqual(teamProgressView([owner, assignedCrew, idleCrew]), {
    show: true,
    rows: [assignedCrew],
    empty: false,
  });
});
