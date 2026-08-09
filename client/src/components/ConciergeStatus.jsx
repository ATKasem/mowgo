import useLocalizedText from '../i18n/useLocalizedText';

const STATUS_LABELS = { pending: 'Queued', importing: 'Import in progress', review: 'Human review in progress', done: 'Setup complete', skipped: 'Setup closed' };

export default function ConciergeStatus({ request, compact = false, onRetry }) {
  const { tr } = useLocalizedText('concierge');
  if (!request) return null;
  const dueAt = request.sla_due_at ? new Date(request.sla_due_at) : null;
  const dateTimeFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short' });
  const active = ['pending', 'importing', 'review'].includes(request.status);
  return <div className={compact ? 'text-sm space-y-1' : 'card p-5 space-y-2'}>
    <div className="flex flex-wrap items-center gap-2"><span className={request.status === 'done' ? 'badge-success' : 'badge-warning'}>{tr(STATUS_LABELS[request.status] || 'Queued')}</span>{request.tier_at_request === 'premium' && <span className="badge-success">{tr('Premium priority')}</span>}</div>
    {active && dueAt && <p className="text-sm text-gray-600 dark:text-gray-300">{tr('Setup target')}: <time dateTime={request.sla_due_at}>{dateTimeFormat.format(dueAt)}</time></p>}
    {request.status === 'review' && <p className="text-xs text-gray-500 dark:text-gray-400">{tr('An operator is reviewing your imported clients and first operating week before completion.')}</p>}
    {request.status === 'done' && request.done_at && <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Completed')} <time dateTime={request.done_at}>{dateTimeFormat.format(new Date(request.done_at))}</time></p>}
    {request.status === 'skipped' && <p className="text-sm text-gray-600 dark:text-gray-300">{tr('This request was closed. You can submit a new request when you are ready.')}</p>}
    {request.status === 'skipped' && onRetry && <button type="button" className="btn-primary" onClick={onRetry}>{tr('Start a new setup request')}</button>}
  </div>;
}
