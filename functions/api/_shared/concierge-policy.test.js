import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canUndoConciergeSchedule,
  conciergePriorityForTier,
  conciergeSlaHoursForTier,
  isConciergeTierEligible,
  isConciergeTransitionAllowed,
  sortConciergeRequests,
} from './concierge-policy.js';

test('Premium is eligible and sorts ahead of older standard paid requests', () => {
  const requests = [
    { id: 'solo', tier_at_request: 'solo', priority_rank: 0, created_at: '2026-08-01T00:00:00Z' },
    { id: 'premium', tier_at_request: 'premium', priority_rank: 100, created_at: '2026-08-02T00:00:00Z' },
    { id: 'crew', tier_at_request: 'crew', priority_rank: 0, created_at: '2026-07-31T00:00:00Z' },
  ];

  assert.equal(isConciergeTierEligible('premium'), true);
  assert.equal(conciergePriorityForTier('premium'), 100);
  assert.deepEqual(sortConciergeRequests(requests).map((request) => request.id), ['premium', 'crew', 'solo']);
});

test('completed history never sorts ahead of the active setup queue', () => {
  const requests = [
    { id: 'completed-premium', status: 'done', priority_rank: 100, created_at: '2026-08-01T00:00:00Z' },
    { id: 'active-solo', status: 'pending', priority_rank: 0, created_at: '2026-08-02T00:00:00Z' },
  ];
  assert.deepEqual(sortConciergeRequests(requests).map((request) => request.id), ['active-solo', 'completed-premium']);
});

test('only active paid product tiers are concierge eligible', () => {
  assert.equal(isConciergeTierEligible('solo'), true);
  assert.equal(isConciergeTierEligible('crew'), true);
  assert.equal(isConciergeTierEligible('premium'), true);
  assert.equal(isConciergeTierEligible('free'), false);
  assert.equal(isConciergeTierEligible('owner'), false);
  assert.equal(isConciergeTierEligible(null), false);
  assert.equal(conciergeSlaHoursForTier('premium'), 48);
});

test('completion requires the human-review state and terminal states cannot be reopened', () => {
  assert.equal(isConciergeTransitionAllowed('pending', 'importing'), true);
  assert.equal(isConciergeTransitionAllowed('importing', 'review'), true);
  assert.equal(isConciergeTransitionAllowed('review', 'done'), true);
  assert.equal(isConciergeTransitionAllowed('review', 'importing'), false);
  assert.equal(isConciergeTransitionAllowed('pending', 'done'), false);
  assert.equal(isConciergeTransitionAllowed('importing', 'done'), false);
  assert.equal(isConciergeTransitionAllowed('done', 'review'), false);
  assert.equal(isConciergeTransitionAllowed('skipped', 'pending'), false);
});

test('active requests may be safely closed as skipped but terminal requests cannot change', () => {
  assert.equal(isConciergeTransitionAllowed('pending', 'skipped'), true);
  assert.equal(isConciergeTransitionAllowed('importing', 'skipped'), true);
  assert.equal(isConciergeTransitionAllowed('review', 'skipped'), true);
  assert.equal(isConciergeTransitionAllowed('done', 'skipped'), false);
  assert.equal(isConciergeTransitionAllowed('skipped', 'done'), false);
});

test('schedule undo is available through review but not after a terminal transition', () => {
  assert.equal(canUndoConciergeSchedule('importing'), true);
  assert.equal(canUndoConciergeSchedule('review'), true);
  assert.equal(canUndoConciergeSchedule('pending'), false);
  assert.equal(canUndoConciergeSchedule('done'), false);
  assert.equal(canUndoConciergeSchedule('skipped'), false);
});
