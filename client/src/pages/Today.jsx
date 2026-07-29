import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWeather } from '../lib/useWeather';
import { INITIAL_JOB_FORM, RECURRENCE_OPTIONS, TEAM_MEMBER_COLORS } from '../lib/constants';
import { createJob, updateJobStatus, updateJob, reorderJobs, loadClients, loadTeamMembers, loadProfile, loadTeamDashboard } from '../lib/data';
import { useSearchParams } from 'react-router-dom';
import { Plus, Circle, CloudRain, Repeat, Loader2, Sparkles } from 'lucide-react';
import JobCard from '../components/JobCard';
import NewJobForm from '../components/NewJobForm';
import InvoiceToast from '../components/InvoiceToast';

/** Calculate the next occurrence date based on recurrence rule */
function getNextDate(currentDate, recurrence) {
  const d = new Date(currentDate + 'T12:00:00');
  switch (recurrence) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    default: return null;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Today({ jobs = [], setJobs, invoices = [], setInvoices, loading }) {
  const { tr, t, i18n } = useLocalizedText('today');
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(() => {
    if (searchParams.get('date')) return searchParams.get('date');
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_JOB_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [animating, setAnimating] = useState(null);
  const [completedToast, setCompletedToast] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [canManageCrew, setCanManageCrew] = useState(false);
  const [isCrewMember, setIsCrewMember] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [crewFilter, setCrewFilter] = useState(null); // null = show all
  const [teamDashboard, setTeamDashboard] = useState([]);
  const toggleTimeoutRef = useRef(null);
  const jobsRef = useRef(jobs);
  const formRef = useRef(form);

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { formRef.current = form; }, [form]);

  const { rainLikely, todayRainChance } = useWeather();

  // Filtered jobs computed early for use in effects and render
  const dateFiltered = useMemo(() => jobs.filter(j => j.scheduled_date === date), [jobs, date]);
  const filtered = useMemo(() => crewFilter
    ? dateFiltered.filter(j => j.assigned_to === crewFilter)
    : dateFiltered, [dateFiltered, crewFilter]);
  const doneCount = useMemo(() => filtered.filter(j => j.status === 'done').length, [filtered]);

  // Signal badge on FAB when there's something the AI can help with
  useEffect(() => {
    const incompleteJobs = filtered.some(j => j.status !== 'done');
    const completedJobs = doneCount > 0;
    const shouldShowBadge = (incompleteJobs && rainLikely()) || completedJobs;
    window.dispatchEvent(new CustomEvent('mowgo:autopilot-badge', { detail: { show: shouldShowBadge } }));
  }, [filtered, doneCount, rainLikely]);

  // Load clients for the NewJobForm dropdown
  useEffect(() => {
    let active = true;
    loadClients().then(clients => { if (active) setClients(clients); }).catch(err => console.error('loadClients:', err));
    return () => { active = false; };
  }, []);

  // Load team members when on crew tier
  useEffect(() => {
    let active = true;
    async function loadTeam() {
      try {
        const profile = await loadProfile();
        if (profile?.tier === 'crew') {
          const members = await loadTeamMembers();
          if (active) {
            setTeamMembers(members);
            setCanManageCrew((profile.role || 'owner') === 'owner');
            setIsCrewMember(profile.role === 'crew');
          }
        }
      } catch (err) {
        console.error('loadTeamMembers:', err);
        if (active) setTeamError(tr('Crew assignments are temporarily unavailable.'));
      } finally {
        if (active) setTeamLoading(false);
      }
    }
    loadTeam();
    return () => { active = false; };
  }, []);

  // Load team dashboard stats for crew owners
  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const profile = await loadProfile();
        if (profile?.tier === 'crew' && (profile.role || 'owner') === 'owner') {
          const data = await loadTeamDashboard(date);
          if (active) setTeamDashboard(data);
        }
      } catch (err) {
        console.error('loadTeamDashboard:', err);
      }
    }
    loadDashboard();
    return () => { active = false; };
  }, [date]);

  const createJobHandler = useCallback(async (e) => {
    e.preventDefault();
    const currentForm = formRef.current;
    if (!currentForm.client_id) return;
    setSaving(true);
    try {
      const currentJobs = jobsRef.current;
      const newJob = await createJob({ ...currentForm, scheduled_date: date, route_order: currentJobs.filter(j => j.scheduled_date === date).length + 1 });
      if (newJob) {
        setJobs(prev => [newJob, ...prev]);
        setShowForm(false);
        setForm(INITIAL_JOB_FORM);
      }
    } catch (err) {
      console.error('createJob:', err);
      setCompletedToast({ name: tr('Failed to create job. Try again.'), amount: 0, type: 'error' });
      setTimeout(() => setCompletedToast(null), 4000);
    }
    setSaving(false);
  }, [formRef, date, setJobs]);

  const toggleStatus = useCallback(async (job) => {
    setAnimating(job.id);
    if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
    toggleTimeoutRef.current = setTimeout(async () => {
      try {
        const newStatus = job.status === 'done' ? 'scheduled' : 'done';
        await updateJobStatus(job.id, newStatus);

        // Update state outside the callback to avoid race condition
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));

        // Auto-regenerate recurring jobs (outside setJobs to avoid race)
        if (job.status !== 'done' && job.recurrence && job.recurrence !== 'none') {
          const nextDate = getNextDate(job.scheduled_date, job.recurrence);
          if (nextDate) {
            // Check if next occurrence already exists to prevent duplicates
            const alreadyExists = jobsRef.current.some(j =>
              j.client_id === job.client_id &&
              j.scheduled_date === nextDate &&
              j.title === job.title
            );
            const recLabel = RECURRENCE_OPTIONS.find(r => r.value === job.recurrence)?.label || job.recurrence;
            if (!alreadyExists) {
              createJob({
                client_id: job.client_id,
                title: job.title,
                scheduled_date: nextDate,
                scheduled_time: job.scheduled_time,
                duration_minutes: job.duration_minutes,
                recurrence: job.recurrence,
                route_order: 99,
                assigned_to: job.assigned_to || null,
              }).then(nextJob => {
                if (nextJob) setJobs(p => [...p, nextJob]);
                const clientName = job.clients?.name || tr('Job');
                setCompletedToast({ name: tr('{{client}} · Next {{recurrence}} job created', { client: clientName, recurrence: tr(recLabel) }), amount: job.clients?.rate || 0, type: 'recurring' });
                if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
                toggleTimeoutRef.current = setTimeout(() => setCompletedToast(null), 4000);
              }).catch(err => {
                console.error('failed to create recurring job:', err);
                const clientName = job.clients?.name || tr('Job');
                setCompletedToast({ name: tr('{{client}} · Failed to create recurring job', { client: clientName }), amount: 0, type: 'error' });
                if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
                toggleTimeoutRef.current = setTimeout(() => setCompletedToast(null), 4000);
              });
            } else {
              const clientName = job.clients?.name || tr('Job');
              setCompletedToast({ name: tr('{{client}} · {{label}} job already scheduled', { client: clientName, label: recLabel }), amount: job.clients?.rate || 0, type: 'recurring' });
            }
          } else {
            setCompletedToast({ name: job.clients?.name || tr('Job'), amount: job.clients?.rate || 0, type: 'recurring' });
          }
        } else if (job.status !== 'done') {
          setCompletedToast({ name: job.clients?.name || tr('Job'), amount: job.clients?.rate || 0, type: 'recurring' });
        }
        const toastTimeout = setTimeout(() => setCompletedToast(null), 4000);
        toggleTimeoutRef.current = toastTimeout;
      } catch (err) { console.error('toggleStatus:', err); }
      setAnimating(null);
    }, 150);
  }, [setJobs]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
    };
  }, []);

  // Drag-and-drop reordering
  function handleDragStart(job) { setDragId(job.id); }
  function handleDragOver(e, job) { e.preventDefault(); if (dragId && dragId !== job.id) setDragOverId(job.id); }
  // Shared date-scoped reorder — prevents cross-date corruption
  function reorderInPlace(updated, fromIdx, toIdx) {
    const [moved] = updated.splice(fromIdx, 1);
    // After splice, indices shift — adjust target when moving down
    const adjustedIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
    updated.splice(adjustedIdx, 0, moved);
  }

  function reorderWithinDate(prev, fromJobId, toJobId, currentDate) {
    const updated = [...prev];
    // Get date-scoped indices (relative to full array)
    const dateJobs = updated.filter(j => j.scheduled_date === currentDate);
    const dateJobIds = dateJobs.map(j => j.id);
    const fromPos = dateJobIds.indexOf(fromJobId);
    const toPos = dateJobIds.indexOf(toJobId);
    if (fromPos === -1 || toPos === -1 || fromPos === toPos) return null;
    // Map filtered indices back to full-array indices
    const fromFullIdx = updated.findIndex(j => j.id === fromJobId);
    const toFullIdx = updated.findIndex(j => j.id === toJobId);
    reorderInPlace(updated, fromFullIdx, toFullIdx);
    // Re-number route_order for jobs on this date only
    let order = 1;
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].scheduled_date === currentDate) {
        updated[i] = { ...updated[i], route_order: order++ };
      }
    }
    // Save previous order for rollback on failure
    const previousOrder = prev
      .filter(j => j.scheduled_date === currentDate)
      .map(j => ({ id: j.id, route_order: j.route_order }));

    const updates = updated
      .filter(j => j.scheduled_date === currentDate)
      .map(j => ({ id: j.id, route_order: j.route_order }));
    return { updated, updates, previousOrder };
  }

  function persistReorder(fromJobId, toJobId) {
    setJobs(prev => {
      const result = reorderWithinDate(prev, fromJobId, toJobId, date);
      if (!result) return prev;
      reorderJobs(result.updates).catch(err => {
        console.error('persistReorder: batch persist failed', err);
        setJobs(current => current.map(job => {
          const previous = result.previousOrder.find(item => item.id === job.id);
          return previous ? { ...job, route_order: previous.route_order } : job;
        }));
      });
      return result.updated;
    });
  }

  function handleDrop(job) {
    if (!dragId || dragId === job.id) { setDragId(null); setDragOverId(null); return; }
    void persistReorder(dragId, job.id);
    setDragId(null);
    setDragOverId(null);
  }
  function handleDragEnd() { setDragId(null); setDragOverId(null); }

  // Keyboard reordering — date-scoped via same reorderWithinDate helper
  function handleMoveUp(job) {
    const dateJobs = jobs.filter(j => j.scheduled_date === date);
    const pos = dateJobs.findIndex(j => j.id === job.id);
    if (pos <= 0) return;
    void persistReorder(job.id, dateJobs[pos - 1].id);
  }

  function handleMoveDown(job) {
    const dateJobs = jobs.filter(j => j.scheduled_date === date);
    const pos = dateJobs.findIndex(j => j.id === job.id);
    if (pos === -1 || pos >= dateJobs.length - 1) return;
    void persistReorder(job.id, dateJobs[pos + 1].id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <InvoiceToast toast={completedToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tr("Today")}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500 dark:text-gray-400">{tr('{{count}} job', { count: filtered.length })}</p>
            {doneCount > 0 && <><span className="text-gray-300 dark:text-gray-600">&middot;</span><span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{tr('{{count}} done', { count: doneCount })}</span></>}
            {filtered.some(j => j.recurrence && j.recurrence !== 'none') && (
              <><span className="text-gray-300 dark:text-gray-600">&middot;</span><span className="text-sm text-violet-600 dark:text-violet-400 font-medium inline-flex items-center gap-1"><Repeat className="w-3 h-3" />{tr("Recurring")}</span></>
            )}
          </div>
        </div>
        {!teamLoading && !isCrewMember && (
          <button onClick={() => setShowForm(!showForm)} disabled={saving} className="btn-primary gap-1.5"><Plus className="w-4 h-4" />{tr("New Job")}</button>
        )}
      </div>

      {/* Rain delay — always visible when there are incomplete jobs */}
      {filtered.some(j => j.status !== 'done') && (
        <div className="mb-5">
          <button
            onClick={() => {
              const toMove = filtered.filter(j => j.status !== 'done' && j.scheduled_date === date);
              if (toMove.length === 0) return;
              if (!window.confirm(tr('Move {{count}} job to tomorrow?', { count: toMove.length }))) return;
              const tomorrow = new Date(date);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
              const toMoveIds = new Set(toMove.map(j => j.id));
              // Optimistic update
              setJobs(prev => prev.map(j =>
                toMoveIds.has(j.id)
                  ? { ...j, scheduled_date: nextDate }
                  : j
              ));
              // Persist to server with rollback on failure
              Promise.allSettled(toMove.map(j => updateJob(j.id, { scheduled_date: nextDate })))
                .then(results => {
                  const failed = results.filter(r => r.status === 'rejected');
                  if (failed.length > 0) {
                    console.error('Rain delay: some jobs failed to move', failed.map(r => r.reason));
                    // Roll back only the jobs that actually failed
                    const failedIds = new Set(
                      toMove.filter((_, i) => results[i].status === 'rejected').map(j => j.id)
                    );
                    setJobs(prev => prev.map(j =>
                      failedIds.has(j.id) && j.scheduled_date === nextDate
                        ? { ...j, scheduled_date: date }
                        : j
                    ));
                    setCompletedToast({ name: tr('Failed to move {{count}} job', { count: failed.length }), amount: 0, type: 'rain' });
                  } else {
                    setCompletedToast({ name: tr('{{count}} job moved to tomorrow', { count: toMove.length }), amount: 0, type: 'rain' });
                  }
                  if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
                  toggleTimeoutRef.current = setTimeout(() => setCompletedToast(null), 3500);
                });
            }}
            className="w-full flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 rounded-xl px-3 py-3 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group min-h-[44px]"
          >
            <CloudRain className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 text-left min-w-0">
              <span className="font-semibold">{(todayRainChance() ?? 0)}%</span> {tr('chance of rain — move')}{' '}
              <span className="underline decoration-dotted underline-offset-2 group-hover:decoration-solid">
                {filtered.filter(j => j.status !== 'done' && j.scheduled_date === date).length} {tr('remaining to tomorrow')}
              </span>
            </span>
            <span className="text-[10px] bg-amber-200/50 dark:bg-amber-800/30 px-2 py-0.5 rounded-full font-bold flex-shrink-0">{tr("Move All")}</span>
          </button>
        </div>
      )}

      {/* Contextual AI quick-prompts */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { text: "What's next on my schedule?", label: "What's next?" },
          ...(filtered.some(j => j.status !== 'done')
            ? [{ text: "Move today's jobs to tomorrow", label: "Rain delay?" }]
            : []),
          ...(doneCount > 0
            ? [{ text: "Invoice completed jobs", label: "Invoice done jobs" }]
            : []),
          { text: "Show unpaid invoices", label: "Unpaid invoices" },
        ].slice(0, 4).map((prompt, i) => (
          <button
            key={i}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('mowgo:autopilot-send', { detail: { message: prompt.text } }));
            }}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-600 border border-transparent transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            {prompt.label}
          </button>
        ))}
      </div>

      {/* Date picker + progress */}
      <div className="flex items-center gap-3 mb-5">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label={tr("Select date")} className="input w-auto" />
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden"
             role="progressbar"
             aria-valuenow={doneCount}
             aria-valuemin={0}
             aria-valuemax={filtered.length || 1}
             aria-label={tr("Job completion progress")}>
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${filtered.length ? (doneCount / filtered.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Crew filter tabs — only when 2+ members */}
      {teamError && (
        <p className="mb-4 text-xs text-amber-700 dark:text-amber-400" role="status">{teamError}</p>
      )}
      {canManageCrew && teamMembers.length >= 2 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setCrewFilter(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              crewFilter === null
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tr("All")}
          </button>
          {teamMembers.map((m, i) => {
            const color = TEAM_MEMBER_COLORS[i % TEAM_MEMBER_COLORS.length];
            const isActive = crewFilter === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setCrewFilter(isActive ? null : m.id)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : `${color.bg} ${color.text} hover:opacity-80`
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white/70' : 'bg-current opacity-50'}`} />
                {(m.business_name || 'Unnamed').split(' ')[0]}
              </button>
            );
          })}
        </div>
      )}

      {/* Team Progress Dashboard — crew owners only */}
      {canManageCrew && teamDashboard.length > 0 && (
        <div className="card p-4 mb-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{tr("Team Progress")}</h3>
          <div className="space-y-2">
            {teamDashboard.map((member, i) => {
              const color = TEAM_MEMBER_COLORS[i % TEAM_MEMBER_COLORS.length];
              const pct = member.total > 0 ? Math.round((member.done / member.total) * 100) : 0;
              return (
                <div key={member.id} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${color.bg} ${color.text}`}>
                    {(member.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{member.name}</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{member.done}/{member.total} {tr("done")}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New job form */}
      {showForm && !isCrewMember && (
        <NewJobForm form={form} setForm={setForm} onSubmit={createJobHandler} onCancel={() => setShowForm(false)} saving={saving} clients={clients} teamMembers={!teamLoading && canManageCrew ? teamMembers : []} />
      )}

      {/* Job list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card p-10 text-center">
            <Circle aria-hidden="true" className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-semibold">{tr(crewFilter ? 'No jobs assigned' : 'No jobs scheduled')}</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{tr(crewFilter ? 'Choose All or another crew member.' : 'Tap + to add your first job')}</p>
          </div>
        )}
        {filtered.map((job, i) => (
          <JobCard
            key={job.id}
            job={job}
            index={i}
            isExpanded={expandedId === job.id}
            isAnimating={animating === job.id}
            isDragging={dragId === job.id}
            isDragOver={dragOverId === job.id}
            onToggleExpand={() => setExpandedId(expandedId === job.id ? null : job.id)}
            onToggleStatus={() => toggleStatus(job)}
            onDragStart={() => handleDragStart(job)}
            onDragOver={(e) => handleDragOver(e, job)}
            onDrop={() => handleDrop(job)}
            onDragEnd={handleDragEnd}
            onMoveUp={() => handleMoveUp(job)}
            onMoveDown={() => handleMoveDown(job)}
            teamMembers={teamMembers}
          />
        ))}
      </div>
    </div>
  );
}
