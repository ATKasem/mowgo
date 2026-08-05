import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { INITIAL_JOB_FORM, RECURRENCE_OPTIONS, TEAM_MEMBER_COLORS } from '../lib/constants';
import { createJob, updateJobStatus, createInvoice, reorderJobs, loadClients, loadTeamMembers, loadProfile, loadTeamDashboard, rainDelayJobs, sendRainDelaySms, loadRainDelayHistory, saveRainDelayEntry, removeRainDelayEntry, getWeatherForLocation, ensureClientCoords } from '../lib/data';
import { optimizeRoute } from '../lib/optimizeRoute';
import { useSearchParams } from 'react-router-dom';
import { Plus, Circle, CloudRain, Repeat, Loader2, X, History, RotateCcw, Route as RouteIcon } from 'lucide-react';
import JobCard from '../components/JobCard';
import NewJobForm from '../components/NewJobForm';
import InvoiceToast from '../components/InvoiceToast';
import PhotoUpload from '../components/PhotoUpload';
import ReviewPrompt from '../components/ReviewPrompt';

/** Calculate the next occurrence date based on recurrence rule */
function getNextDate(currentDate, recurrence) {
  const d = new Date(currentDate + 'T12:00:00');
  switch (recurrence) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': {
      const origDay = d.getDate();
      d.setMonth(d.getMonth() + 1);
      // Clamp to last day of target month (handles 31st → Feb, etc.)
      if (d.getDate() !== origDay) d.setDate(0); // day 0 = last day of prev month
      break;
    }
    default: return null;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateString, days) {
  const value = new Date(`${dateString}T12:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
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
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [canManageCrew, setCanManageCrew] = useState(false);
  const [isCrewMember, setIsCrewMember] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [crewFilter, setCrewFilter] = useState(null); // null = show all
  const [teamDashboard, setTeamDashboard] = useState([]);
  const [photoModalJob, setPhotoModalJob] = useState(null); // job being photographed
  const [showRainDelay, setShowRainDelay] = useState(false);
  const [showRainHistory, setShowRainHistory] = useState(false);
  const [rainTargetMode, setRainTargetMode] = useState('tomorrow');
  const [customRainDate, setCustomRainDate] = useState('');
  const [selectedRainJobIds, setSelectedRainJobIds] = useState([]);
  const [rainHistory, setRainHistory] = useState([]);
  const [weather, setWeather] = useState(null);
  const [hasBusinessLocation, setHasBusinessLocation] = useState(null);
  const [rainDelaySaving, setRainDelaySaving] = useState(false);
  const [rainDelayError, setRainDelayError] = useState('');
  const toggleTimeoutRef = useRef(null);
  const statusToggleTimeoutsRef = useRef(new Map());
  const pendingRecurringRef = useRef(new Set());
  const jobsRef = useRef(jobs);
  const formRef = useRef(form);
  const [optimizing, setOptimizing] = useState(false);
  const [profile, setProfile] = useState(null);
  const routeUndoRef = useRef(null); // previousOrder snapshot for toast Undo

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { formRef.current = form; }, [form]);

  // Filtered jobs computed early for use in effects and render
  const dateFiltered = useMemo(() => jobs.filter(j => j.scheduled_date === date), [jobs, date]);
  const filtered = useMemo(() => crewFilter
    ? dateFiltered.filter(j => j.assigned_to === crewFilter)
    : dateFiltered, [dateFiltered, crewFilter]);
  const doneCount = useMemo(() => filtered.filter(j => j.status === 'done' || j.status === 'in_progress').length, [filtered]);
  const rainDelayCandidates = useMemo(() => dateFiltered.filter(j => j.status !== 'done'), [dateFiltered]);
  const tomorrow = useMemo(() => addDays(date, 1), [date]);

  useEffect(() => {
    let active = true;
    loadRainDelayHistory().then(items => { if (active) setRainHistory(items); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    loadProfile().then(profile => {
      if (!active) return;
      const lat = profile?.latitude ?? profile?.lat;
      const lng = profile?.longitude ?? profile?.lng;
      const hasLocation = lat != null && lng != null;
      setHasBusinessLocation(hasLocation);
      setProfile(profile);
      if (!hasLocation) return;
      getWeatherForLocation(lat, lng).then(result => { if (active) setWeather(result); });
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const weatherDays = useMemo(() => {
    if (!weather?.daily) return [];
    return weather.daily.time.map((day, index) => ({
      date: day,
      rain: weather.daily.precipitation_probability_max?.[index] ?? 0,
    }));
  }, [weather]);
  const todayWeatherDate = new Date().toLocaleDateString('en-CA');
  const tomorrowWeatherDate = addDays(todayWeatherDate, 1);
  const bannerWeather = weatherDays.find(item => item.date === todayWeatherDate && item.rain >= 60)
    || weatherDays.find(item => item.date === tomorrowWeatherDate && item.rain >= 60);
  const suggestedDryDate = weatherDays.find(item => item.date >= tomorrow && item.rain < 60)?.date || null;

  function openRainDelay() {
    const ids = rainDelayCandidates.map(job => job.id);
    if (!ids.length) return;
    setSelectedRainJobIds(ids);
    setRainTargetMode('tomorrow');
    setCustomRainDate(tomorrow);
    setRainDelayError('');
    setShowRainDelay(true);
  }

  async function undoRainDelay(entry) {
    const grouped = Object.entries(entry.originalDates || {}).reduce((groups, [jobId, originalDate]) => {
      (groups[originalDate] ||= []).push(jobId);
      return groups;
    }, {});
    if (!Object.keys(grouped).length) return;
    try {
      await Promise.all(Object.entries(grouped).map(([originalDate, ids]) => rainDelayJobs(ids, originalDate)));
      setJobs(prev => prev.map(job => entry.originalDates[job.id] ? { ...job, scheduled_date: entry.originalDates[job.id] } : job));
      const next = await removeRainDelayEntry(entry.createdAt);
      setRainHistory(next);
      setCompletedToast({ name: tr('{{count}} job restored', { count: entry.jobCount }), amount: 0, type: 'rain' });
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
      toggleTimeoutRef.current = setTimeout(() => setCompletedToast(null), 3500);
    } catch (error) {
      console.error('Rain delay undo:', error);
      setCompletedToast({ name: tr('Could not undo rain delay'), amount: 0, type: 'error' });
    }
  }

  async function applyRainDelay() {
    const targetDate = rainTargetMode === 'tomorrow' ? tomorrow : rainTargetMode === 'dry' ? suggestedDryDate : customRainDate;
    if (!targetDate || targetDate < tomorrow) {
      setRainDelayError(tr('Choose a date on or after tomorrow.'));
      return;
    }
    const jobsToMove = rainDelayCandidates.filter(job => selectedRainJobIds.includes(job.id));
    if (!jobsToMove.length) {
      setRainDelayError(tr('Select at least one job.'));
      return;
    }
    setRainDelaySaving(true);
    setRainDelayError('');
    const entry = {
      date,
      targetDate,
      jobIds: jobsToMove.map(job => job.id),
      jobCount: jobsToMove.length,
      createdAt: new Date().toISOString(),
      originalDates: Object.fromEntries(jobsToMove.map(job => [job.id, job.scheduled_date])),
    };
    try {
      await rainDelayJobs(entry.jobIds, targetDate);
      // Text affected clients (fire-and-forget — never blocks the UI).
      sendRainDelaySms(entry.jobIds, targetDate);
      setJobs(prev => prev.map(job => entry.jobIds.includes(job.id) ? { ...job, scheduled_date: targetDate } : job));
      const next = await saveRainDelayEntry(entry);
      setRainHistory(next);
      setShowRainDelay(false);
      setCompletedToast({
        name: tr('{{count}} job moved to {{date}}', { count: entry.jobCount, date: targetDate }),
        amount: 0,
        type: 'rain',
        actionLabel: tr('Undo'),
        onAction: () => { setCompletedToast(null); void undoRainDelay(entry); },
      });
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
      toggleTimeoutRef.current = setTimeout(() => setCompletedToast(null), 6000);
    } catch (error) {
      console.error('Rain delay:', error);
      setRainDelayError(tr('Could not move jobs. Try again.'));
    } finally {
      setRainDelaySaving(false);
    }
  }

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

  // Review prompt logic — show once after 10 completed jobs
  useEffect(() => {
    // Skip if user has disabled review prompts
    if (localStorage.getItem('mf_review_prompts') === 'false') return;
    // Skip if already shown
    if (localStorage.getItem('mf_review_prompt_shown') === 'true') return;

    const completedCount = parseInt(localStorage.getItem('mf_completed_jobs') || '0', 10);
    if (completedCount >= 10) {
      setShowReviewPrompt(true);
    }
  }, []);

  function handleReviewPromptClose() {
    setShowReviewPrompt(false);
    localStorage.setItem('mf_review_prompt_shown', 'true');
  }

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
    const pendingToggle = statusToggleTimeoutsRef.current.get(job.id);
    if (pendingToggle) clearTimeout(pendingToggle);
    const toggleTimeout = setTimeout(async () => {
      statusToggleTimeoutsRef.current.delete(job.id);
      try {
        const newStatus = job.status === 'scheduled' ? 'in_progress' : job.status === 'in_progress' ? 'done' : 'scheduled';
        await updateJobStatus(job.id, newStatus);
        // Auto-create invoice on completion (idempotent per job; skip $0 rates).
        let invoiceCreated = false;
        if (newStatus === 'done' && Number(job.clients?.rate || 0) > 0) {
          try {
            const { invoice: inv, created } = await createInvoice({
              client_id: job.client_id,
              clients: job.clients,
              amount: job.clients?.rate,
              job_id: job.id,
            });
            invoiceCreated = created;
            setInvoices(prev => prev.some(i => i.id === inv.id) ? prev : [inv, ...prev]);
          } catch (invErr) { console.error('Auto-invoice failed:', invErr); }
        }
        // Track completed jobs for review prompt
        if (newStatus === 'done' && localStorage.getItem('mf_review_prompts') !== 'false' && localStorage.getItem('mf_review_prompt_shown') !== 'true') {
          const prev = parseInt(localStorage.getItem('mf_completed_jobs') || '0', 10);
          const next = prev + 1;
          localStorage.setItem('mf_completed_jobs', String(next));
          if (next >= 10) {
            setTimeout(() => setShowReviewPrompt(true), 500);
          }
        }

        // Update state outside the callback to avoid race condition
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));

        // Show photo upload modal when completing a job
        if (newStatus === 'done') {
          setPhotoModalJob(job);
        }

        // Auto-regenerate recurring jobs (outside setJobs to avoid race)
        // Only generate next occurrence when job is newly completed
        if (newStatus === 'done' && job.recurrence && job.recurrence !== 'none') {
          const nextDate = getNextDate(job.scheduled_date, job.recurrence);
          if (nextDate) {
            // Check if next occurrence already exists to prevent duplicates
            const dedupeKey = `${job.client_id}:${nextDate}:${job.title}`;
            const alreadyExists = jobsRef.current.some(j =>
              j.client_id === job.client_id &&
              j.scheduled_date === nextDate &&
              j.title === job.title
            ) || pendingRecurringRef.current.has(dedupeKey);
            const recLabel = RECURRENCE_OPTIONS.find(r => r.value === job.recurrence)?.label || job.recurrence;
            if (!alreadyExists) {
              pendingRecurringRef.current.add(dedupeKey);
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
                pendingRecurringRef.current.delete(dedupeKey);
                if (nextJob) setJobs(p => [...p, nextJob]);
                const clientName = job.clients?.name || tr('Job');
                setCompletedToast({ name: tr('{{client}} · Next {{recurrence}} job created', { client: clientName, recurrence: tr(recLabel) }), amount: job.clients?.rate || 0, type: 'recurring' });
                if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
                toggleTimeoutRef.current = setTimeout(() => setCompletedToast(null), 4000);
              }).catch(err => {
                pendingRecurringRef.current.delete(dedupeKey);
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
            // Done (no recurrence): invoice toast only if one was actually created.
            setCompletedToast({
              name: job.clients?.name || tr('Job'),
              amount: invoiceCreated ? (job.clients?.rate || 0) : 0,
              type: invoiceCreated ? 'invoice' : 'plain',
            });
          }
        } else if (job.status !== 'done') {
          setCompletedToast({ name: job.clients?.name || tr('Job'), amount: 0, type: 'plain' });
        }
        const toastTimeout = setTimeout(() => setCompletedToast(null), 4000);
        toggleTimeoutRef.current = toastTimeout;
      } catch (err) { console.error('toggleStatus:', err); }
      setAnimating(null);
    }, 150);
    statusToggleTimeoutsRef.current.set(job.id, toggleTimeout);
  }, [setJobs]);

  // Clean up timeouts on unmount
  useEffect(() => {
    const statusToggleTimeouts = statusToggleTimeoutsRef.current;
    return () => {
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
      statusToggleTimeouts.forEach(clearTimeout);
      statusToggleTimeouts.clear();
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

  // Route Optimization v1 — paid tiers, whole-day owner view only
  // (route_order is date-wide: crew members / filtered views would reorder
  // other assignees' stops).
  const canOptimize = !loading && !isCrewMember && crewFilter === null
    && ['solo', 'crew', 'premium'].includes(profile?.tier)
    && dateFiltered.length >= 3
    && dateFiltered.filter(j => j.clients?.address).length >= 2;

  // Date-scoped renumber from an ordered id list — same rollback shape as
  // reorderWithinDate (previousOrder + updates).
  function reorderToSequence(prev, orderedIds, currentDate) {
    const updated = [...prev];
    const previousOrder = prev
      .filter(j => j.scheduled_date === currentDate)
      .map(j => ({ id: j.id, route_order: j.route_order }));
    const idSet = new Set(orderedIds);
    let order = 1;
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].scheduled_date === currentDate && idSet.has(updated[i].id)) {
        updated[i] = { ...updated[i], route_order: order++ };
      }
    }
    const updates = updated
      .filter(j => j.scheduled_date === currentDate && idSet.has(j.id))
      .map(j => ({ id: j.id, route_order: j.route_order }));
    return { updated, updates, previousOrder };
  }

  async function handleOptimize() {
    if (optimizing) return; // double-tap guard
    setOptimizing(true);
    try {
      const dayJobs = jobsRef.current.filter(j => j.scheduled_date === date);
      const coordsMap = await ensureClientCoords(dayJobs.map(j => j.clients).filter(Boolean));
      const anchor = profile?.latitude != null && profile?.longitude != null
        ? { lat: profile.latitude, lng: profile.longitude }
        : null;
      const positioned = dayJobs.map(j => ({
        id: j.id,
        lat: j.clients ? (coordsMap[j.clients.id]?.lat ?? null) : null,
        lng: j.clients ? (coordsMap[j.clients.id]?.lng ?? null) : null,
      }));
      const orderedIds = optimizeRoute(positioned, anchor);

      setJobs(prev => {
        const result = reorderToSequence(prev, orderedIds, date);
        if (!result) return prev;
        routeUndoRef.current = result.previousOrder;
        reorderJobs(result.updates).catch(err => {
          console.error('optimize persist failed:', err);
          setJobs(current => current.map(job => {
            const previous = result.previousOrder.find(item => item.id === job.id);
            return previous ? { ...job, route_order: previous.route_order } : job;
          }));
        });
        return result.updated;
      });

      setCompletedToast({
        name: tr('Route optimized'),
        amount: 0,
        type: 'plain',
        actionLabel: tr('Undo'),
        onAction: () => {
          const undo = routeUndoRef.current;
          if (!undo) return;
          routeUndoRef.current = null;
          setCompletedToast(null);
          reorderJobs(undo).catch(err => console.error('optimize undo failed:', err));
          setJobs(prev => prev.map(job => {
            const previous = undo.find(item => item.id === job.id);
            return previous ? { ...job, route_order: previous.route_order } : job;
          }));
        },
      });
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
      toggleTimeoutRef.current = setTimeout(() => setCompletedToast(null), 6000);
    } catch (err) {
      console.error('Optimize:', err);
      setCompletedToast({ name: tr('Could not optimize route. Try again.'), amount: 0, type: 'error' });
      setTimeout(() => setCompletedToast(null), 4000);
    } finally {
      setOptimizing(false);
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <InvoiceToast toast={completedToast} />
      <ReviewPrompt show={showReviewPrompt} onClose={handleReviewPromptClose} />
      {/* Header */}
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{tr("Today")}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr('{{count}} job', { count: filtered.length })}</p>
            {doneCount > 0 && <><span className="text-gray-300 dark:text-[var(--color-text-secondary)]">&middot;</span><span className="text-sm text-brand-hover dark:text-emerald-400 font-medium">{tr('{{count}} completed', { count: doneCount })}</span></>}
            {filtered.some(j => j.recurrence && j.recurrence !== 'none') && (
              <><span className="text-gray-300 dark:text-[var(--color-text-secondary)]">&middot;</span><span className="text-sm text-violet-600 dark:text-violet-400 font-medium inline-flex items-center gap-1"><Repeat className="w-3 h-3" />{tr("Recurring")}</span></>
            )}
          </div>
        </div>
        {canOptimize && (
          <button onClick={handleOptimize} disabled={optimizing} className="btn-secondary gap-1.5 text-sm disabled:opacity-50">
            <RouteIcon className="w-4 h-4" />{optimizing ? tr('Optimizing...') : tr('Optimize')}
          </button>
        )}
        {!teamLoading && !isCrewMember && (
          <button onClick={() => setShowForm(!showForm)} disabled={saving} className="btn-primary gap-1.5"><Plus className="w-4 h-4" />{tr("New Job")}</button>
        )}
      </div>

      {bannerWeather && rainDelayCandidates.length > 0 && (
        <button onClick={openRainDelay} className="w-full mb-5 flex items-center gap-2 bg-sky-50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/40 text-sky-800 dark:text-sky-300 rounded-xl px-3 py-2.5 text-xs font-medium hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors min-h-[44px]">
          <CloudRain className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">{tr('Rain {{pct}}% {{day}} — Rain delay?', { pct: bannerWeather.rain, day: bannerWeather.date === tomorrowWeatherDate ? tr('tomorrow') : tr('today') })}</span>
        </button>
      )}

      {rainDelayCandidates.length > 0 && (
        <div className="flex justify-end -mt-2 mb-3">
          <button onClick={openRainDelay} className="text-xs font-semibold text-brand-hover dark:text-[#4ade80] hover:underline inline-flex items-center gap-1"><CloudRain className="w-3.5 h-3.5" />{tr('Rain Delay')}</button>
        </div>
      )}

      {/* Date picker + progress */}
      <div className="flex items-center gap-3 mb-5">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label={tr("Select date")} className="input w-auto" />
        <div className="flex-1 bg-[var(--color-surface-secondary)] dark:bg-gray-800 rounded-full h-1.5 overflow-hidden"
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
                ? 'bg-brand text-white shadow-sm'
                : 'bg-[var(--color-surface-secondary)] dark:bg-gray-800 text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] dark:hover:bg-gray-700'
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
                    ? 'bg-brand text-white shadow-sm'
                    : `${color.bg} ${color.text} hover:opacity-80`
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[var(--color-surface)]/70' : 'bg-current opacity-50'}`} />
                {(m.business_name || 'Unnamed').split(' ')[0]}
              </button>
            );
          })}
        </div>
      )}

      {/* Team Progress Dashboard — crew owners only */}
      {canManageCrew && teamDashboard.length > 0 && (
        <div className="card p-4 mb-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300 mb-3">{tr("Team Progress")}</h3>
          <div className="space-y-2">
            {teamDashboard.map((member, i) => {
              const color = TEAM_MEMBER_COLORS[i % TEAM_MEMBER_COLORS.length];
              const completed = (member.done || 0) + (member.in_progress || 0);
              const pct = member.total > 0 ? Math.round((completed / member.total) * 100) : 0;
              return (
                <div key={member.id} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${color.bg} ${color.text}`}>
                    {(member.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[var(--color-text-primary)] dark:text-gray-300 truncate">{member.name}</span>
                      <span className="text-[11px] text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] flex-shrink-0 ml-2">{completed}/{member.total} {tr("completed")}</span>
                    </div>
                    <div className="w-full bg-[var(--color-surface-secondary)] dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
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
            <Circle aria-hidden="true" className="w-12 h-12 text-gray-300 dark:text-[var(--color-text-secondary)] mx-auto mb-4" />
            <p className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] font-semibold">{tr(crewFilter ? 'No jobs assigned' : 'No jobs scheduled')}</p>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] text-sm mt-1">{tr(crewFilter ? 'Choose All or another crew member.' : 'Tap + to add your first job')}</p>
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

      {showRainDelay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="rain-delay-title">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRainDelay(false)} />
          <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[var(--color-surface)] dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border border-[var(--color-border)] dark:border-gray-700">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div><h3 id="rain-delay-title" className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white">{tr('Rain Delay')}</h3><p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('{{count}} affected job', { count: selectedRainJobIds.length })}</p></div>
              <button aria-label={tr('Close')} onClick={() => setShowRainDelay(false)} className="p-2 -m-2 text-[var(--color-text-muted)]"><X className="w-5 h-5" /></button>
            </div>

            {hasBusinessLocation === false && (
              <p className="text-xs text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/30 rounded-xl p-3 mb-4">{tr('Add your business location in Settings to see local rain forecasts.')}</p>
            )}

            <div className="space-y-2 mb-5">
              <p className="label">{tr('Jobs to move')}</p>
              {rainDelayCandidates.map(job => (
                <label key={job.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] dark:border-gray-700 p-3 cursor-pointer">
                  <input type="checkbox" checked={selectedRainJobIds.includes(job.id)} onChange={() => setSelectedRainJobIds(ids => ids.includes(job.id) ? ids.filter(id => id !== job.id) : [...ids, job.id])} className="accent-[#4ade80]" />
                  <span className="text-sm text-[var(--color-text-primary)] dark:text-gray-200 truncate">{job.clients?.name || job.title || tr('Job')}</span>
                </label>
              ))}
            </div>

            <fieldset className="space-y-2 mb-4">
              <legend className="label mb-2">{tr('Move to')}</legend>
              <label className="flex items-center gap-3"><input type="radio" name="rain-target" checked={rainTargetMode === 'tomorrow'} onChange={() => setRainTargetMode('tomorrow')} className="accent-[#4ade80]" /><span className="text-sm">{tr('Tomorrow')} · {tomorrow}</span></label>
              <label className="flex items-center gap-3"><input type="radio" name="rain-target" checked={rainTargetMode === 'custom'} onChange={() => setRainTargetMode('custom')} className="accent-[#4ade80]" /><span className="text-sm">{tr('Pick a date')}</span></label>
              {rainTargetMode === 'custom' && <input type="date" min={tomorrow} value={customRainDate} onChange={event => setCustomRainDate(event.target.value)} className="input mt-2" />}
              {suggestedDryDate && <label className="flex items-center gap-3"><input type="radio" name="rain-target" checked={rainTargetMode === 'dry'} onChange={() => setRainTargetMode('dry')} className="accent-[#4ade80]" /><span className="text-sm">{tr('Next dry day')} · {suggestedDryDate}</span></label>}
            </fieldset>

            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-secondary)] dark:bg-gray-800 rounded-xl p-3 mb-4">{tr('Only {{count}} jobs move. Your schedule stays intact.', { count: selectedRainJobIds.length })}</p>
            {rainDelayError && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-3">{rainDelayError}</p>}
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowRainDelay(false); setShowRainHistory(true); }} className="btn-secondary gap-1.5"><History className="w-4 h-4" />{tr('History')}</button>
              <button disabled={rainDelaySaving || selectedRainJobIds.length === 0} onClick={applyRainDelay} className="btn-primary flex-1 disabled:opacity-50">{rainDelaySaving ? tr('Moving...') : tr('Move {{count}} job', { count: selectedRainJobIds.length })}</button>
            </div>
          </div>
        </div>
      )}

      {showRainHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="rain-history-title">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRainHistory(false)} />
          <div className="relative w-full sm:max-w-md max-h-[80vh] overflow-y-auto bg-[var(--color-surface)] dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border border-[var(--color-border)] dark:border-gray-700">
            <div className="flex justify-between items-center mb-4"><h3 id="rain-history-title" className="text-lg font-bold">{tr('Rain Delay History')}</h3><button aria-label={tr('Close')} onClick={() => setShowRainHistory(false)}><X className="w-5 h-5" /></button></div>
            {rainHistory.length === 0 ? <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">{tr('No rain delays yet.')}</p> : <div className="space-y-3">{rainHistory.map(entry => (
              <div key={entry.createdAt} className="border border-[var(--color-border)] dark:border-gray-700 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{entry.date} → {entry.targetDate}</p><p className="text-xs text-[var(--color-text-muted)]">{tr('{{count}} job', { count: entry.jobCount })}</p></div>
                <button disabled={!entry.originalDates} onClick={() => void undoRainDelay(entry)} className="btn-secondary text-xs gap-1 disabled:opacity-40"><RotateCcw className="w-3.5 h-3.5" />{tr('Undo')}</button>
              </div>
            ))}</div>}
          </div>
        </div>
      )}

      {/* Photo upload modal — shown after marking a job complete */}
      {photoModalJob && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPhotoModalJob(null)} />
          <div className="relative w-full sm:max-w-sm bg-[var(--color-surface)] dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border border-[var(--color-border)] dark:border-gray-700" style={{ animation: 'slideUp 0.2s ease-out' }}>
            <h3 className="text-base font-bold text-[var(--color-text-primary)] dark:text-white mb-1">{tr('Add Photo')}</h3>
            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mb-4">
              {photoModalJob.clients?.name || tr('Job')}
            </p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <PhotoUpload jobId={photoModalJob.id} type="after" onUploaded={() => {}} />
              <PhotoUpload jobId={photoModalJob.id} type="before" onUploaded={() => {}} />
            </div>
            <button
              onClick={() => setPhotoModalJob(null)}
              className="w-full btn-primary"
            >
              {tr('Done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
