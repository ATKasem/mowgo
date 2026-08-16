import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Upload } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { parseCsv, MOWGO_FIELDS } from '../utils/csvParser';
import { fireWebhook } from '../lib/data';

const STEPS = ['upload', 'preview', 'configure', 'import', 'schedules', 'results'];
const BATCH_SIZE = 50;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_ROWS = 2000;
const MAX_RATE = 99999.99;
const FREE_CLIENT_LIMIT = 5;
const FREE_TIERS = [undefined, null, '', 'free'];
const FIELD_LABELS = { name: 'Name', address: 'Address', phone: 'Phone', email: 'Email', notes: 'Notes' };
const FREQUENCIES = ['weekly', 'biweekly', 'monthly'];
const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function isValidRate(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_RATE;
}

/** Builds name+address / name+phone lookup sets from a client's existing clients. */
function buildExistingKeys(existingClients) {
  const nameAddress = new Set();
  const namePhone = new Set();
  (existingClients || []).forEach(client => {
    const name = (client.name || '').trim().toLowerCase();
    if (!name) return;
    const address = (client.address || '').trim().toLowerCase();
    const phone = (client.phone || '').trim();
    if (address) nameAddress.add(`${name}|${address}`);
    if (phone) namePhone.add(`${name}|${phone.replace(/\D/g, '')}`);
  });
  return { nameAddress, namePhone };
}

/**
 * Applies the column mapping, drops rows with no name, dedupes within the
 * CSV (by name+address / name+phone, only when those fields are populated),
 * and skips rows that already match an existing client for this account.
 */
function buildImportRows(rows, columnMap, existingKeys) {
  const seenNameAddress = new Set();
  const seenNamePhone = new Set();
  let skippedMissingName = 0;
  let skippedDuplicates = 0;
  let skippedExisting = 0;
  const result = [];

  rows.forEach(row => {
    const get = field => (columnMap[field] ? (row[columnMap[field]] || '').trim() : '');
    const name = get('name');
    if (!name) { skippedMissingName += 1; return; }
    const address = get('address');
    const phone = get('phone');
    const email = get('email');
    const notes = get('notes');
    const nameKey = name.toLowerCase();
    // Only use the compound key when the field it depends on is populated —
    // an all-blank address/phone must never match every other blank row.
    const key1 = address ? `${nameKey}|${address.toLowerCase()}` : '';
    const key2 = phone ? `${nameKey}|${phone.replace(/\D/g, '')}` : '';

    if ((key1 && existingKeys.nameAddress.has(key1)) || (key2 && existingKeys.namePhone.has(key2))) {
      skippedExisting += 1; return;
    }
    if ((key1 && seenNameAddress.has(key1)) || (key2 && seenNamePhone.has(key2))) {
      skippedDuplicates += 1; return;
    }
    if (key1) seenNameAddress.add(key1);
    if (key2) seenNamePhone.add(key2);
    result.push({ name, address, phone, email, notes });
  });

  return { rows: result, skippedMissingName, skippedDuplicates, skippedExisting };
}

