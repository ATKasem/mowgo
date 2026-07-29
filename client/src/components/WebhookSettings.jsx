import { useState, useEffect, useRef } from 'react';
import useLocalizedText from '../i18n/useLocalizedText';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../App';
import { Webhook, Save, CheckCircle, Loader2, AlertCircle, Trash2, Zap } from 'lucide-react';

const AVAILABLE_EVENTS = [
  { key: 'job.created',        label: 'Job Created',         desc: 'Fired when a new job is scheduled' },
  { key: 'job.updated',        label: 'Job Updated',         desc: 'Fired when job status, date, or details change' },
  { key: 'job.completed',      label: 'Job Completed',       desc: 'Fired when a job status changes to completed' },
  { key: 'invoice.paid',       label: 'Invoice Paid',        desc: 'Fired when an invoice is marked paid' },
  { key: 'customer.created',   label: 'Customer Created',    desc: 'Fired when a new client is added' },
  { key: 'payment.failed',     label: 'Payment Failed',      desc: 'Fired when a Stripe payment fails' },
  { key: 'rain.delay.applied', label: 'Rain Delay Applied',  desc: 'Fired when jobs are rescheduled due to rain' },
  // Note: payment.failed requires Stripe webhook wiring (Cloudflare Pages → Supabase edge function)
];

export default function WebhookSettings() {
  const { tr } = useLocalizedText('settings');
  const { user } = useAuth();
  const [zapierUrl, setZapierUrl] = useState('');
  const [enabledEvents, setEnabledEvents] = useState([]);
  const [configId, setConfigId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const savedTimer = useRef(null);

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, []);

  useEffect(() => {
    loadConfig();
  }, [user]);

  async function loadConfig() {
    if (isDemoMode() || !user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error: fetchErr } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (data) {
        setZapierUrl(data.zapier_url || '');
        setEnabledEvents(data.events || []);
        setConfigId(data.id);
      }
    } catch (err) {
      console.error('loadConfig:', err);
      setError(err.message || tr('Failed to load webhook config'));
    } finally {
      setLoading(false);
    }
  }

  function toggleEvent(eventKey) {
    setEnabledEvents((prev) =>
      prev.includes(eventKey)
        ? prev.filter((e) => e !== eventKey)
        : [...prev, eventKey]
    );
    setSaved(false);
  }

  function toggleAll() {
    if (enabledEvents.length === AVAILABLE_EVENTS.length) {
      setEnabledEvents([]);
    } else {
      setEnabledEvents(AVAILABLE_EVENTS.map((e) => e.key));
    }
    setSaved(false);
  }

  async function handleSave() {
    if (!user) { setError(tr('Session expired. Please sign in again.')); return; }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const row = {
        user_id: user.id,
        zapier_url: zapierUrl.trim(),
        events: enabledEvents,
        is_active: true,
      };

      if (configId) {
        const { error: upErr } = await supabase
          .from('webhook_configs')
          .update(row)
          .eq('id', configId);
        if (upErr) throw upErr;
      } else {
        const { data, error: insErr } = await supabase
          .from('webhook_configs')
          .insert(row)
          .select()
          .single();
        if (insErr) throw insErr;
        if (data) setConfigId(data.id);
      }
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('save webhook config:', err);
      setError(err.message || tr('Failed to save webhook config'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!configId) return;
    if (!window.confirm(tr('Remove webhook configuration?'))) return;
    try {
      const { error: delErr } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', configId);
      if (delErr) throw delErr;
      setConfigId(null);
      setZapierUrl('');
      setEnabledEvents([]);
    } catch (err) {
      setError(err.message || tr('Failed to delete webhook config'));
    }
  }

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
          <Webhook className="w-4 h-4 text-violet-500" />
          {tr('Zapier Webhooks')}
        </h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
          <Webhook className="w-4 h-4 text-violet-500" />
          {tr('Zapier Webhooks')}
        </h3>
        {configId && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
            aria-label={tr('Remove webhook')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr('Connect MowGo to 5,000+ apps via Zapier. When something happens in MowGo, it can automatically create invoices in QuickBooks, send emails via Mailchimp, update a Google Sheet, and more.')}
      </p>

      {/* Zapier webhook URL input */}
      <div>
        <label className="label">{tr('Zapier Webhook URL')}</label>
        <input
          type="url"
          value={zapierUrl}
          onChange={(e) => { setZapierUrl(e.target.value); setSaved(false); }}
          placeholder="https://hooks.zapier.com/hooks/catch/123456/abcdef/"
          className="input"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {tr('Get this URL from your Zapier Zap\'s trigger step. Look for "Webhooks by Zapier" → "Catch Hook".')}
        </p>
      </div>

      {/* Event toggles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">{tr('Events to Send')}</label>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {enabledEvents.length === AVAILABLE_EVENTS.length ? tr('Deselect All') : tr('Select All')}
          </button>
        </div>
        <div className="space-y-2">
          {AVAILABLE_EVENTS.map((evt) => {
            const isEnabled = enabledEvents.includes(evt.key);
            return (
              <label
                key={evt.key}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${isEnabled ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{tr(evt.label)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{tr(evt.desc)}</p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={tr(evt.label)}
                  onClick={() => toggleEvent(evt.key)}
                  className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0 ml-3 ${isEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isEnabled ? 'translate-x-[18px]' : ''}`} />
                </button>
              </label>
            );
          })}
        </div>
      </div>

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
        disabled={saving || !zapierUrl.trim()}
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
        <p className="font-medium text-gray-500 dark:text-gray-400 mb-1">{tr('Quick Start')}</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>{tr('Create a new Zap at zapier.com')}</li>
          <li>{tr('Choose "Webhooks by Zapier" as the trigger')}</li>
          <li>{tr('Select "Catch Hook" and copy the URL')}</li>
          <li>{tr('Paste it above, pick your events, and save')}</li>
          <li>{tr('Set up your action (QuickBooks, Mailchimp, Google Sheets, etc.)')}</li>
        </ol>
      </div>
    </div>
  );
}
