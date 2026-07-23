import { useState, useEffect, useMemo, useCallback } from 'react';
import { INITIAL_JOB_FORM, RECURRENCE_OPTIONS } from '../lib/constants';
import { createJob, updateJobStatus, updateJob, loadClients } from '../lib/data';
import { Plus, Circle, CloudRain, Repeat, Loader2 } from 'lucide-react';
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
  return d.toISOString().split('T')[0];
}

export default function Today({ jobs, setJobs, invoices, setInvoices, loading }) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_JOB_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [animating, setAnimating] = useState(null);
  const [completedToast, setCompletedToast] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Load clients for the NewJobForm dropdown
  useEffect(() => { loadClients().then(setClients).catch(() => {}); }, []);

  const createJobHandler = useCallback(async (e) => {
    e.preventDefault();
    if (!form.client_id) return;
    setSaving(true);
    try {
      const newJob = await createJob({ ...form, scheduled_date: date, route_order: jobs.filter(j => j.scheduled_date === date).length + 1 });
      if (newJob) {
        setJobs(prev => [newJob, ...prev]);
      }
    } catch (err) { console.error('createJob:', err); }
    setSaving(false);
    setShowForm(false);
    setForm(INITIAL_JOB_FORM);
  }, [form, date, jobs, setJobs]);

  const toggleStatus = useCallback(async (job) => {
    setAnimating(job.id);
    setTimeout(async () => {
      try {
        const newStatus = job.status === 'done' ? 'scheduled' : 'done';
        await updateJobStatus(job.id, newStatus);

        // Update state outside the callback to avoid race condition
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));

        // Auto-regenerate recurring jobs (outside setJobs to avoid race)
        if (job.status !== 'done' && job.recurrence && job.recurrence !== 'none') {
          const nextDate = getNextDate(job.scheduled_date, job.recurrence);
          if (nextDate) {
            const recLabel = RECURRENCE_OPTIONS.find(r => r.value === job.recurrence)?.label || job.recurrence;
            createJob({
              client_id: job.client_id,
              title: job.title,
              scheduled_date: nextDate,
              scheduled_time: job.scheduled_time,
              duration_minutes: job.duration_minutes,
              recurrence: job.recurrence,
              route_order: 99,
            }).then(nextJob => {
              if (nextJob) setJobs(p => [...p, nextJob]);
            });
            setCompletedToast({ name: `${job.clients?.name} · Next ${recLabel} job created`, amount: job.clients?.rate });
          } else {
            setCompletedToast({ name: job.clients?.name, amount: job.clients?.rate });
          }
        } else if (job.status !== 'done') {
          setCompletedToast({ name: job.clients?.name, amount: job.clients?.rate });
        }
        setTimeout(() => setCompletedToast(null), 4000);
      } catch (err) { console.error('toggleStatus:', err); }
      setAnimating(null);
    }, 150);
  }, [setJobs]);

  // Drag-and-drop reordering
  function handleDragStart(job) { setDragId(job.id); }
  function handleDragOver(e, job) { e.preventDefault(); if (dragId && dragId !== job.id) setDragOverId(job.id); }
  // Shared date-scoped reorder — prevents cross-date corruption
  function reorderInPlace(updated, fromIdx, toIdx) {
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
  }

  function reorderWithinDate(prev, fromJobId, toJobId, currentDate) {
    const updated = [...prev];
    // Get date-scoped indices (relative to full array)
    const dateJobs = updated.filter(j => j.scheduled_date === currentDate);
    const dateJobIds = dateJobs.map(j => j.id);
    const fromPos = dateJobIds.indexOf(fromJobId);
    const toPos = dateJobIds.indexOf(toJobId);
    if (fromPos === -1 || toPos === -1 || fromPos === toPos) return prev;
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
    // Persist reordered jobs
    updated.forEach(j => {
      if (j.scheduled_date === currentDate) {
        updateJob(j.id, { route_order: j.route_order }).catch(() => {});
      }
    });
    return updated;
  }

  function handleDrop(job) {
    if (!dragId || dragId === job.id) { setDragId(null); setDragOverId(null); return; }
    setJobs(prev => reorderWithinDate(prev, dragId, job.id, date));
    setDragId(null);
    setDragOverId(null);
  }
  function handleDragEnd() { setDragId(null); setDragOverId(null); }

  // Keyboard reordering — date-scoped via same reorderWithinDate helper
  function handleMoveUp(job) {
    const dateJobs = jobs.filter(j => j.scheduled_date === date);
    const pos = dateJobs.findIndex(j => j.id === job.id);
    if (pos <= 0) return;
    setJobs(prev => reorderWithinDate(prev, job.id, dateJobs[pos - 1].id, date));
  }

  function handleMoveDown(job) {
    const dateJobs = jobs.filter(j => j.scheduled_date === date);
    const pos = dateJobs.findIndex(j => j.id === job.id);
    if (pos === -1 || pos >= dateJobs.length - 1) return;
    setJobs(prev => reorderWithinDate(prev, job.id, dateJobs[pos + 1].id, date));
  }

  const filtered = date === today ? jobs : jobs.filter(j => j.scheduled_date === date);
  const doneCount = filtered.filter(j => j.status === 'done').length;

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Today</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</p>
            {doneCount > 0 && <><span className="text-gray-300 dark:text-gray-600">&middot;</span><span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{doneCount} done</span></>}
            {filtered.some(j => j.recurrence && j.recurrence !== 'none') && (
              <><span className="text-gray-300 dark:text-gray-600">&middot;</span><span className="text-sm text-violet-600 dark:text-violet-400 font-medium inline-flex items-center gap-1"><Repeat className="w-3 h-3" />Recurring</span></>
            )}
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} disabled={saving} className="btn-primary gap-1.5"><Plus className="w-4 h-4" />New Job</button>
      </div>

      {/* Rain delay */}
      {filtered.some(j => j.status !== 'done') && (
        <div className="mb-4">
          <button
            onClick={() => {
              const tomorrow = new Date(date);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const nextDate = tomorrow.toISOString().split('T')[0];
              const toMove = filtered.filter(j => j.status !== 'done');
              Promise.allSettled(toMove.map(j => updateJob(j.id, { scheduled_date: nextDate })))
                .then(results => {
                  const failed = results.filter(r => r.status === 'rejected');
                  if (failed.length > 0) {
                    console.error('Rain delay: some jobs failed to move', failed.map(r => r.reason));
                    setCompletedToast({ name: `${failed.length} of ${toMove.length} jobs failed to move`, amount: 0, type: 'error' });
                    setTimeout(() => setCompletedToast(null), 4000);
                  }
                });
              setJobs(prev => prev.map(j =>
                j.status !== 'done' && j.scheduled_date === date
                  ? { ...j, scheduled_date: nextDate }
                  : j
              ));
              setCompletedToast({ name: `${toMove.length} jobs moved to tomorrow`, amount: 0, type: 'rain' });
              setTimeout(() => setCompletedToast(null), 3500);
            }}
            className="w-full flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            <CloudRain className="w-4 h-4" /> Rain Delay — move remaining to tomorrow
          </button>
        </div>
      )}

      {/* Date picker + progress */}
      <div className="flex items-center gap-3 mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Select date" className="input w-auto" />
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden"
             role="progressbar"
             aria-valuenow={doneCount}
             aria-valuemin={0}
             aria-valuemax={filtered.length || 1}
             aria-label="Job completion progress">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${filtered.length ? (doneCount / filtered.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* New job form */}
      {showForm && (
        <NewJobForm form={form} setForm={setForm} onSubmit={createJobHandler} onCancel={() => setShowForm(false)} saving={saving} clients={clients} />
      )}

      {/* Job list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card p-10 text-center">
            <Circle aria-hidden="true" className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-semibold">No jobs scheduled</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Tap + to add your first job</p>
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
          />
        ))}
      </div>
    </div>
  );
}
