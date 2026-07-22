import { useState, useRef } from 'react';
import { demoJobs, demoClients } from '../lib/demoData';
import { Plus, Check, Clock, Calendar, Sparkles } from 'lucide-react';

const statusConfig = {
  scheduled: { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', badge: 'badge-warning', label: 'Scheduled', dot: 'bg-amber-500' },
  in_progress: { bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800', badge: 'badge-info', label: 'In Progress', dot: 'bg-sky-500' },
  done: { bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', badge: 'badge-success', label: 'Done', dot: 'bg-emerald-500' },
};

export default function Schedule() {
  const [jobs, setJobs] = useState(demoJobs);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_id: '', title: 'Cleaning', scheduled_time: '09:00', duration_minutes: 120 });
  const [animating, setAnimating] = useState(null);

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
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: j.status === 'done' ? 'scheduled' : 'done' } : j));
      setAnimating(null);
    }, 150);
    return () => clearTimeout(id);
  }

  const filtered = date === new Date().toISOString().split('T')[0] ? jobs : jobs.filter(j => j.scheduled_date === date);
  const doneCount = filtered.filter(j => j.status === 'done').length;
  const today = new Date().toISOString().split('T')[0];
  const isToday = date === today;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Schedule</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</p>
            {doneCount > 0 && <><span className="text-gray-300 dark:text-gray-600">&middot;</span><span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{doneCount} done</span></>}
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary gap-1.5">
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* Date picker */}
      <div className="mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-auto" />
      </div>

      {/* New job form */}
      {showForm && (
        <form onSubmit={createJob} className="card p-5 mb-4 space-y-3 border-sky-200 dark:border-sky-800" style={{ animation: 'slideDown 0.2s ease-out' }}>
          <div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-sky-500" /><span className="font-semibold text-sm text-gray-700 dark:text-gray-300">New Job</span></div>
          <div>
            <label className="label">Client</label>
            <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="select" required>
              <option value="">Select a client...</option>
              {demoClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Time</label><input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} className="input" /></div>
            <div><label className="label">Duration</label><select value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} className="select"><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option><option value={180}>3 hours</option></select></div>
          </div>
          <div className="flex gap-2 pt-1"><button type="submit" className="btn-primary flex-1">Add Job</button><button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button></div>
        </form>
      )}

      {/* Job list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-10 text-center">
            <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-semibold">No jobs scheduled</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{isToday ? 'Your schedule is clear — tap + to add a job' : 'No jobs on this date'}</p>
          </div>
        )}
        {filtered.map(job => {
          const statusInfo = statusConfig[job.status] || statusConfig.scheduled;
          const isAnimating = animating === job.id;
          return (
            <div key={job.id} className={`card p-4 flex items-center gap-3 border transition-all duration-300 ${statusInfo.bg} ${isAnimating ? 'scale-[0.98] opacity-70' : ''}`}>
              <button aria-label="Toggle job status"
 onClick={() => toggleStatus(job)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${job.status === 'done' ? 'bg-emerald-500 border-emerald-500 scale-100' : 'border-gray-300 dark:border-gray-500 hover:border-emerald-400 hover:scale-110'}`}>
                {job.status === 'done' && <Check className="w-4 h-4 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold text-sm transition-all duration-300 ${job.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{job.clients?.name || 'Unknown Client'}</p>
                  <span className={statusInfo.badge}>{statusInfo.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{job.scheduled_time?.slice(0, 5)}</span>
                  <span className="text-gray-300 dark:text-gray-600 text-xs">&middot;</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{job.title}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
