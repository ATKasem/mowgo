import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy, FileText, Plus, X } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';
import { createEstimate, convertEstimateToJob, estimateNudgeText, estimateText, loadClients, loadEstimates, updateEstimateStatus } from '../lib/data';
import { ESTIMATE_STATUS } from '../lib/constants';

export default function EstimatesSection() {
  const { tr } = useLocalizedText('invoices');
  const [estimates, setEstimates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { Promise.all([loadEstimates(), loadClients()]).then(([e, c]) => { setEstimates(e); setClients(c); }).finally(() => setLoading(false)); }, []);
  const replace = useCallback(row => setEstimates(old => old.map(e => e.id === row.id ? row : e)), []);
  const copy = useCallback(async text => { await navigator.clipboard.writeText(text); setMessage(tr('Copied!')); setTimeout(() => setMessage(''), 2200); }, [tr]);
  const chooseClient = id => { setClientId(id); const client = clients.find(c => c.id === id); if (client) setAmount(String(client.rate || '')); };
  const save = async status => {
    const row = await createEstimate({ client_id: clientId, amount, note: note.trim() || null, status });
    setEstimates(old => [row, ...old]); setShowForm(false); setClientId(''); setAmount(''); setNote('');
    if (status === 'sent') await copy(estimateText(row));
  };
  const transition = async (estimate, status) => replace(await updateEstimateStatus(estimate.id, status));
  const convert = async estimate => { replace(await convertEstimateToJob(estimate)); setMessage(tr('Job created')); setTimeout(() => setMessage(''), 2200); };
  const isStale = estimate => estimate.status === 'sent' && estimate.sent_at && Date.now() - new Date(estimate.sent_at).getTime() > 3 * 86400000;

  if (loading) return <div className="card p-10 text-center text-[var(--color-text-muted)]">{tr('Loading estimates…')}</div>;
  return <div>
    <div className="flex items-center justify-between mb-4"><div><h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{tr('Estimates')}</h2><p className="text-sm text-[var(--color-text-secondary)]">{tr('{{count}} total', { count: estimates.length })}</p></div><button className="btn-primary gap-2" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" />{tr('New Estimate')}</button></div>
    {message && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">{message}</div>}
    {estimates.length === 0 ? <div className="card p-10 text-center"><FileText className="w-12 h-12 mx-auto text-gray-300 mb-3"/><p className="font-semibold">{tr('No estimates yet')}</p><p className="text-sm text-[var(--color-text-muted)]">{tr('Create one in 10 seconds')}</p></div> : <div className="space-y-2">{estimates.map(e => {
      const status = ESTIMATE_STATUS[e.status] || ESTIMATE_STATUS.draft; const open = expanded === e.id;
      return <div key={e.id} className="card cursor-pointer" onClick={() => setExpanded(open ? null : e.id)}><div className="p-4 flex justify-between gap-3"><div><p className="font-semibold text-sm">{e.clients?.name || tr('Unknown client')}</p><p className="text-xs text-[var(--color-text-muted)]">{e.created_at?.slice(0, 10)} · <b>${Number(e.amount).toFixed(2)}</b></p>{e.note && <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-1">{e.note}</p>}</div><div className="flex items-center gap-2"><span className={status.badge}>{tr(status.label)}</span>{e.job_id && <span className="text-xs text-emerald-600 font-semibold">{tr('Converted ✓')}</span>}</div></div>
      {open && <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3" onClick={event => event.stopPropagation()}><div className="text-xs text-[var(--color-text-muted)]">{tr('Created')}: {e.created_at?.slice(0, 10)}{e.sent_at ? ` · ${tr('Sent')}: ${e.sent_at.slice(0, 10)}` : ''}</div>{e.note && <p className="text-sm">{e.note}</p>}<div className="flex flex-wrap gap-2"><button className="btn-secondary text-xs" onClick={() => copy(estimateText(e))}><ClipboardCopy className="w-4 h-4"/>{tr('Copy text')}</button>{['draft','sent'].includes(e.status) && <><button className="btn-primary text-xs" onClick={() => transition(e, 'approved')}>{tr('Mark Approved')}</button><button className="btn-secondary text-xs text-red-600" onClick={() => transition(e, 'declined')}>{tr('Mark Declined')}</button></>}{isStale(e) && <button className="btn-secondary text-xs text-amber-600" onClick={() => copy(estimateNudgeText(e))}>{tr('Nudge')}</button>}{e.status === 'approved' && !e.job_id && <button className="btn-primary text-xs" onClick={() => convert(e)}>{tr('Convert to Job')}</button>}</div></div>}</div>;
    })}</div>}
    {showForm && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onMouseDown={() => setShowForm(false)}><div className="card w-full max-w-md p-5" onMouseDown={e => e.stopPropagation()}><div className="flex justify-between mb-4"><h3 className="font-bold text-lg">{tr('New Estimate')}</h3><button onClick={() => setShowForm(false)}><X className="w-5 h-5"/></button></div><label className="label">{tr('Client')}</label><select className="input w-full mb-3" value={clientId} onChange={e => chooseClient(e.target.value)}><option value="">{tr('Select a client')}</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><label className="label">{tr('Amount')}</label><input className="input w-full mb-3" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}/><label className="label">{tr('Note (optional)')}</label><textarea className="input w-full mb-5" value={note} onChange={e => setNote(e.target.value)}/><div className="flex gap-2"><button className="btn-secondary flex-1" disabled={!clientId || !amount} onClick={() => save('draft')}>{tr('Save Draft')}</button><button className="btn-primary flex-1" disabled={!clientId || !amount} onClick={() => save('sent')}>{tr('Send')}</button></div></div></div>}
  </div>;
}
