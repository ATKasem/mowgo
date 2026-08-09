const ACTIVE_CONCIERGE_STATUSES = new Set(['pending', 'importing', 'review']);
const ACTIVE_OR_DONE_CONCIERGE_STATUSES = new Set(['pending', 'importing', 'review', 'done']);

export function isActiveConciergeRequest(request) {
  return ACTIVE_CONCIERGE_STATUSES.has(request?.status);
}

export function isActiveOrDoneConciergeRequest(request) {
  return ACTIVE_OR_DONE_CONCIERGE_STATUSES.has(request?.status);
}
