export const CONCIERGE_ELIGIBLE_TIERS = Object.freeze(['solo', 'crew', 'premium']);
export const CONCIERGE_SLA_HOURS = 48;

const PRIORITY_BY_TIER = Object.freeze({ solo: 0, crew: 0, premium: 100 });
const NEXT_STATUSES = Object.freeze({
  pending: new Set(['importing', 'skipped']),
  importing: new Set(['review', 'skipped']),
  review: new Set(['done', 'skipped']),
  done: new Set(),
});

export function isConciergeTierEligible(tier) {
  return CONCIERGE_ELIGIBLE_TIERS.includes(tier);
}

export function conciergePriorityForTier(tier) {
  return PRIORITY_BY_TIER[tier] ?? 0;
}

export function conciergeSlaHoursForTier() {
  return CONCIERGE_SLA_HOURS;
}

export function isConciergeTransitionAllowed(fromStatus, toStatus) {
  return NEXT_STATUSES[fromStatus]?.has(toStatus) ?? false;
}

export function canUndoConciergeSchedule(status) {
  return status === 'importing' || status === 'review';
}

export function sortConciergeRequests(requests) {
  return [...requests].sort((left, right) => {
    const leftActive = ['pending', 'importing', 'review'].includes(left.status) ? 1 : 0;
    const rightActive = ['pending', 'importing', 'review'].includes(right.status) ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    const priorityDifference = (right.priority_rank ?? 0) - (left.priority_rank ?? 0);
    if (priorityDifference) return priorityDifference;
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });
}

export function isOperatorChecklistComplete(checklist) {
  return checklist?.clients_verified === true
    && checklist?.first_week_verified === true
    && checklist?.customer_ready === true;
}
