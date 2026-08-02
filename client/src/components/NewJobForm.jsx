import useLocalizedText from '../i18n/useLocalizedText';
import { Sparkles, RefreshCw, Users } from 'lucide-react';
import { demoClients } from '../lib/demoData';
import { RECURRENCE_OPTIONS, TEAM_MEMBER_COLORS } from '../lib/constants';

export default function NewJobForm({ form, setForm, onSubmit, onCancel, saving = false, clients, teamMembers }) {
  const { tr, t, i18n } = useLocalizedText('newJobForm');
  // Use real clients when provided, fall back to demo for demo mode
  const clientList = clients ?? demoClients;

  return (
    <form onSubmit={onSubmit} className="card p-5 mb-4 space-y-3 border-emerald-200 dark:border-emerald-800" style={{ animation: 'slideDown 0.2s ease-out' }}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-brand" />
        <span className="font-semibold text-sm text-[var(--color-text-primary)] dark:text-gray-300">{tr("New Job")}</span>
      </div>
      <div>
        <label className="label">{tr("Client")}</label>
        <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="select" required>
          <option value="">{tr("Select a client...")}</option>
          {clientList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">{tr("Job Title")}</label>
        <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tr("e.g. Full Service")} className="input" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{tr("Time")}</label>
          <input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">{tr("Duration")}</label>
          <select value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} className="select">
            <option value={30}>{tr("30 min")}</option>
            <option value={60}>{tr("1 hour")}</option>
            <option value={90}>{tr("1.5 hours")}</option>
            <option value={120}>{tr("2 hours")}</option>
            <option value={180}>{tr("3 hours")}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />{tr("Recurrence")}</label>
        <select value={form.recurrence || 'none'} onChange={e => setForm({ ...form, recurrence: e.target.value })} className="select">
          {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{tr(r.label)}</option>)}
        </select>
      </div>
      {/* Assignee dropdown — crew tier only */}
      {teamMembers && teamMembers.length > 0 && (
        <div>
          <label className="label flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{tr("Assign To")}</label>
          <select value={form.assigned_to || ''} onChange={e => setForm({ ...form, assigned_to: e.target.value || null })} className="select">
            <option value="">{tr("Unassigned")}</option>
            {teamMembers.map(m => (
              <option key={m.id} value={m.id}>
                {m.business_name || tr('Unnamed member')} ({tr(m.role === 'owner' ? 'Owner' : 'Crew')})
              </option>
            ))}
          </select>
          {form.assigned_to && (() => {
            const member = teamMembers.find(m => m.id === form.assigned_to);
            if (!member) return null;
            const idx = teamMembers.indexOf(member);
            const color = TEAM_MEMBER_COLORS[idx % TEAM_MEMBER_COLORS.length];
            return (
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                  <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                  {member.business_name || tr('Unnamed member')}
                </span>
              </div>
            );
          })()}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex-1">{tr(saving ? 'Adding...' : 'Add Job')}</button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary flex-1">{tr("Cancel")}</button>
      </div>
    </form>
  );
}
