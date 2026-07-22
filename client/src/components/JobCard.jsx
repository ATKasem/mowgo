import { memo } from 'react';
import { Check, Clock, MapPin, Key, PawPrint, StickyNote, Navigation, AlarmCheck } from 'lucide-react';
import { STATUS_CONFIG } from '../lib/constants';

function JobCard({ job, index, isExpanded, isAnimating, onToggleExpand, onToggleStatus }) {
  const client = job.clients;
  const isDone = job.status === 'done';
  const statusInfo = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;

  return (
    <div className={`card transition-all duration-300 ${isAnimating ? 'scale-[0.98] opacity-70' : ''} ${isDone ? 'opacity-70' : ''}`}>
      {/* Main row */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
        className="p-4 flex items-center gap-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Stop number */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400'}`}>
            {isDone ? <Check className="w-5 h-5" /> : <span>{index + 1}</span>}
          </div>

          {/* Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={`font-semibold text-sm ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{client?.name || 'Unknown'}</p>
              <span className={statusInfo.badge}>{statusInfo.label}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{job.scheduled_time?.slice(0, 5)}</span>
              <span className="text-gray-300 dark:text-gray-600 text-xs">&middot;</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{job.title}</span>
            </div>
            {client?.address && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{client.address}</p>
            )}
          </div>
        </div>

        {/* Mark Done button */}
        <button
          aria-label={isDone ? 'Undo completion' : 'Mark job complete'}
          onClick={e => { e.stopPropagation(); onToggleStatus(); }}
          className={`flex-shrink-0 w-28 min-h-[44px] text-center text-xs font-bold px-3 py-2.5 rounded-xl transition-all duration-200 shadow-sm ${isDone ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : isAnimating ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800'}`}
        >
          {isDone ? '✓ Done' : isAnimating ? '...' : 'Mark Done'}
        </button>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 pt-3 space-y-3" style={{ animation: 'slideDown 0.15s ease-out' }}>
          {/* Key info cards */}
          <div className="flex flex-wrap gap-2">
            {client?.key_code && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><Key className="w-3.5 h-3.5" />Key: {client.key_code}</span>}
            {client?.alarm_code && <span className="badge bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><AlarmCheck className="w-3.5 h-3.5" />Alarm: {client.alarm_code}</span>}
            {client?.pet_instructions && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><PawPrint className="w-3.5 h-3.5" />{client.pet_instructions}</span>}
          </div>

          {/* Notes */}
          {client?.cleaning_notes && (
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <StickyNote className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              {client.cleaning_notes}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {client?.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`} target="_blank" rel="noreferrer" className="btn-secondary flex-1 text-xs gap-1.5">
                <Navigation className="w-3.5 h-3.5" />Navigate
              </a>
            )}
            <button
              onClick={e => { e.stopPropagation(); onToggleStatus(); }}
              className={`flex-1 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'btn-primary'}`}
            >
              {isDone ? <span className="flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" />Completed</span> : 'Mark Complete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(JobCard);
