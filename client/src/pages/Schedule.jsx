import { useState } from 'react';
import { demoJobs, demoClients } from '../lib/demoData';
import { Plus, Check, Circle, Clock, ChevronDown } from 'lucide-react';

const statusConfig = {
  scheduled: { bg: 'bg-amber-50 border-amber-200', badge: 'badge-warning', label: 'Scheduled' },
  in_progress: { bg: 'bg-sky-50 border-sky-200', badge: 'badge-info', label: 'In Progress' },
  done: { bg: 'bg-emerald-50 border-emerald-200', badge: 'badge-success', label: 'Done' },
};

export default function Schedule() {
  const [jobs, setJobs] = useState(demoJobs);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_id: '', title: 'Cleaning', scheduled_time: '09:00', duration_minutes: 120 });

  function createJob(e) {
    e.preventDefault();
    const client = demoClients.find(c => c.id === form.client_id);
    setJobs([...jobs, { id: String(Date.now()), ...form, scheduled_date: date, status: 'scheduled', route_order: jobs.length + 1, clients: client }]);
    setShowForm(false);
  }

  function toggleStatus(job) {
    setJobs(jobs.map(j => j.id === job.id ? { ...j, status: j.status === 'done' ? 'scheduled' : 'done' } : j));
  }

  const filtered = date === new Date().toISOString().split('T')[0] ? jobs : jobs.filter(j => j.scheduled_date === date);
  const doneCount = filtered.filter(j => j.status === 'done').length;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Schedule</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} job{filtered.length !== 1 ? 's' : ''} &middot; {doneCount} done
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* Date picker */}
      <div className="mb-4">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input w-auto"
        />
      </div>

      {/* New job form */}
      {showForm && (
        <form onSubmit={createJob} className="card p-4 mb-4 space-y-3 animate-[fadeIn_0.2s_ease-out]">
          <div>
            <label className="label">Client</label>
            <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="select" required>
              <option value="">Select a client...</option>
              {demoClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Time</label>
              <input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Duration</label>
              <select value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} className="select">
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1">Add Job</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      )}

      {/* Job list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-8 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No jobs scheduled</p>
            <p className="text-gray-400 text-sm mt-1">Add your first job to get started</p>
          </div>
        )}
        {filtered.map(job => {
          const config = statusConfig[job.status] || statusConfig.scheduled;
          return (
            <div key={job.id} className={`card p-4 flex items-center gap-3 border ${config.bg}`}>
              <button
                onClick={() => toggleStatus(job)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  job.status === 'done'
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-gray-300 hover:border-emerald-400'
                }`}
              >
                {job.status === 'done' && <Check className="w-4 h-4 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${job.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {job.clients?.name || 'Unknown Client'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {job.scheduled_time?.slice(0, 5)}
                  </span>
                  <span className="text-xs text-gray-400">&middot;</span>
                  <span className="text-xs text-gray-500">{job.title}</span>
                  <span className={config.badge}>{config.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
