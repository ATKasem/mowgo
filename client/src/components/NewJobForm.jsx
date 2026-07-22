import { Sparkles } from 'lucide-react';
import { demoClients } from '../lib/demoData';

export default function NewJobForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="card p-5 mb-4 space-y-3 border-sky-200 dark:border-sky-800" style={{ animation: 'slideDown 0.2s ease-out' }}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-sky-500" />
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">New Job</span>
      </div>
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
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
      </div>
    </form>
  );
}
