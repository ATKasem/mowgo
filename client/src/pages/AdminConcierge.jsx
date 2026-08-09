import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { parseClientCsv } from '../lib/csv-import';
import { supabase } from '../lib/supabase';

export default function AdminConcierge() {
  const [code, setCode] = useState('');
  const [draftCode, setDraftCode] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [openPreview, setOpenPreview] = useState(null);
  const [actionState, setActionState] = useState({});
  const [kpi, setKpi] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState('');

  async function api(path, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}`, 'x-admin-code': code, ...options.headers } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }

  async function load() {
    setLoading(true); setPageError('');
    try { const result = await api('/api/admin/concierge?action=list'); setRequests(result.requests || []); }
    catch (error) { setPageError(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (code) void load(); }, [code]);

  async function loadKpi() {
    setKpiLoading(true); setKpiError('');
    try {
      const { data, error } = await supabase.functions.invoke('get-conversion-kpi', { headers: { 'x-admin-code': code } });
      if (error) throw new Error(error.message || 'Failed to load KPI');
      if (data?.error) throw new Error(data.error);
      setKpi(data);
    } catch (error) { setKpiError(error.message); }
    finally { setKpiLoading(false); }
  }
  useEffect(() => { if (code) void loadKpi(); }, [code]);

  function enter(event) { event.preventDefault(); const value = draftCode.trim(); if (!value) return; setCode(value); }
  async function run(item, action, extra = {}) {
    setActionState(current => ({ ...current, [item.id]: { ...current[item.id], loading: action, error: '' } }));
    try {
      const actionBody = { action, request_id: item.id, ...extra };
      const result = await api('/api/admin/concierge', { method: 'POST', body: JSON.stringify(actionBody) });
      setActionState(current => ({ ...current, [item.id]: { ...current[item.id], loading: '', error: '', [action]: result, ...(action === 'import' ? { imported: true } : {}), ...(action === 'schedule' ? { scheduled: true } : {}), ...(action === 'undo_schedule' ? { scheduled: false, schedule: null } : {}) } }));
      if (action === 'import') setRequests(current => current.map(row => row.id === item.id ? { ...row, status: 'importing', imported_client_ids: result.clients?.map(client => client.id) || row.imported_client_ids } : row));
      if (action === 'schedule') setRequests(current => current.map(row => row.id === item.id ? { ...row, scheduled_at: new Date().toISOString(), scheduled_job_ids: result.jobs?.map(job => job.id) || [], schedule_summary: result.schedule_summary || { created: result.jobs?.length || 0, skipped_existing: result.skipped || 0 } } : row));
      if (action === 'undo_schedule' && !result.retained_changed) setRequests(current => current.map(row => row.id === item.id ? { ...row, scheduled_at: null, scheduled_job_ids: [] } : row));
      if (action === 'review' || action === 'done' || action === 'skip') setRequests(current => current.map(row => row.id === item.id ? { ...row, ...result.request } : row));
    } catch (error) { setActionState(current => ({ ...current, [item.id]: { ...current[item.id], loading: '', error: error.message } })); }
  }

  if (!code) return <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4"><form onSubmit={enter} className="card p-6 w-full max-w-sm space-y-4"><h1 className="text-xl font-bold dark:text-white">Concierge admin</h1><input autoFocus type="password" className="input" placeholder="Admin code" value={draftCode} onChange={e => setDraftCode(e.target.value)} /><button className="btn-primary w-full">Enter</button></form></main>;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8"><div className="max-w-6xl mx-auto space-y-5">
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3"><h2 className="font-bold dark:text-white">Free→Paid KPI</h2><button className="btn-secondary text-sm" onClick={() => void loadKpi()}>Refresh</button></div>
        {kpiError && <p className="text-sm text-red-600">{kpiError}</p>}
        {kpiLoading ? <Loader2 className="w-5 h-5 animate-spin text-brand" /> : kpi && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div><p className="text-xs text-gray-500">Total signups</p><p className="text-xl font-bold dark:text-white">{kpi.total_signups}</p></div>
            <div><p className="text-xs text-gray-500">Trials started</p><p className="text-xl font-bold dark:text-white">{kpi.trials_started}</p></div>
            <div><p className="text-xs text-gray-500">Trials converted</p><p className="text-xl font-bold dark:text-white">{kpi.trials_converted}</p></div>
            <div><p className="text-xs text-gray-500">Conversion %</p><p className="text-xl font-bold dark:text-white">{kpi.conversion_pct}%</p></div>
            <div><p className="text-xs text-gray-500">Trials started (30d)</p><p className="text-xl font-bold dark:text-white">{kpi.trials_started_last_30_days}</p></div>
          </div>
        )}
      </section>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold dark:text-white">Concierge queue</h1><button className="btn-secondary" onClick={() => void load()}>Refresh</button></div>
      {pageError && <p className="text-sm text-red-600">{pageError}</p>}{loading ? <Loader2 className="w-6 h-6 animate-spin text-brand" /> : requests.length === 0 ? <div className="card p-6 text-sm text-gray-500">No concierge requests.</div> : requests.map(item => {
        const state = actionState[item.id] || {}; const parsed = parseClientCsv(item.csv_content); const dueAt = item.sla_due_at ? new Date(item.sla_due_at) : new Date(new Date(item.created_at).getTime() + 48 * 60 * 60 * 1000); const active = ['pending','importing','review'].includes(item.status); const overdue = active && Date.now() > dueAt.getTime(); const checklist = state.checklist || item.operator_checklist || {}; const needsExistingScheduleCheck = Number(item.schedule_summary?.created||0)===0&&Number(item.schedule_summary?.skipped_existing||0)>0; const reviewChecklistComplete = checklist.clients_verified===true&&checklist.first_week_verified===true&&checklist.customer_ready===true&&(!needsExistingScheduleCheck||checklist.existing_schedule_verified===true); const reviewDisabledReason = !item.scheduled_at ? 'Prepare or verify the first-week schedule first.' : !reviewChecklistComplete ? 'Complete every required checklist item to save the human review.' : ''; const skipNotes = state.skipNotes ?? ''; const mustUndoBeforeSkip = Boolean(item.scheduled_at) || item.scheduled_job_ids?.length > 0;
        const setChecklist = (key, checked) => setActionState(current => ({ ...current, [item.id]: { ...current[item.id], checklist: { ...(current[item.id]?.checklist || item.operator_checklist || {}), [key]: checked } } }));
        return <section key={item.id} className={`card p-5 space-y-4 ${item.priority_rank > 0 ? 'ring-2 ring-emerald-500/40' : ''}`}><div className="flex flex-wrap gap-3 justify-between"><div><div className="flex items-center gap-2"><h2 className="font-bold dark:text-white">{item.business_name}</h2>{item.tier_at_request === 'premium' && <span className="badge-success">Premium priority</span>}</div><p className="text-xs text-gray-500">{item.client_count ?? 'Unknown'} clients · submitted {new Date(item.submitted_at || item.created_at).toLocaleString()}</p></div><div className="flex items-center gap-2"><span className={item.status === 'done' ? 'badge-success' : 'badge-warning'}>{item.status}</span>{!['done','skipped'].includes(item.status) && <span className={`text-xs font-semibold ${overdue ? 'text-red-600' : 'text-gray-500'}`}>{overdue ? `SLA overdue · ${dueAt.toLocaleString()}` : `SLA due ${dueAt.toLocaleString()}`}</span>}</div></div>
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1"><span>Claimed: {item.claimed_at ? new Date(item.claimed_at).toLocaleString() : '—'}</span><span>Imported: {item.imported_at ? new Date(item.imported_at).toLocaleString() : '—'}</span><span>Scheduled: {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : '—'}</span><span>Review: {item.review_started_at ? new Date(item.review_started_at).toLocaleString() : '—'}</span><span>Completed: {item.done_at ? new Date(item.done_at).toLocaleString() : '—'}</span></div>
          <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setOpenPreview(openPreview === item.id ? null : item.id)}>Preview</button><button className="btn-primary" disabled={Boolean(state.loading) || item.imported_client_ids?.length > 0 || !['pending','importing'].includes(item.status)} onClick={() => void run(item, 'import')}>{state.loading === 'import' ? 'Importing…' : 'Import clients'}</button><button className="btn-secondary" disabled={Boolean(state.loading) || !item.imported_client_ids?.length || Boolean(item.scheduled_at)} onClick={() => void run(item, 'schedule')}>{state.loading === 'schedule' ? 'Scheduling…' : 'Schedule first week'}</button>{(Boolean(item.scheduled_at) || item.scheduled_job_ids?.length > 0) && ['importing','review'].includes(item.status) && <button className="btn-secondary text-red-600" disabled={Boolean(state.loading)} onClick={() => void run(item, 'undo_schedule')}>Undo schedule</button>}</div>
          {item.status === 'importing' && <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"><h3 className="font-semibold dark:text-white">Human review checkpoint</h3>{[['clients_verified','Imported client details verified'],['first_week_verified','First operating week verified'],['customer_ready','Customer account is ready'],...(needsExistingScheduleCheck?[['existing_schedule_verified','Existing first-week jobs verified; no new jobs needed']]:[])].map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checklist[key] === true} onChange={event => setChecklist(key,event.target.checked)} />{label}</label>)}<textarea className="input min-h-20" maxLength={4000} placeholder="Operator notes" value={state.notes ?? item.notes ?? ''} onChange={event => setActionState(current => ({ ...current, [item.id]: { ...current[item.id], notes: event.target.value } }))} /><button className="btn-primary" title={reviewDisabledReason} disabled={Boolean(state.loading) || Boolean(reviewDisabledReason)} onClick={() => void run(item,'review',{operator_checklist:checklist,notes:state.notes ?? item.notes ?? ''})}>{state.loading === 'review' ? 'Saving review…' : 'Save human review'}</button>{reviewDisabledReason && <p className="text-xs text-amber-700 dark:text-amber-400">{reviewDisabledReason}</p>}</div>}
          {item.status === 'review' && <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2"><p className="font-semibold dark:text-white">Human review recorded</p><p className="text-sm text-gray-600 dark:text-gray-300">{item.notes || 'No operator notes.'}</p><button className="btn-primary" disabled={Boolean(state.loading)} onClick={() => void run(item, 'done')}>{state.loading === 'done' ? 'Completing…' : 'Mark setup complete'}</button></div>}
          {active && <div className="rounded-lg border border-red-200 dark:border-red-900 p-4 space-y-2"><p className="font-semibold text-red-700 dark:text-red-400">Close without completing</p><textarea className="input min-h-20" maxLength={4000} aria-label="Required operator notes for closing request" placeholder="Required operator notes (1–4000 characters)" value={skipNotes} onChange={event => setActionState(current => ({ ...current, [item.id]: { ...current[item.id], skipNotes: event.target.value } }))} />{mustUndoBeforeSkip && <p className="text-xs text-amber-700 dark:text-amber-400">Undo the first-week schedule before closing this request.</p>}<button className="btn-secondary text-red-600" disabled={Boolean(state.loading) || mustUndoBeforeSkip || !skipNotes.trim() || skipNotes.trim().length > 4000} onClick={() => void run(item, 'skip', { notes: skipNotes })}>{state.loading === 'skip' ? 'Closing…' : 'Close as skipped'}</button></div>}
          {item.status === 'skipped' && <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-1"><p className="font-semibold dark:text-white">Closed as skipped</p><p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{item.skip_notes}</p><p className="text-xs text-gray-500">Closed {item.skipped_at ? new Date(item.skipped_at).toLocaleString() : '—'}</p></div>}
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}{(state.import || item.import_summary?.input_rows) && (() => { const summary=state.import||item.import_summary; return <><p className="text-sm">Processed {summary.input_rows ?? 0} rows: created {summary.created ?? 0}, matched {summary.matched_existing ?? 0} existing clients, and flagged {summary.duplicate_existing_client ?? 0} duplicate client rows. Invalid rows: {state.import?.skipped?.length || 0}. Organized {state.import?.cleaned || 0}; removed {state.import?.duplicates || 0} within-file duplicates.</p>{summary.row_results?.filter(row=>row.outcome==='duplicate_existing_client').map(row=><p key={row.source_index} className="text-xs text-amber-700">Source row {row.source_index + 1} matches the same client as source row {row.duplicate_of_source_index + 1}; it was explicitly flagged and not scheduled twice.</p>)}</>; })()}{state.import?.skipped?.map(error => <p key={`${error.row}-${error.message}`} className="text-xs text-red-600">Row {error.row}: {error.message}</p>)}{state.schedule && <p className="text-sm">Created {state.schedule.jobs?.length || 0} jobs.</p>}{state.undo_schedule?.retained_changed > 0 && <p className="text-sm text-amber-700">Kept {state.undo_schedule.retained_changed} customer-changed jobs. Review them manually before continuing.</p>}
          {openPreview === item.id && <div className="overflow-x-auto"><p className="text-sm font-semibold mb-2">{parsed.rows.length} valid rows · {parsed.errors.length} skipped</p><table className="w-full text-xs"><thead><tr className="text-left border-b"><th className="p-2">Name</th><th className="p-2">Address</th><th className="p-2">Phone</th><th className="p-2">Email</th><th className="p-2">Rate</th></tr></thead><tbody>{parsed.rows.slice(0,50).map((row,index)=><tr key={index} className="border-b"><td className="p-2">{row.name}</td><td className="p-2">{row.address}</td><td className="p-2">{row.phone}</td><td className="p-2">{row.email}</td><td className="p-2">{row.rate}</td></tr>)}</tbody></table>{parsed.errors.map(error=><p key={`${error.row}-${error.message}`} className="text-xs text-red-600 mt-1">Row {error.row}: {error.message}</p>)}</div>}
        </section>;
      })}
    </div></main>
  );
}
