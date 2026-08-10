import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronRight, FileText, Filter, Loader2, Mail, MapPin, Navigation, Pencil, Phone, Plus, Search, StickyNote, Tag, Trash2, X } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';
import { CLIENT_TAGS, INITIAL_CLIENT_FORM } from '../lib/constants';
import { createClient, createEstimate, createLead, deleteClient, deleteLead, loadClients, loadLeads, updateClient, updateLeadStatus, convertLeadToClient } from '../lib/data';
import { supabase } from '../lib/supabase';
import { getMapsUrl } from '../lib/maps';
import { estimatedRateReview } from '../lib/dashboard-metrics';

const SOURCES = ['booking_link', 'phone', 'facebook', 'referral', 'walk_in', 'other'];
const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
const LEAD_FORM = { name: '', phone: '', email: '', address: '', source: 'other', notes: '' };
const sourceLabel = value => value === 'booking_link' ? 'Booking link' : value === 'walk_in' ? 'Walk-in' : value[0].toUpperCase() + value.slice(1);
const statusStyle = { new: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300', contacted: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300', quoted: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', lost: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };

export default function Clients({ jobs = [], unreadLeadCount = 0, onLeadsViewed, isOwner = true }) {
  const { tr, i18n } = useLocalizedText('clients');
  const [searchParams, setSearchParams] = useSearchParams();
  const [segment, setSegment] = useState(() => searchParams.get('segment') === 'review' && isOwner ? 'review' : 'clients');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const requested = searchParams.get('segment');
    if (requested === 'review' && isOwner) setSegment('review');
    else if (!isOwner && segment === 'review') setSegment('clients');
    else if (requested === 'clients' || requested === 'leads') setSegment(requested);
  }, [isOwner, searchParams, segment]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [clientForm, setClientForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [leadForm, setLeadForm] = useState(null);
  const [convertLead, setConvertLead] = useState(null);
  const [estimateClient, setEstimateClient] = useState(null);
  const [estimate, setEstimate] = useState({ amount: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [refStatus, setRefStatus] = useState(null); // { code, total_count, earned_count }
  const [refCopied, setRefCopied] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadClients(), loadLeads()]).then(([clientRows, leadRows]) => { if (active) { setClients(clientRows); setLeads(leadRows); } }).catch(err => active && setError(err.message || tr('Failed to load clients and leads.'))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const shownClients = useMemo(() => clients.filter(c => `${c.name} ${c.address || ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [clients, search]);
  const shownLeads = useMemo(() => leads.filter(l => `${l.name} ${l.phone || ''} ${l.email || ''} ${l.address || ''}`.toLowerCase().includes(search.toLowerCase())), [leads, search]);
  const rateReview = useMemo(() => isOwner ? estimatedRateReview(clients, jobs) : { eligibleAverage: null, flagged: [] }, [clients, isOwner, jobs]);
  const shownReview = useMemo(() => rateReview.flagged.filter(item => `${item.client.name || ''} ${item.client.address || ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.estimatedHourlyRate - b.estimatedHourlyRate), [rateReview, search]);
  const duplicatePhone = (phone, excludeId = editId) => phone && [...clients, ...leads].some(row => row.phone && row.phone.replace(/\D/g, '') === phone.replace(/\D/g, '') && row.id !== excludeId);
  const toast = value => { setMessage(value); setTimeout(() => setMessage(''), 3000); };

  // Live-refresh the leads list when a new-lead alert arrives while this page
  // is mounted (review finding: badge/toast fired but the list stayed stale).
  const prevUnread = useRef(unreadLeadCount);
  useEffect(() => {
    if (unreadLeadCount > prevUnread.current && unreadLeadCount > 0) {
      loadLeads()
        .then(rows => setLeads(prev => {
          const known = new Set(prev.map(l => l.id));
          return [...rows.filter(r => !known.has(r.id)), ...prev];
        }))
        .catch(err => console.error('live lead refresh failed:', err));
    }
    prevUnread.current = unreadLeadCount;
  }, [unreadLeadCount]);

  async function saveClient(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const row = editId ? await updateClient(editId, clientForm) : await createClient(clientForm);
      setClients(old => editId ? old.map(c => c.id === editId ? row : c) : [...old, row]);
      setClientForm(null); setEditId(null);
    } catch (err) {
      const msg = err.message || '';
      if (!editId && msg.includes('Free plan is limited to')) { setUpgradeOpen(true); }
      else { setError(msg || tr('Failed to save client. Please try again.')); }
    } finally { setSaving(false); }
  }
  async function saveLead(e) {
    e.preventDefault(); setSaving(true); setError('');
    try { const row = await createLead(leadForm); setLeads(old => [row, ...old]); setLeadForm(null); }
    catch (err) { setError(err.message || tr('Failed to save lead. Please try again.')); } finally { setSaving(false); }
  }
  async function changeStatus(lead, status) {
    try { const row = await updateLeadStatus(lead.id, status); setLeads(old => old.map(l => l.id === row.id ? row : l)); }
    catch (err) { toast(err.message || tr('Could not update lead status.')); }
  }
  async function finishConversion(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const result = await convertLeadToClient({ ...convertLead.lead, ...convertLead.form });
      setClients(old => [...old, result.client]); setLeads(old => old.map(l => l.id === result.lead.id ? result.lead : l));
      setConvertLead(null); setEstimateClient(result.client); toast(tr('Lead converted to client.'));
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Free plan is limited to')) { setConvertLead(null); setUpgradeOpen(true); }
      else { setError(msg || tr('Could not convert lead.')); }
    } finally { setSaving(false); }
  }
  async function removeLead(lead) {
    if (lead.status !== 'lost') return toast(tr('Only lost leads can be deleted.'));
    if (!confirm(tr('Delete {{name}}? This cannot be undone.', { name: lead.name }))) return;
    try { await deleteLead(lead.id); setLeads(old => old.filter(l => l.id !== lead.id)); } catch (err) { toast(err.message || tr('Could not delete lead.')); }
  }
  async function saveEstimate(e) {
    e.preventDefault(); setSaving(true);
    try { await createEstimate({ client_id: estimateClient.id, amount: estimate.amount, note: estimate.note, status: 'draft' }); setEstimateClient(null); setEstimate({ amount: '', note: '' }); toast(tr('Estimate draft created.')); }
    catch (err) { setError(err.message || tr('Could not create estimate.')); } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-brand animate-spin" /></div>;
  return <div>
    {message && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{message}</div>}
    <div className="flex items-center justify-between mb-4"><div><h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{tr('Clients')}</h2><p className="text-sm text-[var(--color-text-secondary)]">{tr('{{count}} total', { count: segment === 'clients' ? clients.length : segment === 'leads' ? leads.length : rateReview.flagged.length })}</p></div>{segment !== 'review' && <button className="btn-primary gap-1.5" onClick={() => segment === 'clients' ? (setEditId(null), setClientForm({ ...INITIAL_CLIENT_FORM })) : setLeadForm({ ...LEAD_FORM })}><Plus className="w-4 h-4" />{tr(segment === 'clients' ? 'Add Client' : 'Add Lead')}</button>}</div>
    <div className={`grid ${isOwner ? 'grid-cols-3' : 'grid-cols-2'} bg-[var(--color-surface-secondary)] dark:bg-gray-900 rounded-xl p-1 mb-4`} role="tablist">{['clients', 'leads', ...(isOwner ? ['review'] : [])].map(value => <button key={value} role="tab" aria-selected={segment === value} onClick={() => { setSegment(value); setSearchParams(value === 'clients' ? {} : { segment: value }, { replace: true }); setSearch(''); setExpandedId(null); if (value === 'leads' && unreadLeadCount > 0) onLeadsViewed?.(); }} className={`relative rounded-lg py-2 px-1 text-sm font-semibold transition ${segment === value ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-sm' : 'text-[var(--color-text-secondary)]'}`}>{tr(value === 'clients' ? 'Clients' : value === 'review' ? 'Pricing Opportunities' : 'Leads')}{value === 'leads' && unreadLeadCount > 0 && <span aria-label={tr('{{count}} new leads', { count: unreadLeadCount })} className="absolute top-1 right-1/2 translate-x-[26px] -translate-y-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadLeadCount > 9 ? '9+' : unreadLeadCount}</span>}</button>)}</div>
    <div className="relative mb-4"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" /><input className="input pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder={tr(segment === 'leads' ? 'Search leads...' : 'Search by name or address...')} /></div>
    {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 mb-4">{error}</div>}

    {segment === 'review' ? <RateReviewList items={shownReview} average={rateReview.eligibleAverage} search={search} expandedId={expandedId} setExpandedId={setExpandedId} editClient={client => { setEditId(client.id); setClientForm({ ...INITIAL_CLIENT_FORM, ...client }); }} tr={tr} /> : segment === 'clients' ? <div className="space-y-2">{shownClients.length === 0 ? <Empty text={tr(search ? 'No matching clients' : 'No clients yet')} /> : shownClients.map(client => {
      const open = expandedId === client.id; const nextJob = jobs.find(j => j.client_id === client.id && j.status !== 'done');
      return <div key={client.id} className="card"><button className="w-full p-4 flex items-center justify-between gap-3 text-left" onClick={() => setExpandedId(open ? null : client.id)}><div className="min-w-0"><p className="font-semibold text-sm">{client.name}</p>{client.address && <p className="text-xs text-[var(--color-text-muted)] truncate mt-1">{client.address}</p>}</div><div className="flex items-center gap-2">{isOwner && <span className="badge-info">${client.rate || 0}</span>}<ChevronRight className={`w-4 h-4 transition ${open ? 'rotate-90' : ''}`} /></div></button>{open && <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-2 text-sm">{client.phone && <p className="flex gap-2"><Phone className="w-4 h-4" />{client.phone}</p>}{client.email && <p className="flex gap-2"><Mail className="w-4 h-4" />{client.email}</p>}{client.service_notes && <p className="flex gap-2"><StickyNote className="w-4 h-4" />{client.service_notes}</p>}{nextJob && <p className="flex gap-2 text-violet-600"><Calendar className="w-4 h-4" />{nextJob.scheduled_date} — {nextJob.title}</p>}<div className="flex gap-2 pt-2">{client.phone && <a href={`tel:${client.phone}`} className="btn-secondary text-xs"><Phone className="w-3 h-3" />{tr('Call')}</a>}{client.address && <a href={getMapsUrl(client.address)} target="_blank" rel="noreferrer" className="btn-secondary text-xs"><Navigation className="w-3 h-3" />{tr('Navigate')}</a>}{isOwner && <><button className="btn-secondary text-xs" onClick={() => { setEditId(client.id); setClientForm({ ...INITIAL_CLIENT_FORM, ...client }); }}><Pencil className="w-3 h-3" />{tr('Edit')}</button><button className="btn-ghost text-xs text-red-500" onClick={async () => { if (confirm(tr('Delete {{name}} and all their jobs? This cannot be undone.', { name: client.name }))) { await deleteClient(client.id); setClients(old => old.filter(c => c.id !== client.id)); } }}><Trash2 className="w-3 h-3" />{tr('Delete')}</button></>}</div></div>}</div>;
    })}</div> : <div className="space-y-3">{shownLeads.length === 0 ? <Empty text={tr(search ? 'No matching leads' : 'No leads yet')} /> : shownLeads.map(lead => <div className="card p-4" key={lead.id}><div className="flex justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{lead.name}</p><span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px]">{tr(sourceLabel(lead.source))}</span></div><p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('Created')} {new Date(lead.created_at).toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-US' : 'en-US')}</p></div><select aria-label={tr('Lead status')} value={lead.status} onChange={e => changeStatus(lead, e.target.value)} className={`rounded-lg px-2 py-1 text-xs font-semibold border-0 ${statusStyle[lead.status]}`}>{STATUSES.map(s => <option key={s} value={s}>{tr(s[0].toUpperCase() + s.slice(1))}</option>)}</select></div><div className="mt-3 space-y-1.5 text-sm text-[var(--color-text-secondary)]">{lead.phone && <p className="flex gap-2"><Phone className="w-4 h-4" />{lead.phone}</p>}{lead.email && <p className="flex gap-2"><Mail className="w-4 h-4" />{lead.email}</p>}{lead.address && <p className="flex gap-2"><MapPin className="w-4 h-4" />{lead.address}</p>}{lead.notes && <p className="flex gap-2"><StickyNote className="w-4 h-4" />{lead.notes}</p>}</div><div className="flex flex-wrap gap-2 mt-4">{lead.phone && <a className="btn-secondary text-xs" href={`tel:${lead.phone}`}><Phone className="w-3 h-3" />{tr('Call')}</a>}{lead.email && <a className="btn-secondary text-xs" href={`mailto:${lead.email}`}><Mail className="w-3 h-3" />{tr('Email')}</a>}{lead.client_id ? <button className="btn-primary text-xs" onClick={() => setEstimateClient(clients.find(c => c.id === lead.client_id) || { id: lead.client_id, name: lead.name })}><FileText className="w-3 h-3" />{tr('Create Estimate')}</button> : <button disabled={!['new','contacted','quoted'].includes(lead.status)} className="btn-primary text-xs disabled:opacity-40" onClick={() => setConvertLead({ lead, form: { name: lead.name, phone: lead.phone || '', email: lead.email || '', address: lead.address || '' } })}>{tr('Convert to Client')}</button>}<button className="btn-ghost text-xs text-red-500 disabled:opacity-30" disabled={lead.status !== 'lost'} onClick={() => removeLead(lead)}><Trash2 className="w-3 h-3" />{tr('Delete')}</button></div></div>)}</div>}

    {clientForm && <Modal title={tr(editId ? 'Edit Client' : 'New Client')} close={() => { setClientForm(null); setEditId(null); }}><form onSubmit={saveClient} className="space-y-3"><ContactFields form={clientForm} setForm={setClientForm} tr={tr} />{duplicatePhone(clientForm.phone) && <Warning text={tr('A lead or client already uses this phone number.')} />}{isOwner && <><label className="label">{tr('Rate ($/visit)')}</label><input className="input" type="number" min="0" value={clientForm.rate} onChange={e => setClientForm({ ...clientForm, rate: Number(e.target.value) })} /></>}<label className="label">{tr('Service Notes')}</label><textarea className="input" value={clientForm.service_notes} onChange={e => setClientForm({ ...clientForm, service_notes: e.target.value })} /><Actions saving={saving} cancel={() => setClientForm(null)} tr={tr} /></form></Modal>}
    {leadForm && <Modal title={tr('New Lead')} close={() => setLeadForm(null)}><form onSubmit={saveLead} className="space-y-3"><ContactFields form={leadForm} setForm={setLeadForm} tr={tr} phoneRequired={false} />{duplicatePhone(leadForm.phone) && <Warning text={tr('A lead or client already uses this phone number.')} />}<label className="label">{tr('Source')}</label><select className="input" value={leadForm.source} onChange={e => setLeadForm({ ...leadForm, source: e.target.value })}>{SOURCES.map(s => <option key={s} value={s}>{tr(sourceLabel(s))}</option>)}</select><label className="label">{tr('Notes')}</label><textarea className="input" value={leadForm.notes} onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })} /><Actions saving={saving} cancel={() => setLeadForm(null)} tr={tr} /></form></Modal>}
    {convertLead && <Modal title={tr('Convert to Client')} close={() => setConvertLead(null)}><form onSubmit={finishConversion} className="space-y-3"><ContactFields form={convertLead.form} setForm={form => setConvertLead({ ...convertLead, form })} tr={tr} />{duplicatePhone(convertLead.form.phone, convertLead.lead.id) && <Warning text={tr('A lead or client already uses this phone number.')} />}<Actions saving={saving} cancel={() => setConvertLead(null)} tr={tr} saveLabel="Convert" /></form></Modal>}
    {estimateClient && <Modal title={tr('Create Estimate')} close={() => setEstimateClient(null)}><form onSubmit={saveEstimate} className="space-y-3"><p className="text-sm text-[var(--color-text-secondary)]">{tr('Client')}: <b>{estimateClient.name}</b></p><label className="label">{tr('Amount')}</label><input required min="0.01" step="0.01" type="number" className="input" value={estimate.amount} onChange={e => setEstimate({ ...estimate, amount: e.target.value })} /><label className="label">{tr('Note (optional)')}</label><textarea className="input" value={estimate.note} onChange={e => setEstimate({ ...estimate, note: e.target.value })} /><Actions saving={saving} cancel={() => setEstimateClient(null)} tr={tr} saveLabel="Create Estimate" /></form></Modal>}
    {upgradeOpen && <Modal title={tr("You've hit the free limit (5 clients)")} close={() => setUpgradeOpen(false)}><p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mb-4">{tr('Unlimited clients, recurring jobs and offline mode start at $39/mo.')}</p><div className="flex gap-2"><Link to="/subscribe" className="btn-primary flex-1 text-center" onClick={() => setUpgradeOpen(false)}>{tr('See plans')}</Link><button type="button" className="btn-secondary flex-1" onClick={() => setUpgradeOpen(false)}>{tr('Not now')}</button></div><div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800"><button type="button" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline" onClick={async () => { if (!refStatus) { const { data, error } = await supabase.rpc('referral_status'); if (!error && data?.code) setRefStatus(data); } }}>{tr('Invite a crew — get a free month')}</button>{refStatus?.code && <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3"><p className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr('Share your code:')}</p><div className="flex items-center gap-2 mt-1.5"><code className="font-mono text-lg font-bold tracking-[0.2em] text-emerald-600 dark:text-emerald-400">{refStatus.code}</code><button type="button" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline" onClick={async () => { try { await navigator.clipboard.writeText(refStatus.code); setRefCopied(true); setTimeout(() => setRefCopied(false), 1500); } catch (e) {} }}>{refCopied ? tr('Copied!') : tr('Copy')}</button></div><p className="text-xs text-[var(--color-text-muted)] mt-2 break-all">{`${window.location.origin}/#/login?mode=signup&ref=${encodeURIComponent(refStatus.code)}`}</p></div>}</div></Modal>}
  </div>;
}

function RateReviewList({ items, average, search, expandedId, setExpandedId, editClient, tr }) {
  return <div className="space-y-3">
    {items.length === 0 ? <ReviewEmpty search={search} tr={tr} /> : items.map(item => {
      const client = item.client;
      const open = expandedId === client.id;
      return <div key={client.id} className="card">
        <button aria-expanded={open} className="w-full p-4 flex items-center justify-between gap-3 text-left" onClick={() => setExpandedId(open ? null : client.id)}>
          <div className="min-w-0"><p className="font-semibold text-sm">{client.name}</p><p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('{{minutes}} scheduled minutes · ${{rate}} per visit', { minutes: Math.round(item.scheduledMinutes), rate: Number(client.rate).toFixed(2) })}</p><p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('{{count}} completed jobs included', { count: item.completedJobCount })}{item.completedJobCount < 4 && ` · ${tr('Early estimate — verify scheduled time')}`}</p></div>
          <div className="flex items-center gap-2"><span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">${item.estimatedHourlyRate.toFixed(2)}/{tr('hr')}</span><ChevronRight className={`w-4 h-4 transition ${open ? 'rotate-90' : ''}`} /></div>
        </button>
        {open && <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">{tr('Pricing opportunity')}</p>
          <p className="font-semibold text-[var(--color-text-primary)] dark:text-white">{tr('This visit may not be priced for the time it takes')}</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-300">${item.estimatedHourlyRate.toFixed(2)}<span className="text-sm font-normal text-[var(--color-text-muted)]">/hr — {tr('based on scheduled time')}</span></p>
          <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
            <p>{tr('You charge ${{rate}} for a visit scheduled for about {{minutes}} minutes. Based on {{count}} completed jobs.', { rate: Number(client.rate).toFixed(2), minutes: Math.round(item.scheduledMinutes), count: item.completedJobCount })}</p>
            <p>{tr('Similar clients average about ${{average}}/hr.', { average: average.toFixed(2) })}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-[var(--color-text-primary)] dark:text-white">{tr('Before changing the price')}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{tr('Check how long the visit really takes and how far you drive. This is a suggestion to review — not a direction to change the price.')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-xs" onClick={() => editClient(client)}><Pencil className="w-3 h-3" />{tr('Review client')}</button>
          </div>
          <details className="group text-xs text-[var(--color-text-secondary)]">
            <summary className="cursor-pointer font-semibold select-none hover:text-[var(--color-text-primary)] dark:hover:text-white">{tr('How is this calculated?')}</summary>
            <p className="mt-2 leading-relaxed">{tr('MowGo compares this visit price and scheduled time with other eligible clients. A client appears here when they have at least two completed jobs and their estimated rate is below both 75% of the average and $50 per hour.')}</p>
          </details>
          <details className="group text-xs text-[var(--color-text-secondary)]">
            <summary className="cursor-pointer font-semibold select-none hover:text-[var(--color-text-primary)] dark:hover:text-white">{tr('Public market context')}</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>{tr('Public pricing guidance varies by lawn size, service type, region, and operating costs.')}</p>
              <p>{tr('These sources provide context only — not a personalized recommendation or direction to change your price.')}</p>
              <ul className="space-y-1">
                <li><a href="https://www.realgreen.com/blog/lawn-care-pricing-chart" target="_blank" rel="noreferrer" aria-label={tr('RealGreen pricing guide (opens in new tab)')} className="text-emerald-700 dark:text-emerald-300 underline hover:no-underline">{tr('RealGreen pricing guide')}</a></li>
                <li><a href="https://lawnpricing.com/data/" target="_blank" rel="noreferrer" aria-label={tr('LawnPricing market data (opens in new tab)')} className="text-emerald-700 dark:text-emerald-300 underline hover:no-underline">{tr('LawnPricing market data')}</a></li>
                <li><a href="https://hmndp.org/lawn-care-pricing-strategy/" target="_blank" rel="noreferrer" aria-label={tr('HMNDP operator pricing research (opens in new tab)')} className="text-emerald-700 dark:text-emerald-300 underline hover:no-underline">{tr('HMNDP operator pricing research')}</a></li>
              </ul>
            </div>
          </details>
        </div>}
      </div>;
    })}
  </div>;
}

function ReviewEmpty({ search, tr }) {
  if (search) return <Empty text={tr('No matching clients')} />;
  return <div className="card p-5 space-y-3 border-emerald-200 dark:border-emerald-900/60">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{tr('Pricing opportunities')}</p>
      <p className="font-semibold text-emerald-700 dark:text-emerald-300 mt-1">{tr('You’re all set')}</p>
    </div>
    <p className="text-sm text-[var(--color-text-secondary)]">{tr('No pricing opportunities found. Your eligible clients are within the expected range for their scheduled time.')}</p>
    <p className="text-xs text-[var(--color-text-muted)]">{tr('MowGo checks again as you complete more jobs. This is an estimate based on scheduled time, not a timer.')}</p>
  </div>;
}

function ContactFields({ form, setForm, tr }) { return <><label className="label">{tr('Name *')}</label><input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><label className="label">{tr('Address')}</label><input className="input" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /><div className="grid grid-cols-2 gap-3"><div><label className="label">{tr('Phone')}</label><input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div><div><label className="label">{tr('Email')}</label><input type="email" className="input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div></div></>; }
function Modal({ title, close, children }) { return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onMouseDown={close}><div className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onMouseDown={e => e.stopPropagation()}><div className="flex justify-between mb-4"><h3 className="font-bold text-lg">{title}</h3><button onClick={close}><X className="w-5 h-5" /></button></div>{children}</div></div>; }
function Actions({ saving, cancel, tr, saveLabel = 'Save' }) { return <div className="flex gap-2 pt-2"><button type="button" className="btn-secondary flex-1" onClick={cancel}>{tr('Cancel')}</button><button disabled={saving} className="btn-primary flex-1">{saving ? tr('Saving...') : tr(saveLabel)}</button></div>; }
function Empty({ text }) { return <div className="card p-10 text-center text-[var(--color-text-muted)]">{text}</div>; }
function Warning({ text }) { return <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg">{text}</div>; }
