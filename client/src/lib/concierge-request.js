const ACTIVE_CONCIERGE_STATUSES = new Set(['pending', 'importing', 'review']);
const ACTIVE_OR_DONE_CONCIERGE_STATUSES = new Set(['pending', 'importing', 'review', 'done']);

export function isActiveConciergeRequest(request) {
  return ACTIVE_CONCIERGE_STATUSES.has(request?.status);
}

export function isActiveOrDoneConciergeRequest(request) {
  return ACTIVE_OR_DONE_CONCIERGE_STATUSES.has(request?.status);
}

export function conciergeRequestRpcState({ data, error }) {
  return {
    request: error ? null : data?.[0] || null,
    loadFailed: Boolean(error),
  };
}

export function dashboardConciergeView({ demoMode, profile, request, dismissed, hasStatus = isActiveOrDoneConciergeRequest(request) || request?.status === 'skipped' }) {
  if (demoMode || profile?.role === 'crew' || !['solo', 'crew', 'premium'].includes(profile?.tier)) return 'hidden';
  if (request === undefined) return 'loading';
  if (hasStatus) return 'status';
  return dismissed ? 'hidden' : 'prompt';
}
