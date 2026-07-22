import { memo } from 'react';
import { Check, Clock, MapPin, Key, PawPrint, StickyNote, Navigation, AlarmCheck } from 'lucide-react';
import { STATUS_CONFIG } from '../lib/constants';
import { getMapsUrl } from '../lib/maps';

function JobCard({ job, index, isExpanded, isAnimating, onToggleExpand, onToggleStatus }) {
  const client = job.clients;
  const isDone = job.status === 'done';
  const statusInfo = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;

  return (
    <div className={`card transition-all duration-300 ${isAnimating ? 'scale-[0.98] opacity-70' : ''} ${isDone ? 'opacity-60' : ''}`}>
      {/* Main row — tap anywhere to expand */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
        className="p-4 flex items-center gap-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Status toggle — tap to mark done/undo */}
        <button
          aria-label={isDone ? 'Undo completion' : 'Mark job complete'}
          onClick={e => { e.stopPropagation(); onToggleStatus(); }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 transition-all duration-200 shadow-sm ${isDone ? 'bg-emerald-500 text-white scale-100' : 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/60 hover:scale-105'}`}
        >
          {isDone ? <Check className="w-6 h-6" /> : <span>{index + 1}</span>}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
            {client?.name || 'Unknown'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">{job.scheduled_time?.slice(0, 5)}</span>
            <span className="text-gray-300 dark:text-gray-600 text-xs">&middot;</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{job.title}</span>
          </div>
        </div>

        {/* Status badge */}
        <span className={statusInfo.badge}>{statusInfo.label}</span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 pt-3 space-y-3" style={{ animation: 'slideDown 0.15s ease-out' }}>
          {/* Key info */}
          <div className="flex flex-wrap gap-2">
            {client?.key_code && (
              <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><Key className="w-3.5 h-3.5" />Key: {client.key_code}</span>
            )}
            {client?.alarm_code && (
              <span className="badge bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><AlarmCheck className="w-3.5 h-3.5" />Alarm: {client.alarm_code}</span>
            )}
            {client?.pet_instructions && (
              <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><PawPrint className="w-3.5 h-3.5" />{client.pet_instructions}</span>
            )}
          </div>

          {/* Address + notes */}
          {client?.address && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{client.address}</span>
            </div>
          )}
          {client?.cleaning_notes && (
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <StickyNote className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              {client.cleaning_notes}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {client?.address && (
              <a href={getMapsUrl(client.address)} target="_blank" rel="noreferrer" className="btn-secondary flex-1 text-xs gap-1.5">
                <Navigation className="w-3.5 h-3.5" />Navigate
              </a>
            )}
            <button
              onClick={e => { e.stopPropagation(); onToggleStatus(); }}
              className={`flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'}`}
            >
              {isDone ? 'Undo' : 'Mark Complete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(JobCard);