export default function ImportFromYardbook() {
  const { tr } = useLocalizedText('import_yardbook');
  const { user } = useAuth();
  const [step, setStep] = useState('upload');
  const [rawText, setRawText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState({ headers: [], rows: [], detectedMap: {}, errors: [] });
  const [columnMap, setColumnMap] = useState({});
  const [defaultRate, setDefaultRate] = useState('0');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [existingClients, setExistingClients] = useState([]);
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [existingRefresh, setExistingRefresh] = useState(0);
  const [scheduleBulk, setScheduleBulk] = useState({ frequency: 'weekly', days: [1], time: '08:00', duration: 60, title: 'Lawn Care' });
  const [clientSchedules, setClientSchedules] = useState([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [schedulesCreated, setSchedulesCreated] = useState(0);

  // Preflight: know what this account already has so re-importing the same
  // CSV (or overlapping exports) doesn't create duplicate clients.
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase.from('clients').select('name,address,phone').eq('user_id', user.id)
      .then(({ data }) => { if (active) { setExistingClients(data || []); setExistingLoaded(true); } });
    return () => { active = false; };
  }, [user?.id, existingRefresh]);

  const existingKeys = useMemo(() => buildExistingKeys(existingClients), [existingClients]);
  const importPreview = useMemo(() => buildImportRows(parsed.rows, columnMap, existingKeys), [parsed.rows, columnMap, existingKeys]);
  const rateValid = isValidRate(defaultRate);

  function readFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError(tr('That file is too large — CSV imports are limited to 2MB.')); return; }
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result || ''));
    reader.onerror = () => setError(tr('Could not read that file.'));
    reader.readAsText(file);
  }

  function goToPreview() {
    setError('');
    if (new Blob([rawText]).size > MAX_FILE_BYTES) { setError(tr('That CSV is too large — imports are limited to 2MB.')); return; }
    const result = parseCsv(rawText);
    if (result.rows.length === 0) { setError(tr('No rows found in that CSV. Paste your data or upload a file first.')); return; }
    if (result.rows.length > MAX_ROWS) { setError(tr('That CSV has {{count}} rows — imports are limited to {{max}} rows at a time. Split it into smaller files.', { count: result.rows.length, max: MAX_ROWS })); return; }
    setParsed(result);
    setColumnMap({ ...result.detectedMap });
    setStep('preview');
  }

  function goToConfigure() {
    if (!columnMap.name) { setError(tr('Map a column to Name before continuing — it is required.')); return; }
    setError('');
    setStep('configure');
  }

  async function runImport() {
    if (!rateValid) { setError(tr('Enter a default rate between $0 and $99,999.99.')); return; }
    setError('');
    setStep('import');

    let rows = importPreview.rows;
    const totalCandidates = rows.length;
    let capMessage = '';

    const [{ data: profile }, { count: currentCount }] = await Promise.all([
      supabase.from('profiles').select('tier').eq('id', user?.id).single(),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', user?.id),
    ]);

    if (FREE_TIERS.includes(profile?.tier)) {
      const remaining = Math.max(0, FREE_CLIENT_LIMIT - (currentCount || 0));
      if (rows.length > remaining) {
        capMessage = tr('Free plan is limited to {{limit}} clients total — importing {{remaining}} of {{count}} rows. Upgrade for unlimited clients.', { limit: FREE_CLIENT_LIMIT, remaining, count: rows.length });
        rows = rows.slice(0, remaining);
      }
    }

    setProgress({ done: 0, total: rows.length });
    const imported = [];
    const insertedRows = [];
    let stoppedReason = '';
    const rate = Number(defaultRate);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batchRows = rows.slice(i, i + BATCH_SIZE);
      const batch = batchRows.map(row => ({
        user_id: user?.id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        email: row.email,
        cleaning_notes: row.notes,
        rate,
        tags: [],
      }));
      const { data, error: insertError } = await supabase.from('clients').insert(batch).select('id, name, address, phone');
      if (insertError) {
        if (insertError.message?.includes('row-level security') || insertError.code === '42501') {
          stoppedReason = tr('Your account does not have permission to add clients. Only the business owner can import clients.');
        } else {
          stoppedReason = insertError.message || tr('Import failed.');
        }
        break;
      }
      imported.push(...(data || []));
      insertedRows.push(...batchRows);
      setProgress({ done: Math.min(i + batch.length, rows.length), total: rows.length });
    }

    // Extend the dedup set so re-importing (or another file) in this same
    // session doesn't re-create the clients we just inserted.
    if (insertedRows.length > 0) {
      setExistingClients(prev => [...prev, ...insertedRows.map(r => ({ name: r.name, address: r.address, phone: r.phone }))]);
    }

    // Fire webhooks for imported clients (non-blocking — never blocks the flow)
    if (imported.length > 0) {
      fireWebhook('clients.imported', { count: imported.length, clients: imported.map(c => ({ id: c.id, name: c.name })) });
    }

    const status = imported.length === 0 ? 'failure' : (imported.length < totalCandidates ? 'partial' : 'success');

    setResults({
      imported,
      status,
      totalCandidates,
      skippedMissingName: importPreview.skippedMissingName,
      skippedDuplicates: importPreview.skippedDuplicates,
      skippedExisting: importPreview.skippedExisting,
      stoppedReason,
      capMessage,
      capHit: Boolean(capMessage) || stoppedReason.includes('Free plan is limited to'),
    });

    if (imported.length > 0) {
      setClientSchedules(imported.map(client => ({
        clientId: client.id,
        name: client.name,
        address: client.address,
        phone: client.phone,
        selected: true,
        frequency: scheduleBulk.frequency,
        days: [...scheduleBulk.days],
        time: scheduleBulk.time,
        duration: scheduleBulk.duration,
        title: scheduleBulk.title,
      })));
      setStep('schedules');
    } else {
      setStep('results');
    }
  }

  function toggleBulkDay(day) {
    setScheduleBulk(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day].sort((a, b) => a - b),
    }));
  }

  function applyBulkToSelected() {
    setClientSchedules(prev => prev.map(row => (
      row.selected
        ? { ...row, frequency: scheduleBulk.frequency, days: [...scheduleBulk.days], time: scheduleBulk.time, duration: scheduleBulk.duration, title: scheduleBulk.title }
        : row
    )));
  }

  function toggleClientSelected(clientId) {
    setClientSchedules(prev => prev.map(row => (row.clientId === clientId ? { ...row, selected: !row.selected } : row)));
  }

  function updateClientRow(clientId, patch) {
    setClientSchedules(prev => prev.map(row => (row.clientId === clientId ? { ...row, ...patch } : row)));
  }

  async function confirmSchedules() {
    const selectedRows = clientSchedules.filter(row => row.selected && row.days.length > 0);
    if (selectedRows.length === 0) { setStep('results'); return; }

    setScheduleSaving(true);
    setError('');
    const today = new Date().toISOString().slice(0, 10);
    const rows = selectedRows.map(row => ({
      user_id: user?.id,
      client_id: row.clientId,
      title: row.title || 'Lawn Care',
      scheduled_time: row.time || null,
      duration_minutes: Math.max(1, Math.min(480, Number(row.duration) || 60)),
      frequency: row.frequency,
      days_of_week: row.days,
      is_active: true,
      start_date: today,
    }));

    const { data, error: insertError } = await supabase.from('recurring_jobs').insert(rows).select('id');
    setScheduleSaving(false);
    if (insertError) {
      setError(insertError.message || tr('Could not create recurring schedules.'));
      return;
    }
    setSchedulesCreated(data?.length || 0);
    setStep('results');
  }

  function skipSchedules() {
    setSchedulesCreated(0);
    setStep('results');
  }

  function startOver() {
    setStep('upload');
    setRawText('');
    setParsed({ headers: [], rows: [], detectedMap: {}, errors: [] });
    setColumnMap({});
    setDefaultRate('0');
    setProgress({ done: 0, total: 0 });
    setResults(null);
    setError('');
    setClientSchedules([]);
    setSchedulesCreated(0);
    setScheduleBulk({ frequency: 'weekly', days: [1], time: '08:00', duration: 60, title: 'Lawn Care' });
    setExistingLoaded(false);
    setExistingRefresh(prev => prev + 1);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{tr('Import from Yardbook')}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">{tr('Bring your customer list over in a couple of minutes.')}</p>
      </div>

      <StepIndicator step={step} tr={tr} />

      {error && <div role="alert" className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 mb-4"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}

      {step === 'upload' && (
        <div className="card p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <label
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files?.[0]); }}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${dragging ? 'border-brand bg-emerald-50 dark:bg-emerald-950/20' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <Upload className="w-6 h-6 text-brand" />
              <span className="text-sm font-semibold">{tr('Upload your Yardbook CSV export')}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{tr('Drag and drop or browse')}</span>
              <input className="sr-only" type="file" accept=".csv,.txt" onChange={e => readFile(e.target.files?.[0])} />
            </label>
            <div>
              <label className="label">{tr('Or paste it')}</label>
              <textarea className="input min-h-40 resize-y" value={rawText} onChange={e => setRawText(e.target.value)} placeholder={tr('Paste your exported customer CSV here')} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={!rawText.trim()} onClick={goToPreview}>{tr('Continue')}<ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="card p-5 space-y-5">
          <div>
            <p className="text-sm font-semibold">{tr('{{count}} rows found', { count: parsed.rows.length })}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('Confirm which columns map to each MowGo field.')}</p>
          </div>

          {parsed.errors && parsed.errors.length > 0 && (
            <div role="alert" className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{tr('{{count}} issues found in this CSV', { count: parsed.errors.length })}</p>
                <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside">
                  {parsed.errors.slice(0, 10).map((e, idx) => (
                    <li key={idx}>{e.row === 0 ? tr('Header') : tr('Row {{row}}', { row: e.row })}: {e.message}</li>
                  ))}
                </ul>
                {parsed.errors.length > 10 && <p className="mt-1">{tr('+ {{count}} more', { count: parsed.errors.length - 10 })}</p>}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {MOWGO_FIELDS.map(field => (
              <div key={field}>
                <label className="label">{tr(FIELD_LABELS[field])}{field === 'name' && ' *'}</label>
                <select className="input" value={columnMap[field] || ''} onChange={e => setColumnMap({ ...columnMap, [field]: e.target.value })}>
                  <option value="">{tr("— Don't import —")}</option>
                  {parsed.headers.map(header => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b dark:border-gray-700">
                  {parsed.headers.map(header => <th key={header} className="p-2 whitespace-nowrap">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 5).map((row, index) => (
                  <tr key={index} className="border-b dark:border-gray-800">
                    {parsed.headers.map(header => <td key={header} className="p-2 whitespace-nowrap">{row[header]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button type="button" className="btn-secondary" onClick={() => setStep('upload')}><ArrowLeft className="w-4 h-4" />{tr('Back')}</button>
            <button className="btn-primary" onClick={goToConfigure}>{tr('Continue')}<ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {step === 'configure' && (
        <div className="card p-5 space-y-5">
          <div>
            <label className="label">{tr('Default rate ($/visit)')}</label>
            <input className="input" type="number" min="0" max={MAX_RATE} step="0.01" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('Applied to every imported client — you can adjust rates individually afterward.')}</p>
            {!rateValid && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{tr('Enter a rate between $0 and $99,999.99.')}</p>}
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 text-sm space-y-1">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">{tr('{{count}} clients ready to import', { count: importPreview.rows.length })}</p>
            {importPreview.skippedMissingName > 0 && <p className="text-xs text-[var(--color-text-muted)]">{tr('{{count}} rows skipped — missing name', { count: importPreview.skippedMissingName })}</p>}
            {importPreview.skippedDuplicates > 0 && <p className="text-xs text-[var(--color-text-muted)]">{tr('{{count}} duplicate rows skipped', { count: importPreview.skippedDuplicates })}</p>}
            {importPreview.skippedExisting > 0 && <p className="text-xs text-[var(--color-text-muted)]">{tr('{{count}} rows skipped — already in your client list', { count: importPreview.skippedExisting })}</p>}
            {!existingLoaded && <p className="text-xs text-[var(--color-text-muted)]">{tr('Checking your existing clients for duplicates...')}</p>}
          </div>

          <div className="flex justify-between">
            <button type="button" className="btn-secondary" onClick={() => setStep('preview')}><ArrowLeft className="w-4 h-4" />{tr('Back')}</button>
            <button className="btn-primary" disabled={importPreview.rows.length === 0 || !rateValid || !existingLoaded} onClick={runImport}>{tr('Import {{count}} clients', { count: importPreview.rows.length })}</button>
          </div>
        </div>
      )}

      {step === 'import' && (
        <div className="card p-8 flex flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <p className="text-sm font-semibold">{tr('Importing clients...')}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{tr('{{done}} of {{total}}', { done: progress.done, total: progress.total })}</p>
          <div className="w-full max-w-xs h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {step === 'schedules' && (
        <div className="card p-5 space-y-5">
          <div>
            <p className="text-sm font-semibold">{tr('Set up recurring schedules')}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('Yardbook does not export recurring schedules, so set the visit frequency for your imported clients now, or skip and set them up later.')}</p>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{tr('Bulk settings')}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">{tr('Title')}</label>
                <input className="input" type="text" value={scheduleBulk.title} onChange={e => setScheduleBulk({ ...scheduleBulk, title: e.target.value })} />
              </div>
              <div>
                <label className="label">{tr('Frequency')}</label>
                <select className="input" value={scheduleBulk.frequency} onChange={e => setScheduleBulk({ ...scheduleBulk, frequency: e.target.value })}>
                  {FREQUENCIES.map(freq => <option key={freq} value={freq}>{tr(freq)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{tr('Time')}</label>
                <input className="input" type="time" value={scheduleBulk.time} onChange={e => setScheduleBulk({ ...scheduleBulk, time: e.target.value })} />
              </div>
              <div>
                <label className="label">{tr('Duration (minutes)')}</label>
                <input className="input" type="number" min="1" value={scheduleBulk.duration} onChange={e => setScheduleBulk({ ...scheduleBulk, duration: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">{tr('Day of week')}</label>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day.value} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={scheduleBulk.days.includes(day.value)} onChange={() => toggleBulkDay(day.value)} />
                    {tr(day.label)}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-secondary text-sm" onClick={applyBulkToSelected}>{tr('Apply to selected')}</button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {clientSchedules.map(row => (
              <div key={row.clientId} className="flex flex-wrap items-center gap-2 border-b dark:border-gray-800 pb-2">
                <input type="checkbox" checked={row.selected} onChange={() => toggleClientSelected(row.clientId)} />
                <div className="min-w-32">
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{row.address || row.phone || ''}</p>
                </div>
                <select className="input w-auto text-xs" disabled={!row.selected} value={row.frequency} onChange={e => updateClientRow(row.clientId, { frequency: e.target.value })}>
                  {FREQUENCIES.map(freq => <option key={freq} value={freq}>{tr(freq)}</option>)}
                </select>
                <div className="flex gap-1.5">
                  {DAYS_OF_WEEK.map(day => (
                    <label key={day.value} className="flex items-center gap-0.5 text-xs">
                      <input
                        type="checkbox"
                        disabled={!row.selected}
                        checked={row.days.includes(day.value)}
                        onChange={() => updateClientRow(row.clientId, { days: row.days.includes(day.value) ? row.days.filter(d => d !== day.value) : [...row.days, day.value].sort((a, b) => a - b) })}
                      />
                      {tr(day.label)}
                    </label>
                  ))}
                </div>
                <input className="input w-auto text-xs" type="time" disabled={!row.selected} value={row.time} onChange={e => updateClientRow(row.clientId, { time: e.target.value })} />
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button type="button" className="btn-secondary" onClick={skipSchedules}>{tr('Skip this step')}</button>
            <button className="btn-primary" disabled={scheduleSaving} onClick={confirmSchedules}>
              {scheduleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {tr('Create {{count}} schedules', { count: clientSchedules.filter(r => r.selected && r.days.length > 0).length })}
            </button>
          </div>
        </div>
      )}

      {step === 'results' && results && (
        <div className="card p-5 space-y-5">
          <div className="flex items-start gap-3">
            {results.status === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />}
            {results.status === 'partial' && <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />}
            {results.status === 'failure' && <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold text-[var(--color-text-primary)] dark:text-white">
                {results.status === 'success' && tr('{{count}} clients imported', { count: results.imported.length })}
                {results.status === 'partial' && tr('{{count}} of {{total}} clients imported', { count: results.imported.length, total: results.totalCandidates })}
                {results.status === 'failure' && tr('Import failed — no clients were added')}
              </p>
              {(results.skippedMissingName > 0 || results.skippedDuplicates > 0 || results.skippedExisting > 0) && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('{{count}} rows skipped (missing name, duplicate, or already in your client list)', { count: results.skippedMissingName + results.skippedDuplicates + results.skippedExisting })}</p>
              )}
              {results.imported.length > 0 && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {schedulesCreated > 0
                    ? tr('{{count}} recurring schedules created', { count: schedulesCreated })
                    : tr('No recurring schedules created')}
                </p>
              )}
            </div>
          </div>

          {(results.stoppedReason || results.capMessage) && (
            <div role="alert" className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p>{results.capHit ? (results.capMessage || tr("You've hit the free plan limit — upgrade to import the rest.")) : results.stoppedReason}</p>
                {results.capHit && <Link to="/subscribe" className="text-sm font-semibold underline">{tr('See plans')}</Link>}
              </div>
            </div>
          )}

          {results.imported.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">{tr('Imported')}</p>
              <ul className="text-sm space-y-1">
                {results.imported.slice(0, 10).map(client => <li key={client.id}>{client.name}</li>)}
              </ul>
              {results.imported.length > 10 && <p className="text-xs text-[var(--color-text-muted)] mt-2">{tr('+ {{count}} more', { count: results.imported.length - 10 })}</p>}
            </div>
          )}

          {results.imported.length > 0 && schedulesCreated === 0 && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-2">
              <p className="text-sm font-semibold">{tr('Set up recurring schedules later')}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{tr('You can set the visit frequency for each client from the Clients page any time.')}</p>
              <Link to="/app/clients" className="btn-primary inline-flex text-sm">{tr('Go to Clients')}</Link>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={startOver}>{tr('Import another file')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, tr }) {
  const labels = { upload: 'Upload', preview: 'Preview', configure: 'Configure', import: 'Import', schedules: 'Schedules', results: 'Results' };
  const currentIndex = STEPS.indexOf(step);
  return (
    <ol className="flex items-center gap-2 mb-5 text-xs font-semibold" aria-label={tr('Import steps')}>
      {STEPS.map((value, index) => (
        <li key={value} className={`flex items-center gap-2 ${index <= currentIndex ? 'text-brand' : 'text-[var(--color-text-muted)]'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${index <= currentIndex ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>{index + 1}</span>
          <span className="hidden sm:inline">{tr(labels[value])}</span>
          {index < STEPS.length - 1 && <span className="w-4 h-px bg-gray-200 dark:bg-gray-700" />}
        </li>
      ))}
    </ol>
  );
}
