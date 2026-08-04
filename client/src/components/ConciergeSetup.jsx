import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';
import { useAuth } from '../App';
import { loadProfile } from '../lib/data';
import { cleanClientRows, parseClientCsv } from '../lib/csv-import';

export default function ConciergeSetup({ onDone }) {
  const { tr } = useLocalizedText('concierge');
  const { session } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [clientCount, setClientCount] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedText, setParsedText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => { loadProfile().then(profile => setBusinessName(profile?.business_name || '')).catch(() => {}); }, []);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setParsedText(rawText), 400);
    return () => clearTimeout(timer.current);
  }, [rawText]);
  const parsed = useMemo(() => {
    const result = parseClientCsv(parsedText);
    return { ...result, ...cleanClientRows(result.rows) };
  }, [parsedText]);

  function readFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setRawText(String(reader.result || '')); setParsedText(String(reader.result || '')); };
    reader.onerror = () => setError(tr('Could not read that file.'));
    reader.readAsText(file);
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/concierge-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ business_name: businessName.trim(), client_count: clientCount === '' ? null : Number(clientCount), csv_content: rawText }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || tr('Could not submit your request.'));
      setAlreadyExists(result.already_exists === true);
      setSuccess(true);
      onDone?.(result);
    } catch (err) { setError(err.message || tr('Could not submit your request.')); }
    finally { setSubmitting(false); }
  }

  if (success) return <div className="card p-6 text-center text-sm font-semibold text-brand">{alreadyExists ? tr("You're already in the concierge queue.") : tr("Request received — we'll set you up within 48 hours.")}</div>;

  return (
    <form onSubmit={submit} className="card p-5 space-y-5 text-left">
      <div><h2 className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white">{tr('Your done-for-you setup is included')}</h2><p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-1">{tr("Tell us about your business and we'll import your clients within 48 hours.")}</p></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="label">{tr('Business name')}</label><input className="input" value={businessName} maxLength={200} onChange={e => setBusinessName(e.target.value)} /></div>
        <div><label className="label">{tr('Client count (optional)')}</label><input className="input" type="number" min="0" step="1" value={clientCount} onChange={e => setClientCount(e.target.value)} /></div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <label onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0]); }} className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${dragging ? 'border-brand bg-emerald-50 dark:bg-emerald-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
          <Upload className="w-6 h-6 text-brand" /><span className="text-sm font-semibold">{tr('Upload a CSV or text file')}</span><span className="text-xs text-[var(--color-text-muted)]">{tr('Drag and drop or browse')}</span><input className="sr-only" type="file" accept=".csv,.txt" onChange={e => readFile(e.target.files?.[0])} />
        </label>
        <div><label className="label">{tr('Paste')}</label><textarea className="input min-h-32 resize-y" value={rawText} onChange={e => setRawText(e.target.value)} placeholder={tr('Paste your client list (from Excel or CSV)')} /></div>
      </div>
      {parsedText.trim() && <div className="space-y-3"><p className="text-sm font-semibold">{tr('{{count}} valid clients', { count: parsed.rows.length })}</p>{(parsed.cleaned > 0 || parsed.duplicates > 0) && <p className="text-xs text-emerald-600 dark:text-emerald-400">{tr("We'll organize your list automatically: {{cleaned}} rows tidied up, {{duplicates}} duplicates removed.", { cleaned: parsed.cleaned, duplicates: parsed.duplicates })}</p>}<div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left border-b dark:border-gray-700">{['Name','Address','Phone','Email','Rate'].map(h => <th key={h} className="p-2">{tr(h)}</th>)}</tr></thead><tbody>{parsed.rows.slice(0, 5).map((row, index) => <tr key={index} className="border-b dark:border-gray-800">{['name','address','phone','email','rate'].map(field => <td key={field} className="p-2">{row[field]}</td>)}</tr>)}</tbody></table></div>{parsed.errors.map(item => <p key={`${item.row}-${item.message}`} className="text-xs text-red-600 dark:text-red-400">{tr('Row {{row}}: {{message}}', { row: item.row, message: tr(item.message) })}</p>)}</div>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button className="btn-primary w-full" disabled={submitting || !businessName.trim() || parsed.rows.length < 1}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" />{tr('Submitting...')}</> : tr('Submit setup request')}</button>
    </form>
  );
}
