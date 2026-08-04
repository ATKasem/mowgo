import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { parseClientCsv } from '../lib/csv-import';

export default function AdminConcierge() {
  const [code, setCode] = useState(() => sessionStorage.getItem('conciergeAdminCode') || '');
  const [draftCode, setDraftCode] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [openPreview, setOpenPreview] = useState(null);
  const [actionState, setActionState] = useState({});

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'x-admin-code': code, ...options.headers } });
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

  function enter(event) { event.preventDefault(); const value = draftCode.trim(); if (!value) return; sessionStorage.setItem('conciergeAdminCode', value); setCode(value); }
  async function run(item, action, extra = {}) {
    setActionState(current => ({ ...current, [item.id]: { ...current[item.id], loading: action, error: '' } }));
    try {
      const actionBody = { action, request_id: item.id, ...extra };
      const result = await api('/api/admin/concierge', { method: 'POST', body: JSON.stringify(actionBody) });
      setActionState(current => ({ ...current, [item.id]: { ...current[item.id], loading: '', error: '', [action]: result, ...(action === 'import' ? { imported: true } : {}), ...(action === 'schedule' ? { scheduled: true } : {}), ...(action === 'undo_schedule' ? { scheduled: false, schedule: null } : {}) } }));
      if (action === 'import') setRequests(current => current.map(row => row.id === item.id ? { ...row, status: 'importing' } : row));
      if (action === 'done') setRequests(current => current.map(row => row.id === item.id ? { ...row, status: 'done', done_at: new Date().toISOString() } : row));
    } catch (error) { setActionState(current => ({ ...current, [item.id]: { ...current[item.id], loading: '', error: error.message } })); }
  }

  if (!code) return <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4"><form onSubmit={enter} className="card p-6 w-full max-w-sm space-y-4"><h1 className="text-xl font-bold dark:text-white">Concierge admin</h1><input autoFocus type="password" className="input" placeholder="Admin code" value={draftCode} onChange={e => setDraftCode(e.target.value)} /><button className="btn-primary w-full">Enter</button></form></main>;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8"><div className="max-w-6xl mx-auto space-y-5"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold dark:text-white">Concierge queue</h1><button className="btn-secondary" onClick={() => void load()}>Refresh</button></div>
      {pageError && <p className="text-sm text-red-600">{pageError}</p>}{loading ? <Loader2 className="w-6 h-6 animate-spin text-brand" /> : requests.length === 0 ? <div className="card p-6 text-sm text-gray-500">No concierge requests.</div> : requests.map(item => {
        const state = actionState[item.id] || {}; const parsed = parseClientCsv(item.csv_content); const overdue = item.status === 'pending' && Date.now() > new Date(item.created_at).getTime() + 48 * 60 * 60 * 1000;
        return <section key={item.id} className="card p-5 space-y-4"><div className="flex flex-wrap gap-3 justify-between"><div><h2 className="font-bold dark:text-white">{item.business_name}</h2><p className="text-xs text-gray-500">{item.client_count ?? 'Unknown'} clients · {new Date(item.created_at).toLocaleString()}</p></div><div className="flex items-center gap-2"><span className={item.status === 'done' ? 'badge-success' : 'badge-warning'}>{item.status}</span>{item.status === 'pending' && <span className={`text-xs font-semibold ${overdue ? 'text-red-600' : 'text-gray-500'}`}>{overdue ? '48h deadline overdue' : `Due ${new Date(new Date(item.created_at).getTime() + 172800000).toLocaleString()}`}</span>}</div></div>
          <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setOpenPreview(openPreview === item.id ? null : item.id)}>Preview</button><button className="btn-primary" disabled={Boolean(state.loading) || state.imported || item.imported_client_ids?.length > 0} onClick={() => void run(item, 'import')}>{state.loading === 'import' ? 'Importing…' : 'Import clients'}</button><button className="btn-secondary" disabled={Boolean(state.loading) || item.status === 'pending' || state.scheduled} onClick={() => void run(item, 'schedule')}>{state.loading === 'schedule' ? 'Scheduling…' : 'Schedule first week'}</button>{state.schedule?.jobs?.length > 0 && <button className="btn-secondary text-red-600" disabled={Boolean(state.loading)} onClick={() => void run(item, 'undo_schedule', { job_ids: state.schedule.jobs.map(job => job.id) })}>Undo schedule</button>}<button className="btn-secondary" disabled={Boolean(state.loading) || item.status === 'done'} onClick={() => void run(item, 'done')}>Mark done</button></div>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}{state.import && <p className="text-sm">Created {state.import.created} clients. Skipped {state.import.skipped?.length || 0} rows.</p>}{state.import?.skipped?.map(error => <p key={`${error.row}-${error.message}`} className="text-xs text-red-600">Row {error.row}: {error.message}</p>)}{state.schedule && <p className="text-sm">Created {state.schedule.jobs?.length || 0} jobs.</p>}
          {openPreview === item.id && <div className="overflow-x-auto"><p className="text-sm font-semibold mb-2">{parsed.rows.length} valid rows · {parsed.errors.length} skipped</p><table className="w-full text-xs"><thead><tr className="text-left border-b"><th className="p-2">Name</th><th className="p-2">Address</th><th className="p-2">Phone</th><th className="p-2">Email</th><th className="p-2">Rate</th></tr></thead><tbody>{parsed.rows.slice(0,50).map((row,index)=><tr key={index} className="border-b"><td className="p-2">{row.name}</td><td className="p-2">{row.address}</td><td className="p-2">{row.phone}</td><td className="p-2">{row.email}</td><td className="p-2">{row.rate}</td></tr>)}</tbody></table>{parsed.errors.map(error=><p key={`${error.row}-${error.message}`} className="text-xs text-red-600 mt-1">Row {error.row}: {error.message}</p>)}</div>}
        </section>;
      })}
    </div></main>
  );
}
