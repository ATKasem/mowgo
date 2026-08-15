import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, Plug, PlugZap, RefreshCw, Unlink } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';
import { isDemoMode } from '../lib/supabase';

function useQuickBooksStatus() {
  const [status, setStatus] = useState({
    loading: true,
    connected: false,
    companyName: null,
    lastSyncedAt: null,
    connectedAt: null,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    if (isDemoMode()) {
      setStatus({ loading: false, connected: false, companyName: null, lastSyncedAt: null, connectedAt: null, error: null });
      return;
    }
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch('/api/integrations/qbo-status');
      if (!res.ok) {
        setStatus({ loading: false, connected: false, companyName: null, lastSyncedAt: null, connectedAt: null, error: 'Failed to load status' });
        return;
      }
      const data = await res.json();
      setStatus({ loading: false, connected: data.connected, companyName: data.companyName, lastSyncedAt: data.lastSyncedAt, connectedAt: data.connectedAt, error: null });
    } catch (err) {
      setStatus({ loading: false, connected: false, companyName: null, lastSyncedAt: null, connectedAt: null, error: err.message || 'Connection failed' });
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return { ...status, refetch: fetchStatus };
}

export default function QuickBooksConnect() {
  const { tr } = useLocalizedText();
  const { loading, connected, companyName, lastSyncedAt, refetch } = useQuickBooksStatus();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState(null);

  // Handle OAuth callback
  useEffect(() => {
    if (window.location.hash.includes('qbo=connected')) {
      setMessage({ type: 'success', text: tr('quickbooks_sync_success') || 'QuickBooks connected successfully' });
      const hash = window.location.hash.replace(/[?&]qbo=connected/, '');
      window.history.replaceState(null, '', hash || '/#/settings');
      refetch();
    }
  }, [tr, refetch]);

  const handleConnect = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/integrations/qbo-connect');
      if (!res.ok) {
        const err = await res.text();
        setMessage({ type: 'error', text: err || 'Failed to start QuickBooks connection' });
        setConnecting(false);
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: 'No redirect URL received' });
        setConnecting(false);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Connection failed' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(tr('disconnect_quickbooks_confirm') || 'Disconnect QuickBooks? This will stop invoice sync.')) return;
    setDisconnecting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/integrations/qbo-disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Disconnect failed');
      setMessage({ type: 'success', text: 'QuickBooks disconnected' });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Disconnect failed' });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{tr('loading') || 'Loading...'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connected ? (
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          ) : (
            <Plug className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {tr('quickbooks_integration') || 'QuickBooks Integration'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {connected
                ? (tr('connected_to_company') || 'Connected to {companyName}').replace('{companyName}', companyName || 'QuickBooks')
                : (tr('sync_your_invoices_to_quickbooks_online_automatically') || 'Sync your invoices to QuickBooks Online automatically.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <Unlink className="w-3 h-3" />
              {disconnecting ? (tr('loading') || '...') : (tr('disconnect_quickbooks') || 'Disconnect')}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlugZap className="w-4 h-4" />
              )}
              {connecting ? (tr('connecting') || 'Connecting...') : (tr('connect_quickbooks') || 'Connect QuickBooks')}
            </button>
          )}
        </div>
      </div>

      {connected && (
        <QuickBooksSyncPanel lastSyncedAt={lastSyncedAt} onSyncComplete={refetch} />
      )}

      {message && (
        <div
          className={`text-xs px-3 py-2 rounded-md ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

function QuickBooksSyncPanel({ lastSyncedAt, onSyncComplete }) {
  const { tr } = useLocalizedText();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [autoSync, setAutoSync] = useState(() => {
    try { return localStorage.getItem('qbo_auto_sync') !== 'false'; } catch { return true; }
  });

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/integrations/qbo-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'manual', payload: {} }),
      });
      const data = await res.json();
      if (res.ok && data.synced) {
        setResult({ type: 'success', text: (tr('quickbooks_sync_success') || 'Invoices synced successfully') });
        if (onSyncComplete) onSyncComplete();
      } else {
        setResult({ type: 'error', text: (tr('quickbooks_sync_error') || 'Sync failed: {error}').replace('{error}', data.error || 'Unknown error') });
      }
    } catch (err) {
      setResult({ type: 'error', text: (tr('quickbooks_sync_error') || 'Sync failed: {error}').replace('{error}', err.message || 'Connection error') });
    } finally {
      setSyncing(false);
    }
  };

  const toggleAutoSync = () => {
    const next = !autoSync;
    setAutoSync(next);
    try { localStorage.setItem('qbo_auto_sync', String(next)); } catch {}
  };

  const formatTime = (iso) => {
    if (!iso) return (tr('never') || 'Never');
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="ml-7 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800 space-y-3 py-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">{tr('last_synced') || 'Last synced'}:</span>{' '}
          {lastSyncedAt ? formatTime(lastSyncedAt) : (tr('never') || 'Never')}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={toggleAutoSync}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            {tr('auto_sync_invoices') || 'Auto-sync'}
          </label>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? (tr('syncing') || 'Syncing...') : (tr('sync_now') || 'Sync Now')}
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`text-xs px-2 py-1 rounded ${
            result.type === 'success'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {result.text}
        </div>
      )}
    </div>
  );
}