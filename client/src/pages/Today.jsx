import { useState, useMemo, useCallback } from 'react';
import { demoClients } from '../lib/demoData';
import { INITIAL_JOB_FORM } from '../lib/constants';
import { Plus, Circle, CloudRain } from 'lucide-react';
import JobCard from '../components/JobCard';
import NewJobForm from '../components/NewJobForm';
import InvoiceToast from '../components/InvoiceToast';

export default function Today({ jobs, setJobs, invoices, setInvoices }) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_JOB_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [animating, setAnimating] = useState(null);
  const [completedToast, setCompletedToast] = useState(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const createJob = useCallback((e) => {
    e.preventDefault();
    if (!form.client_id) return;
    const client = demoClients.find(c => c.id === form.client_id);
    setJobs(prev => {
      const newJob = {
        id: String(Date.now()),
        ...form,
        scheduled_date: date,
        status: 'scheduled',
        route_order: prev.length + 1,
        clients: client,
      };
      return [newJob, ...prev];
    });
    setShowForm(false);
    setForm(INITIAL_JOB_FORM);
  }, [form, date, setJobs]);

  const toggleStatus = useCallback((job) => {
    setAnimating(job.id);
    setTimeout(() => {
      setJobs(prev => prev.map(j => {
        if (j.id !== job.id) return j;
        const newStatus = j.status === 'done' ? 'scheduled' : 'done';
        return { ...j, status: newStatus };
      }));
      setAnimating(null);
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
  }, [setJobs, setInvoices]);

  const filtered = date === today ? jobs : jobs.filter(j => j.scheduled_date === date);
  const doneCount = filtered.filter(j => j.status === 'done').length;

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
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary gap-1.5"><Plus className="w-4 h-4" />New Job</button>
      </div>

      {/* Rain delay */}
      {filtered.some(j => j.status !== 'done') && (
        <div className="mb-4">
          <button
            onClick={() => {
              const tomorrow = new Date(date);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const nextDate = tomorrow.toISOString().split('T')[0];
              setJobs(prev => prev.map(j =>
                j.status !== 'done' && j.scheduled_date === date
                  ? { ...j, scheduled_date: nextDate }
                  : j
              ));
              setCompletedToast({ name: `${filtered.filter(j => j.status !== 'done').length} jobs moved to tomorrow`, amount: 0, type: 'rain' });
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
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${filtered.length ? (doneCount / filtered.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* New job form */}
      {showForm && (
        <NewJobForm form={form} setForm={setForm} onSubmit={createJob} onCancel={() => setShowForm(false)} />
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
            onToggleExpand={() => setExpandedId(expandedId === job.id ? null : job.id)}
            onToggleStatus={() => toggleStatus(job)}
          />
        ))}
      </div>
    </div>
  );
}
