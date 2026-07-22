import { useState } from 'react';
import { demoJobs, demoClients, demoInvoices } from '../lib/demoData';
import { Plus, Check, Clock, MapPin, Key, PawPrint, StickyNote, Navigation, AlarmCheck, Sparkles, Circle } from 'lucide-react';

const STATUS_CONFIG = {
  scheduled: { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', badge: 'badge-warning', label: 'Scheduled', dot: 'bg-amber-500' },
  in_progress: { bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800', badge: 'badge-info', label: 'In Progress', dot: 'bg-sky-500' },
  done: { bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', badge: 'badge-success', label: 'Done', dot: 'bg-emerald-500' },
};

export default function Today({ invoices, setInvoices }) {
  const [jobs, setJobs] = useState(demoJobs);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_id: '', title: 'Cleaning', scheduled_time: '09:00', duration_minutes: 120 });
  const [expandedId, setExpandedId] = useState(null);
  const [animating, setAnimating] = useState(null);
  const [completedToast, setCompletedToast] = useState(null);

  function createJob(e) {
    e.preventDefault();
    const client = demoClients.find(c => c.id === form.client_id);
    const newJob = { id: String(Date.now()), ...form, scheduled_date: date, status: 'scheduled', route_order: jobs.length + 1, clients: client };
    setJobs([newJob, ...jobs]);
    setShowForm(false);
    setForm({ client_id: '', title: 'Cleaning', scheduled_time: '09:00', duration_minutes: 120 });
  }

  function toggleStatus(job) {
    setAnimating(job.id);
    const id = setTimeout(() => {
      setJobs(prev => {
        const updated = prev.map(j => {
          if (j.id !== job.id) return j;
          const newStatus = j.status === 'done' ? 'scheduled' : 'done';
          return { ...j, status: newStatus };
        });
        return updated;
      });
      setAnimating(null);
      // Auto-create invoice when completing
      if (job.status !== 'done') {
        const newInvoice = {
          id: String(Date.now()),
          clients: job.clients,
          amount: job.clients?.rate || 0,
          status: 'unpaid',
          created_at: new Date().toISOString(),
        };
        if (setInvoices) setInvoices(prev => [newInvoice, ...prev]);
        setCompletedToast({ name: job.clients?.name, amount: job.clients?.rate });
        setTimeout(() => setCompletedToast(null), 3000);
      }
    }, 150);
  }

  const filtered = date === new Date().toISOString().split('T')[0] ? jobs : jobs.filter(j => j.scheduled_date === date);
  const doneCount = filtered.filter(j => j.status === 'done').length;

  return (
    <div>
      {/* Toast */}
      {completedToast && (
        <div className="fixed top-4 inset-x-0 z-30 flex justify-center pointer-events-none" style={{ animation: 'slideDown 0.3s ease-out' }}>
          <div className="card bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center gap-2 pointer-events-auto shadow-lg">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Invoice created for {completedToast.name}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">${completedToast.amount} — unpaid</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Today</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</p>
            {doneCount > 0 && <><span className="text-gray-300 dark:text-gray-600">&middot;</span><span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{doneCount} done</span></>}
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary gap-1.5"><Plus className="w-4 h-4" />New Job</button>
      </div>

      {/* Date picker + progress */}
      <div className="flex items-center gap-3 mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-auto" />
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${filtered.length ? (doneCount / filtered.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* New job form */}
      {showForm && (
        <form onSubmit={createJob} className="card p-5 mb-4 space-y-3 border-sky-200 dark:border-sky-800" style={{ animation: 'slideDown 0.2s ease-out' }}>
          <div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-sky-500" /><span className="font-semibold text-sm text-gray-700 dark:text-gray-300">New Job</span></div>
          <div><label className="label">Client</label><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="select" required><option value="">Select a client...</option>{demoClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Time</label><input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} className="input" /></div><div><label className="label">Duration</label><select value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} className="select"><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option><option value={180}>3 hours</option></select></div></div>
          <div className="flex gap-2 pt-1"><button type="submit" className="btn-primary flex-1">Add Job</button><button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button></div>
        </form>
      )}

      {/* Job list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card p-10 text-center">
            <Circle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-semibold">No jobs scheduled</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Tap + to add your first job</p>
          </div>
        )}
        {filtered.map((job, i) => {
          const client = job.clients;
          const isExpanded = expandedId === job.id;
          const isAnimating = animating === job.id;
          const isDone = job.status === 'done';
          const statusInfo = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;

          return (
            <div key={job.id} className={`card transition-all duration-300 ${isAnimating ? 'scale-[0.98] opacity-70' : ''} ${isDone ? 'opacity-70' : ''}`}>
              {/* Main row */}
              <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : job.id)}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Stop number */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400'}`}>
                    {isDone ? <Check className="w-5 h-5" /> : <span>{i + 1}</span>}
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

                {/* Mark Done button — always visible */}
                <button
                  aria-label="Mark job complete"
                  onClick={e => { e.stopPropagation(); toggleStatus(job); }}
                  className={`flex-shrink-0 w-28 text-center text-xs font-bold px-3 py-2.5 rounded-xl transition-all duration-200 shadow-sm ${isDone ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : isAnimating ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800'}`}
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
                      onClick={e => { e.stopPropagation(); toggleStatus(job); }}
                      className={`flex-1 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'btn-primary'}`}
                    >
                      {isDone ? <span className="flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" />Completed</span> : 'Mark Complete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
