import useLocalizedText from '../i18n/useLocalizedText';
import { memo, useState, useEffect } from 'react';
import { Check, MapPin, Key, PawPrint, StickyNote, Navigation, AlarmCheck, RefreshCw, GripVertical, Clock, Camera, Pencil, SkipForward } from 'lucide-react';
import { STATUS_CONFIG, RECURRENCE_OPTIONS, TEAM_MEMBER_COLORS } from '../lib/constants';
import { getJobPhotos } from '../lib/data';
import { getMapsUrl } from '../lib/maps';

function JobCard({ job, index, isExpanded, isAnimating, isDragging, isDragOver, onToggleExpand, onToggleStatus, onDragStart, onDragOver, onDrop, onDragEnd, onMoveUp, onMoveDown, onEdit, onSkip, teamMembers }) {
  const { tr } = useLocalizedText('jobCard');
  const [photos, setPhotos] = useState({ before: null, after: null });
  const client = job.clients;
  const isDone = job.status === 'done';
  const isInProgress = job.status === 'in_progress';
  const isSkipped = job.status === 'skipped';
  const isActive = !isDone && !isInProgress;
  const statusInfo = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;
  const recurrenceLabel = job.recurrence && job.recurrence !== 'none'
    ? RECURRENCE_OPTIONS.find(r => r.value === job.recurrence)?.label
    : null;

  // Resolve assigned member for crew chip
  const assignedMember = teamMembers && job.assigned_to
    ? teamMembers.find(m => m.id === job.assigned_to)
    : null;
  const assignedMemberIdx = assignedMember ? teamMembers.indexOf(assignedMember) : -1;
  const assignedColor = assignedMemberIdx >= 0
    ? TEAM_MEMBER_COLORS[assignedMemberIdx % TEAM_MEMBER_COLORS.length]
    : null;

  // Load photos when expanded
  useEffect(() => {
    if (!isExpanded) return;
    let active = true;
    getJobPhotos(job.id).then(p => { if (active) setPhotos(p); }).catch(() => {});
    return () => { active = false; };
  }, [isExpanded, job.id]);

  return (
    <div
      className={`card transition-all duration-300 ${isAnimating ? 'scale-[0.98] opacity-70' : ''} ${isDone ? 'opacity-60' : isInProgress ? 'opacity-90' : ''} ${isDragging ? 'opacity-40 scale-95' : ''} ${isDragOver ? 'ring-2 ring-sky-400 dark:ring-sky-500 border-sky-400' : ''}`}
      draggable={isActive}
      onDragStart={(e) => { if (isActive) { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); } }}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
      onDragEnd={onDragEnd}
    >
      {/* Main row — tap anywhere to expand */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
        className="p-4 flex items-center gap-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Drag handle */}
        {isActive && (
          <div className="text-gray-300 dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] dark:hover:text-[var(--color-text-muted)] cursor-grab active:cursor-grabbing flex-shrink-0" aria-label={tr("Drag to reorder")}>
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Status toggle — 3-state: scheduled → in_progress → done */}
        <button
          aria-label={tr(isDone ? 'Undo completion' : isInProgress ? 'Mark job complete' : 'Start work')}
          onClick={e => { e.stopPropagation(); onToggleStatus(); }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 transition-all duration-200 shadow-sm ${isDone ? 'bg-brand text-white scale-100' : isInProgress ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 hover:scale-105' : 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/60 hover:scale-105'}`}
        >
          {isDone ? <Check className="w-6 h-6" /> : isInProgress ? <Clock className="w-5 h-5" /> : <span>{index + 1}</span>}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${isDone ? 'line-through text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)] dark:text-white'}`}>
            {client?.name || tr('Unknown')}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{job.scheduled_time?.slice(0, 5)}</span>
            <span className="text-gray-300 dark:text-[var(--color-text-secondary)] text-xs">&middot;</span>
            <span className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] truncate">{job.title}</span>
            {recurrenceLabel && (
              <><span className="text-gray-300 dark:text-[var(--color-text-secondary)] text-xs">·</span>
              <span className="text-xs text-violet-500 dark:text-violet-400 inline-flex items-center gap-0.5"><RefreshCw className="w-3 h-3" />{tr(recurrenceLabel)}</span></>
            )}
            {assignedMember && assignedColor && (
              <><span className="text-gray-300 dark:text-[var(--color-text-secondary)] text-xs">·</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${assignedColor.bg} ${assignedColor.text}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {(assignedMember.business_name || tr('Unnamed')).split(' ')[0]}
              </span></>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span className={statusInfo.badge}>{tr(statusInfo.label)}</span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 pt-3 space-y-3" style={{ animation: 'slideDown 0.15s ease-out' }}>
          {/* Key info */}
          <div className="flex flex-wrap gap-2">
            {client?.key_code && (
              <span className="badge bg-[var(--color-surface-secondary)] dark:bg-gray-800 text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><Key className="w-3.5 h-3.5" />{tr('Key')}: {client.key_code}</span>
            )}
            {client?.alarm_code && (
              <span className="badge bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><AlarmCheck className="w-3.5 h-3.5" />{tr('Alarm')}: {client.alarm_code}</span>
            )}
            {client?.pet_instructions && (
              <span className="badge bg-[var(--color-surface-secondary)] dark:bg-gray-800 text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><PawPrint className="w-3.5 h-3.5" />{client.pet_instructions}</span>
            )}
            {recurrenceLabel && (
              <span className="badge bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 text-xs inline-flex items-center gap-1.5 px-3 py-1.5"><RefreshCw className="w-3.5 h-3.5" />{tr(recurrenceLabel)}</span>
            )}
          </div>

          {/* Address + notes */}
          {client?.address && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{client.address}</span>
            </div>
          )}
          {client?.service_notes && (
            <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] dark:bg-gray-800/50 rounded-lg p-3">
              <StickyNote className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
              {client.service_notes}
            </div>
          )}

          {/* Before/After photos */}
          {(photos.before || photos.after) && (
            <div className="flex gap-2">
              {photos.before && (
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">{tr('Before')}</p>
                  <img src={photos.before} alt={tr('Before')} className="w-full h-24 object-cover rounded-lg border border-[var(--color-border)] dark:border-gray-700" />
                </div>
              )}
              {photos.after && (
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">{tr('After')}</p>
                  <img src={photos.after} alt={tr('After')} className="w-full h-24 object-cover rounded-lg border border-[var(--color-border)] dark:border-gray-700" />
                </div>
              )}
            </div>
          )}
          {!photos.before && !photos.after && isDone && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">
              <Camera className="w-3.5 h-3.5" />
              <span>{tr('No photo')}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {client?.address && (
              <a href={getMapsUrl(client.address)} target="_blank" rel="noreferrer" className="btn-secondary flex-1 text-xs gap-1.5 min-h-[44px] py-2.5">
                <Navigation className="w-3.5 h-3.5" />{tr("Navigate")}
              </a>
            )}
            <button
              onClick={e => { e.stopPropagation(); onToggleStatus(); }}
              className={`flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : isInProgress ? 'bg-brand text-white hover:bg-brand-hover' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'}`}
            >
              {tr(isDone ? 'Undo' : isInProgress ? 'Mark Complete' : 'Start Work')}
            </button>
          </div>
          {(onEdit || (onSkip && !isDone && !isSkipped)) && (
            <div className="flex gap-2">
              {onEdit && (
                <button
                  onClick={e => { e.stopPropagation(); onEdit(); }}
                  className="btn-secondary flex-1 text-xs gap-1.5 min-h-[40px] py-2"
                >
                  <Pencil className="w-3.5 h-3.5" />{tr('Edit')}
                </button>
              )}
              {onSkip && !isDone && !isSkipped && (
                <button
                  onClick={e => { e.stopPropagation(); onSkip(); }}
                  className="btn-secondary flex-1 text-xs gap-1.5 min-h-[40px] py-2 text-amber-700 dark:text-amber-400"
                >
                  <SkipForward className="w-3.5 h-3.5" />{tr('Skip')}
                </button>
              )}
            </div>
          )}
          {/* Keyboard reordering buttons — hidden from mouse users, accessible to keyboard */}
          {isActive && (
            <div className="flex gap-2">
              {onMoveUp && (
                <button onClick={e => { e.stopPropagation(); onMoveUp(); }} className="sr-only focus:not-sr-only focus:btn-secondary focus:text-xs focus:gap-1" aria-label={tr("Move up")}>
                  ↑ {tr('Move up')}
                </button>
              )}
              {onMoveDown && (
                <button onClick={e => { e.stopPropagation(); onMoveDown(); }} className="sr-only focus:not-sr-only focus:btn-secondary focus:text-xs focus:gap-1" aria-label={tr("Move down")}>
                  ↓ {tr('Move down')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(JobCard);
