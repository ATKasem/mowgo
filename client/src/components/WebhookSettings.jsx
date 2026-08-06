import { useState, useEffect, useRef, useCallback } from 'react';
import useLocalizedText from '../i18n/useLocalizedText';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../App';
import { Webhook, Save, CheckCircle, Loader2, AlertCircle, Trash2, Zap, Plus, Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';

const AVAILABLE_EVENTS = [
  { key: 'job.created',        label: 'Job Created',         desc: 'Fired when a new job is scheduled' },
  { key: 'job.updated',        label: 'Job Updated',         desc: 'Fired when job status, date, or details change' },
  { key: 'job.completed',      label: 'Job Completed',       desc: 'Fired when a job status changes to completed' },
  { key: 'invoice.paid',       label: 'Invoice Paid',        desc: 'Fired when an invoice is marked paid' },
  { key: 'customer.created',   label: 'Customer Created',    desc: 'Fired when a new client is added' },
  { key: 'lead.created',       label: 'Lead Created',         desc: 'Fired when a new lead is captured' },
  { key: 'lead.status.updated', label: 'Lead Status Updated', desc: 'Fired when a lead moves through the pipeline' },
  { key: 'payment.failed',     label: 'Payment Failed',      desc: 'Fired when a Stripe payment fails' },
  { key: 'rain.delay.applied', label: 'Rain Delay Applied',  desc: 'Fired when jobs are rescheduled due to rain' },
];

function generateSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function SecretDisplay({ secret }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may not be available */ }
  }

  const masked = revealed ? secret : '•'.repeat(Math.min(64, Math.max(16, (secret || '').length)));

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <code className="flex-1 text-[11px] font-mono bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 text-gray-600 dark:text-gray-400 truncate select-all">
        {masked}
      </code>
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
      >
        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 text-gray-400 dark:text-gray-500 hover:text-emerald-500 transition-colors"
        aria-label="Copy secret"
      >
        {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function WebhookEndpoint({ config, onUpdate, onDelete }) {
  const { tr } = useLocalizedText('settings');
  const [url, setUrl] = useState(config.url || '');
  const [label, setLabel] = useState(config.label || '');
  const [enabledEvents, setEnabledEvents] = useState(config.events || []);

  useEffect(() => {
    setUrl(config.url || '');
    setLabel(config.label || '');
    setEnabledEvents(config.events || []);
  }, [config.url, config.label, JSON.stringify(config.events)]);

  function toggleEvent(eventKey) {
    const next = enabledEvents.includes(eventKey)
      ? enabledEvents.filter((e) => e !== eventKey)
      : [...enabledEvents, eventKey];
    setEnabledEvents(next);
    onUpdate({ ...config, events: next });
  }

  function toggleAll() {
    const next = enabledEvents.length === AVAILABLE_EVENTS.length
      ? []
      : AVAILABLE_EVENTS.map((e) => e.key);
    setEnabledEvents(next);
    onUpdate({ ...config, events: next });
  }

  function handleUrlChange(val) {
    setUrl(val);
    onUpdate({ ...config, url: val });
  }

  function handleLabelChange(val) {
    setLabel(val);
    onUpdate({ ...config, label: val });
  }

  function handleRegenerateSecret() {
    if (!window.confirm(tr('Generate a new secret? Your old secret will stop working immediately.'))) return;
    onUpdate({ ...config, secret: generateSecret() });
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-4 h-4 text-violet-500 flex-shrink-0" />
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder={tr('Label (optional)')}
            className="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-none outline-none p-0 min-w-0 flex-1 placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
        </div>
        <button
          type="button"
          onClick={() => onDelete(config.id)}
          className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
          aria-label={tr('Remove webhook')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* URL */}
      <div>
        <label className="label">{tr('Webhook URL')}</label>
        <input
          type="url"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://hooks.zapier.com/hooks/catch/123456/abcdef/"
          className="input"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {tr('Paste your Zapier Catch Hook URL, or any endpoint that accepts POST JSON.')}
        </p>
      </div>

      {/* Secret */}
      <div>
        <div className="flex items-center justify-between">
          <label className="label mb-0">{tr('Signing Secret')}</label>
          <button
            type="button"
            onClick={handleRegenerateSecret}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-emerald-500 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />{tr('Regenerate')}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
          {tr('Each delivery includes an X-MowGo-Signature header (HMAC-SHA256) so you can verify it came from MowGo.')}
        </p>
        <SecretDisplay secret={config.secret} />
      </div>

      {/* Event toggles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">{tr('Events')}</label>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {enabledEvents.length === AVAILABLE_EVENTS.length ? tr('Deselect All') : tr('Select All')}
          </button>
        </div>
        <div className="space-y-1.5">
          {AVAILABLE_EVENTS.map((evt) => {
            const isEnabled = enabledEvents.includes(evt.key);
            return (
              <label
                key={evt.key}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className={`w-3 h-3 flex-shrink-0 ${isEnabled ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{tr(evt.label)}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{tr(evt.desc)}</p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={tr(evt.label)}
                  onClick={() => toggleEvent(evt.key)}
                  className={`relative w-9 h-[20px] rounded-full transition-colors duration-200 flex-shrink-0 ml-2 ${isEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isEnabled ? 'translate-x-[16px]' : ''}`} />
                </button>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function WebhookSettings() {
  const { tr } = useLocalizedText('settings');
  const { user } = useAuth();
  const [endpoints, setEndpoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const savedTimer = useRef(null);
  const pendingUpdatesRef = useRef(new Map());

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  useEffect(() => { loadConfigs(); }, [user]);

  async function loadConfigs() {
    if (isDemoMode() || !user) { setLoading(false); return; }
    try {
      const { data, error: fetchErr } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (fetchErr) throw fetchErr;
      setEndpoints(data || []);
    } catch (err) {
      console.error('loadConfigs:', err);
      setError(err.message || tr('Failed to load webhook config'));
    } finally {
      setLoading(false);
    }
  }

  function addEndpoint() {
    const newEndpoint = {
      id: `pending_${Date.now()}`,
      user_id: user?.id,
      url: '',
      label: '',
      events: [],
      secret: generateSecret(),
      is_active: true,
      _isNew: true,
    };
    setEndpoints((prev) => [...prev, newEndpoint]);
  }

  function updateEndpoint(updated) {
    setEndpoints((prev) => prev.map((ep) => (ep.id === updated.id ? updated : ep)));
    // Track dirty endpoints for batch save
    pendingUpdatesRef.current.set(updated.id, updated);
    setSaved(false);
  }

  function deleteEndpoint(id) {
    if (!window.confirm(tr('Remove this webhook endpoint?'))) return;
    setEndpoints((prev) => prev.filter((ep) => ep.id !== id));
    // Mark for deletion on save
    pendingUpdatesRef.current.set(id, { _deleted: true });
    setSaved(false);
  }

  async function handleSave() {
    if (!user) { setError(tr('Session expired. Please sign in again.')); return; }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const toDelete = [];
      const toUpsert = [];

      for (const ep of endpoints) {
        if (ep._deleted) {
          if (!ep._isNew) toDelete.push(ep.id);
        } else {
          toUpsert.push({
            id: ep._isNew ? undefined : ep.id,
            user_id: user.id,
            url: ep.url.trim(),
            label: ep.label || null,
            events: ep.events,
            secret: ep.secret,
            is_active: true,
          });
        }
      }

      // Delete removed endpoints
      for (const id of toDelete) {
        const { error: delErr } = await supabase.from('webhook_configs').delete().eq('id', id);
        if (delErr) throw delErr;
      }

      // Upsert remaining endpoints
      for (const row of toUpsert) {
        if (row.id) {
          const { id: _id, ...updates } = row;
          const { error: upErr } = await supabase.from('webhook_configs').update(updates).eq('id', _id);
          if (upErr) throw upErr;
        } else {
          const { id: _omit, ...insert } = row;
          const { data, error: insErr } = await supabase
            .from('webhook_configs')
            .insert(insert)
            .select()
            .single();
          if (insErr) throw insErr;
          // Update local state with the real id
          setEndpoints((prev) =>
            prev.map((ep) => (ep.id === row.id ? { ...ep, id: data.id, _isNew: false } : ep)),
          );
        }
      }

      pendingUpdatesRef.current.clear();
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('save webhook configs:', err);
      setError(err.message || tr('Failed to save webhook config'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
          <Webhook className="w-4 h-4 text-violet-500" />
          {tr('Outgoing Webhooks')}
        </h4>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
          <Webhook className="w-4 h-4 text-violet-500" />
          {tr('Outgoing Webhooks')}
        </h4>
        <button
          type="button"
          onClick={addEndpoint}
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />{tr('Add Webhook')}
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr('Automatically send job and invoice events to any URL. Works with Zapier Catch Hooks, Make, n8n, or custom endpoints.')}
      </p>

      {/* Endpoint list */}
      {endpoints.length > 0 ? (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <WebhookEndpoint
              key={ep.id}
              config={ep}
              onUpdate={updateEndpoint}
              onDelete={deleteEndpoint}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {tr('No webhooks configured. Click "Add Webhook" to get started.')}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || endpoints.every((ep) => !ep.url?.trim())}
        className={`btn-primary w-full transition-all duration-300 ${
          saved ? '!bg-emerald-500 hover:!bg-emerald-600 !shadow-emerald-200 dark:!shadow-emerald-900/30 shadow-lg' : ''
        }`}
      >
        {saved ? (
          <><CheckCircle className="w-4 h-4" />{tr('Saved')}</>
        ) : saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" />{tr('Saving...')}</>
        ) : (
          <><Save className="w-4 h-4" />{tr('Save Webhook Settings')}</>
        )}
      </button>

      {/* Quick-start hint */}
      <div className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-3">
        <p className="font-medium text-gray-500 dark:text-gray-400 mb-1">{tr('Quick Start — Zapier')}</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>{tr('Create a new Zap at zapier.com')}</li>
          <li>{tr('Choose "Webhooks by Zapier" as the trigger')}</li>
          <li>{tr('Select "Catch Hook" and copy the URL')}</li>
          <li>{tr('Paste it above, pick your events, and save')}</li>
          <li>{tr('Set up your action (QuickBooks, Mailchimp, Google Sheets, etc.)')}</li>
        </ol>
        <p className="font-medium text-gray-500 dark:text-gray-400 mt-3 mb-1">{tr('Signature Verification')}</p>
        <p className="text-[11px] leading-relaxed">
          {tr('Each delivery includes an X-MowGo-Signature header. Verify it by computing HMAC-SHA256 of the request body using your signing secret. This confirms the webhook came from MowGo.')}
        </p>
      </div>
    </div>
  );
}
