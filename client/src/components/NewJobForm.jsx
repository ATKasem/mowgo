import { Sparkles, RefreshCw } from 'lucide-react';
import { demoClients } from '../lib/demoData';
import { RECURRENCE_OPTIONS } from '../lib/constants';

export default function NewJobForm({ form, setForm, onSubmit, onCancel, saving = false }) {
  return (
    <form onSubmit={onSubmit} className="card p-5 mb-4 space-y-3 border-emerald-200 dark:border-emerald-800" style={{ animation: 'slideDown 0.2s ease-out' }}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-emerald-500" />
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">New Job</span>
      </div>
      <div>
        <label className="label">Client</label>
        <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="select" required>
          <option value="">Select a client...</option>
          {demoClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Job Title</label>
        <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Mow + Edge" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Time</label>
          <input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Duration</label>
          <select value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} className="select">
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Recurrence</label>
        <select value={form.recurrence || 'none'} onChange={e => setForm({ ...form, recurrence: e.target.value })} className="select">
          {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Adding...' : 'Add Job'}</button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary flex-1">Cancel</button>
      </div>
    </form>
  );
}
