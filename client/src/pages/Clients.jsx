import useLocalizedText from '../i18n/useLocalizedText';
import i18n from '../i18n';
import { useState, useEffect, useMemo, useRef } from 'react';
import { loadClients, createClient, updateClient, deleteClient } from '../lib/data';
import { INITIAL_CLIENT_FORM } from '../lib/constants';
import { Search, Plus, Pencil, Trash2, MapPin, Phone, Mail, Key, AlarmCheck, PawPrint, StickyNote, ChevronRight, Users, Filter, Navigation, Clock, Calendar, Loader2 } from 'lucide-react';
import { getMapsUrl } from '../lib/maps';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const avatarColors = ['bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'rate-desc', label: 'Rate ↓' },
  { value: 'rate-asc', label: 'Rate ↑' },
];

export default function Clients({ jobs = [] }) {
  const { tr, t, i18n } = useLocalizedText('clients');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(INITIAL_CLIENT_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [showSort, setShowSort] = useState(false);
  const [saving, setSaving] = useState(false);
  const sortRef = useRef(null);

  useEffect(() => {
    loadClients().then(data => { setClients(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Close sort dropdown on click outside (handles touch devices)
  useEffect(() => {
    if (!showSort) return;
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSort(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showSort]);

  function openNew() { setEditId(null); setForm(INITIAL_CLIENT_FORM); setExpandedId(null); setShowForm(true); }
  function openEdit(client) { setEditId(client.id); setForm({ ...client }); setExpandedId(null); setShowForm(true); }

  const [clientError, setClientError] = useState('');

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setClientError('');
    try {
      if (editId) {
        const updated = await updateClient(editId, form);
        setClients(prev => prev.map(c => c.id === editId ? { ...c, ...updated } : c));
      } else {
        const created = await createClient(form);
        setClients(prev => [...prev, created]);
      }
      setShowForm(false);
      setEditId(null);
    } catch (err) {
      console.error('save client:', err);
      setClientError(err.message || tr('Failed to save client. Please try again.'));
    }
    setSaving(false);
  }

  async function remove(id) {
    const client = clients.find(c => c.id === id);
    if (!window.confirm(tr('Delete {{name}} and all their jobs? This cannot be undone.', { name: client?.name || tr('this client') }))) return;
    try {
      await deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error('remove client:', err);
    }
  }

  const clientMeta = useMemo(() => {
    const map = {};
    clients.forEach(c => {
      const clientJobs = jobs.filter(j => j.client_id === c.id).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
      const upcoming = clientJobs.filter(j => j.status !== 'done' && j.scheduled_date >= new Date().toISOString().split('T')[0]);
      const recentDone = clientJobs.filter(j => j.status === 'done').slice(-3);
      map[c.id] = { nextJob: upcoming[0] || null, totalJobs: clientJobs.length, recentDone };
    });
    return map;
  }, [clients, jobs]);

  const filtered = useMemo(() => {
    let list = clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(search.toLowerCase())
    );
    switch (sortBy) {
      case 'rate-desc': list.sort((a, b) => (b.rate || 0) - (a.rate || 0)); break;
      case 'rate-asc': list.sort((a, b) => (a.rate || 0) - (b.rate || 0)); break;
      default: list.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return list;
  }, [clients, search, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-white">{tr("Clients")}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{tr("{{count}} total", { count: clients.length })}</p></div>
        <button onClick={openNew} disabled={saving} className="btn-primary gap-1.5"><Plus className="w-4 h-4" />{tr("Add Client")}</button>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder={tr("Search by name or address...")} aria-label={tr("Search clients")} value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" /></div>
        <div className="relative" ref={sortRef} style={{ overflow: 'visible' }}>
          <button onClick={() => setShowSort(!showSort)} className="btn-secondary h-full px-3 gap-1" aria-label={tr("Sort clients")}><Filter className="w-4 h-4" /></button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 card p-1 z-20 min-w-[140px] shadow-lg"
                 onMouseLeave={() => setShowSort(false)}
                 onKeyDown={e => { if (e.key === 'Escape') { setShowSort(false); } }}
                 onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowSort(false); }}>
              {SORT_OPTIONS.map(o => (
                <button key={o.value} onClick={() => { setSortBy(o.value); setShowSort(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] ${sortBy === o.value ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{tr(o.label)}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="card p-5 mb-4 space-y-3 border-emerald-200 dark:border-emerald-800" style={{ animation: 'slideDown 0.2s ease-out' }}>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{tr(editId ? 'Edit Client' : 'New Client')}</h3>
          {clientError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
              {clientError}
            </div>
          )}
          <div><label className="label">{tr("Name *")}</label><input placeholder={tr("Jane Smith")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" required /></div>
          <div><label className="label">{tr("Address")}</label><input placeholder={tr("123 Main St, OKC, OK")} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">{tr("Phone")}</label><input placeholder="405-555-0100" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></div><div><label className="label">{tr("Email")}</label><input type="email" placeholder={tr("jane@email.com")} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></div></div>
          <div><label className="label">{tr("Rate ($/visit)")}</label><input type="number" min="0" step="0.01" placeholder="120" value={form.rate} onChange={e => { const v = parseFloat(e.target.value); setForm({ ...form, rate: isNaN(v) ? 0 : Math.max(0, v) }); }} className="input" /></div>
          <div><label className="label">{tr("Service Notes")}</label><textarea placeholder={tr("Focus on front yard...")} value={form.service_notes} onChange={e => setForm({ ...form, service_notes: e.target.value })} className="input" rows={2} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">{tr("Key Code")}</label><input placeholder="4829" value={form.key_code} onChange={e => setForm({ ...form, key_code: e.target.value })} className="input" /></div><div><label className="label">{tr("Alarm Code")}</label><input placeholder="1234" value={form.alarm_code} onChange={e => setForm({ ...form, alarm_code: e.target.value })} className="input" /></div></div>
          <div><label className="label">{tr("Pet Instructions")}</label><input placeholder={tr("1 friendly dog...")} value={form.pet_instructions} onChange={e => setForm({ ...form, pet_instructions: e.target.value })} className="input" /></div>
          <div className="flex gap-2 pt-1"><button type="submit" disabled={saving} className="btn-primary flex-1">{tr(saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Client')}</button><button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="btn-secondary flex-1">{tr("Cancel")}</button></div>
        </form>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-10 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-semibold">{tr(search ? 'No matching clients' : 'No clients yet')}</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{tr(search ? 'Try a different search' : 'Add your first client to get started')}</p>
          </div>
        )}
        {filtered.map((client, i) => {
          const isEditing = editId === client.id;
          const isExpanded = expandedId === client.id;
          const meta = clientMeta[client.id];
          return (
            <div key={client.id} className={isEditing ? 'opacity-40 pointer-events-none' : ''}>
              <div className="card cursor-pointer hover:border-emerald-200 dark:hover:border-emerald-800 transition-all"
                   role="button" tabIndex={0}
                   onClick={() => setExpandedId(isExpanded ? null : client.id)}
                   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : client.id); } }}>
                <div className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColors[i % avatarColors.length]}`}>{getInitials(client.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{client.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {client.address && <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{client.address}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {meta?.nextJob && (
                      <span className="badge-info text-[11px]"><Clock className="w-3 h-3" />{meta.nextJob.scheduled_date === new Date().toISOString().split('T')[0] ? tr('Today') : new Date(meta.nextJob.scheduled_date + 'T12:00:00').toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                    <span className="badge-info">${client.rate ?? 0}</span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 space-y-2.5" style={{ animation: 'slideDown 0.15s ease-out' }}>
                  <div className="flex gap-2 mb-1">
                    {client.phone && <a href={`tel:${client.phone}`} className="btn-secondary text-xs py-2.5 px-3 gap-1 flex-1 min-h-[44px]"><Phone className="w-3 h-3" />{tr("Call")}</a>}
                    {client.address && <a href={getMapsUrl(client.address)} target="_blank" rel="noreferrer" className="btn-secondary text-xs py-2.5 px-3 gap-1 flex-1 min-h-[44px]"><Navigation className="w-3 h-3" />{tr("Navigate")}</a>}
                  </div>
                  {client.phone && <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400"><Phone className="w-3.5 h-3.5 text-gray-400" />{client.phone}</div>}
                  {client.email && <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400"><Mail className="w-3.5 h-3.5 text-gray-400" />{client.email}</div>}
                  {client.service_notes && <div className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400"><StickyNote className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />{client.service_notes}</div>}
                  {meta?.nextJob && (
                    <div className="flex items-center gap-2.5 text-sm text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 rounded-lg p-2.5">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{tr("Next:")} <strong>{new Date(meta.nextJob.scheduled_date + 'T12:00:00').toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong> at {meta.nextJob.scheduled_time?.slice(0, 5) || '--:--'} — {meta.nextJob.title}</span>
                    </div>
                  )}
                  {meta?.recentDone?.length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{tr("Recent service ({{count}} total jobs)", { count: meta.totalJobs })}</p>
                      <div className="space-y-1">
                        {meta.recentDone.map(j => (
                          <div key={j.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span>{new Date(j.scheduled_date + 'T12:00:00').toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                            <span className="text-gray-300 dark:text-gray-600">&middot;</span>
                            <span>{j.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {client.key_code && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 inline-flex items-center gap-1 text-[11px]"><Key className="w-3 h-3" />{tr("Key")}: {client.key_code}</span>}
                    {client.alarm_code && <span className="badge bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 text-[11px]"><AlarmCheck className="w-3 h-3" />{tr("Alarm")}: {client.alarm_code}</span>}
                    {client.pet_instructions && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 inline-flex items-center gap-1 text-[11px]"><PawPrint className="w-3 h-3" />{client.pet_instructions}</span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={e => { e.stopPropagation(); openEdit(client); }} className="btn-secondary text-xs py-2.5 px-3 gap-1 min-h-[44px]"><Pencil className="w-3 h-3" />{tr("Edit")}</button>
                    <button onClick={e => { e.stopPropagation(); remove(client.id); }} className="btn-ghost text-xs py-2.5 px-3 gap-1 min-h-[44px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"><Trash2 className="w-3 h-3" />{tr("Delete")}</button>
                  </div>
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
