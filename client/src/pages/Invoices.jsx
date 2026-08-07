import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { updateInvoiceStatus, invoicePayMethods, createInvoice, loadClients, voidInvoice } from '../lib/data';
import { CheckCircle, AlertCircle, Copy, Receipt, Filter, X, ChevronRight, ClipboardCheck, Plus } from 'lucide-react';
import { INVOICE_STATUS } from '../lib/constants';
import EstimatesSection from '../components/EstimatesSection';

const iconMap = { CheckCircle, AlertCircle };

/** Localized payment line (methods are data; the wrapper is translated). */
function invoicePaymentInfo(tr) {
  const methods = invoicePayMethods();
  return methods.length
    ? tr('Pay via {{methods}}', { methods: methods.join(' · ') })
    : tr('Please send payment at your earliest convenience');
}

/** Generate invoice text for clipboard */
function invoiceText(invoice, tr, language) {
  const name = invoice.clients?.name || tr('Client');
  const amount = Number(invoice.amount || 0).toFixed(2);
  const date = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' })
    : tr('today');

  return tr('Hi {{name}} — your lawn was serviced on {{date}}. ${{amount}} due. {{paymentInfo}}. Thanks!', { name, date, amount, paymentInfo: invoicePaymentInfo(tr) });
}

/** Friendly reminder text for stale unpaid invoices. */
function invoiceNudgeText(invoice, tr, language) {
  const name = invoice.clients?.name || tr('Client');
  const amount = Number(invoice.amount || 0).toFixed(2);
  const date = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' })
    : '';
  const datePart = date ? `${language === 'es' ? ' del' : ' from'} ${date}` : '';
  return tr('Hi {{name}} — friendly reminder: ${{amount}}{{datePart}} is still due. {{paymentInfo}}. Thanks!', { name, amount, datePart, paymentInfo: invoicePaymentInfo(tr) });
}

/** Unpaid/overdue invoices older than 3 days get a Nudge (mirrors estimates). */
function isStaleInvoice(invoice) {
  return invoice.status !== 'paid'
    && invoice.status !== 'voided'
    && invoice.created_at
    && Date.now() - new Date(invoice.created_at).getTime() > 3 * 24 * 60 * 60 * 1000;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'voided', label: 'Voided' },
];

export default function Invoices({ invoices = [], setInvoices }) {
  const { tr, t, i18n } = useLocalizedText('invoices');
  const [copiedIds, setCopiedIds] = useState(new Set());
  const [voidError, setVoidError] = useState(null); // { id, message } — keyed to the invoice
  const [voidingId, setVoidingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [section, setSection] = useState('invoices');
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [clients, setClients] = useState([]);
  const [newClientId, setNewClientId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const filterRef = useRef(null);

  // Close filter dropdown on click outside (handles touch devices)
  useEffect(() => {
    if (!showFilter) return;
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showFilter]);

  // Load the client picker when the New Invoice dialog opens.
  useEffect(() => {
    if (!showNewInvoice) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await loadClients();
        if (!cancelled) setClients(list || []);
      } catch (err) { console.error('loadClients:', err); }
    })();
    return () => { cancelled = true; };
  }, [showNewInvoice]);

  const createManualInvoice = useCallback(async () => {
    const amount = Number(newAmount);
    if (!newClientId || !Number.isFinite(amount) || amount <= 0) {
      setCreateError(tr('Enter a client and a positive amount'));
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const { invoice: inv, created } = await createInvoice({ client_id: newClientId, amount });
      if (created) {
        setInvoices(prev => prev.some(i => i.id === inv.id) ? prev : [inv, ...prev]);
        setShowNewInvoice(false);
        setNewClientId('');
        setNewAmount('');
      } else {
        // Existing (shouldn't happen for a manual invoice) — surface it.
        setCreateError(tr('That invoice already exists'));
      }
    } catch (err) {
      console.error('createInvoice:', err);
      setCreateError(err?.message || tr("Couldn't create invoice"));
    } finally {
      setCreating(false);
    }
  }, [newClientId, newAmount, setInvoices, tr]);

  const copyToClipboard = useCallback(async (invoice) => {
    try {
      await navigator.clipboard.writeText(invoiceText(invoice, tr, i18n.resolvedLanguage));
      setCopiedIds(prev => new Set([...prev, invoice.id]));
      setTimeout(() => setCopiedIds(prev => { const n = new Set(prev); n.delete(invoice.id); return n; }), 2500);
    } catch { /* clipboard denied */ }
  }, [i18n.resolvedLanguage, tr]);

  const markAsPaid = useCallback(async (id) => {
    try {
      const updated = await updateInvoiceStatus(id, 'paid');
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
    } catch (err) { console.error('markAsPaid:', err); }
  }, [setInvoices]);

  const changeStatus = useCallback(async (id, newStatus) => {
    try {
      const updated = await updateInvoiceStatus(id, newStatus);
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
    } catch (err) { console.error('changeStatus:', err); }
  }, [setInvoices]);

  const handleVoid = useCallback(async (id) => {
    setVoidError(null);
    setVoidingId(id);
    try {
      const updated = await voidInvoice(id);
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
    } catch (err) {
      console.error('voidInvoice:', err);
      setVoidError({ id, message: err?.message || tr("Couldn't void invoice") });
    } finally {
      setVoidingId('');
    }
  }, [setInvoices, tr]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return invoices;
    // Unpaid includes overdue: both are money owed. Voided is not owed.
    if (statusFilter === 'unpaid') return invoices.filter(i => i.status !== 'paid' && i.status !== 'voided');
    return invoices.filter(i => i.status === statusFilter);
  }, [invoices, statusFilter]);

  const unpaid = invoices.filter(i => i.status !== 'paid' && i.status !== 'voided');
  const totalUnpaid = unpaid.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0).toFixed(2);

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl bg-[var(--color-surface-secondary)] dark:bg-gray-800">
        {['invoices', 'estimates'].map(value => <button key={value} onClick={() => setSection(value)} className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${section === value ? 'bg-white dark:bg-gray-700 text-brand-hover shadow-sm' : 'text-[var(--color-text-secondary)]'}`}>{tr(value === 'invoices' ? 'Invoices' : 'Estimates')}</button>)}
      </div>
      {section === 'estimates' ? <EstimatesSection /> : <>
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{tr("Invoices")}</h2>
          <button
            onClick={() => setShowNewInvoice(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-hover px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {tr('New Invoice')}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr('{{count}} total', { count: invoices.length })}</p>
          <span className="text-gray-300 dark:text-[var(--color-text-secondary)]">&middot;</span>
          {unpaid.length > 0 && <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{tr('${{amount}} outstanding', { amount: totalUnpaid })}</p>}
          {totalPaid > 0 && <p className="text-sm text-brand-hover dark:text-emerald-400 font-medium">{tr('${{amount}} collected', { amount: totalPaid })}</p>}
        </div>
      </div>

      {showNewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNewInvoice(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white">{tr('New Invoice')}</h3>
              <button onClick={() => setShowNewInvoice(false)} className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mb-1">{tr('Client')}</label>
            <select
              value={newClientId}
              onChange={e => {
                setNewClientId(e.target.value);
                const picked = clients.find(c => c.id === e.target.value);
                // Always reset: a rate-less client must not inherit the previous amount.
                setNewAmount(picked?.rate ? String(picked.rate) : '');
              }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">{tr('Select Client')}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.rate ? ` — $${Number(c.rate).toFixed(2)}` : ''}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-3 mb-1">{tr('Amount')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            {createError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{createError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowNewInvoice(false)}
                className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] dark:border-gray-600"
              >
                {tr('Cancel')}
              </button>
              <button
                onClick={createManualInvoice}
                disabled={creating}
                className="flex-1 rounded-lg bg-brand-hover px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {creating ? tr('Creating…') : tr('Create Invoice')}
              </button>
            </div>
          </div>
        </div>
      )}

      {unpaid.length > 0 && (
        <div className="card p-4 mb-4 bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/20 dark:to-gray-900 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
            <div><p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">{tr('${{amount}} in unpaid invoices', { amount: totalUnpaid })}</p><p className="text-xs text-amber-600 dark:text-amber-400">{tr('{{count}} invoice needs attention', { count: unpaid.length })}</p></div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="relative" ref={filterRef} style={{ overflow: 'visible' }}>
          <button onClick={() => setShowFilter(!showFilter)} className="btn-secondary h-full px-3 gap-1" aria-label={tr("Filter invoices by status")}><Filter className="w-4 h-4" /></button>
          {showFilter && (
            <div className="absolute left-0 top-full mt-1 card p-1 z-20 min-w-[110px] shadow-lg"
                 onMouseLeave={() => setShowFilter(false)}
                 onKeyDown={e => { if (e.key === 'Escape') { setShowFilter(false); } }}
                 onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowFilter(false); }}>
              {STATUS_FILTERS.map(f => (
                <button key={f.value} onClick={() => { setStatusFilter(f.value); setShowFilter(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] ${statusFilter === f.value ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] hover:bg-[var(--color-surface-bg)] dark:hover:bg-gray-800'}`}>{tr(f.label)}</button>
              ))}
            </div>
          )}
        </div>
        {statusFilter !== 'all' && (
          <button onClick={() => setStatusFilter('all')} className="inline-flex items-center gap-1 text-xs font-medium text-brand-hover dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
            {tr(STATUS_FILTERS.find(f => f.value === statusFilter)?.label)} <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-10 text-center"><Receipt className="w-12 h-12 text-gray-300 dark:text-[var(--color-text-secondary)] mx-auto mb-4" /><p className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] font-semibold">{tr("No invoices")}</p><p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] text-sm mt-1">{tr(statusFilter !== 'all' ? 'No matching invoices' : 'Invoices are created when you complete a job')}</p></div>
        )}
        {filtered.map(invoice => {
          const statusInfo = INVOICE_STATUS[invoice.status] || INVOICE_STATUS.unpaid;
          const Icon = iconMap[statusInfo.icon] || AlertCircle;
          const dateStr = invoice.created_at ? new Date(invoice.created_at).toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' }) : tr('Unknown date');
          const isPaid = invoice.status === 'paid';
          const isVoided = invoice.status === 'voided';
          const isExpanded = expandedId === invoice.id;
          const toggleExpanded = () => { if (!isExpanded) setVoidError(null); setExpandedId(isExpanded ? null : invoice.id); };
          return (
            <div key={invoice.id}>
              <div className="card hover:border-emerald-200 dark:hover:border-emerald-800 transition-all cursor-pointer"
                   role="button" tabIndex={0}
                   aria-expanded={isExpanded}
                   onClick={toggleExpanded}
                   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(); } }}>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${statusInfo.bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${statusInfo.text}`} /></div>
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm">{invoice.clients?.name || 'Unknown'}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-0.5">{dateStr} &middot; <span className="font-semibold text-[var(--color-text-primary)] dark:text-gray-300">${invoice.amount}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={statusInfo.badge}>{tr(statusInfo.label)}</span>
                    {!isPaid && !isVoided && (
                      <button
                        onClick={e => { e.stopPropagation(); copyToClipboard(invoice); }}
                        className="relative text-xs font-semibold inline-flex items-center gap-1 transition-all duration-200 text-brand-hover dark:text-emerald-400 hover:text-emerald-700 group"
                      >
                        {copiedIds.has(invoice.id) ? (
                          <><ClipboardCheck className="w-3 h-3" />{tr("Copied!")}
                            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-[var(--color-surface)] text-white dark:text-[var(--color-text-primary)] text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity pointer-events-none">
                              {tr("Paste into a text to the client")}
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-[var(--color-surface)] rotate-45" />
                            </span>
                          </>) : (
                          <><Copy className="w-3 h-3" />{tr("Copy")}
                            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-[var(--color-surface)] text-white dark:text-[var(--color-text-primary)] text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity pointer-events-none">
                              {tr("Copy a payment request to send via text")}
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-[var(--color-surface)] rotate-45" />
                            </span>
                          </>)}
                      </button>
                    )}
                    <ChevronRight className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 space-y-3" style={{ animation: 'slideDown 0.15s ease-out' }}>
                    <div className="grid grid-cols-2 gap-3 text-sm pt-3">
                      <div><span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] block">{tr("Client")}</span><span className="font-medium text-[var(--color-text-primary)] dark:text-white">{invoice.clients?.name || 'Unknown'}</span></div>
                      <div><span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] block">{tr("Amount")}</span><span className="font-bold text-[var(--color-text-primary)] dark:text-white">${invoice.amount}</span></div>
                      <div><span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] block">{tr("Created")}</span><span className="text-[var(--color-text-primary)] dark:text-gray-300">{dateStr}</span></div>
                      <div><span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] block">{tr("Status")}</span><span className={statusInfo.badge}>{tr(statusInfo.label)}</span></div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={e => { e.stopPropagation(); copyToClipboard(invoice); }} className="relative btn-secondary flex-1 text-xs gap-1 group min-h-[44px] py-2.5">
                        <Copy className="w-3.5 h-3.5" />{tr(copiedIds.has(invoice.id) ? 'Copied!' : 'Copy to Text')}
                        <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-[var(--color-surface)] text-white dark:text-[var(--color-text-primary)] text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity pointer-events-none z-30">
                          {tr("Copies a payment request — paste in a text")}
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-[var(--color-surface)] rotate-45" />
                        </span>
                      </button>
                      {isStaleInvoice(invoice) && (
                        <button
                          onClick={async e => {
                            e.stopPropagation();
                            try {
                              await navigator.clipboard.writeText(invoiceNudgeText(invoice, tr, i18n.resolvedLanguage));
                              setCopiedIds(prev => new Set([...prev, `nudge-${invoice.id}`]));
                              setTimeout(() => setCopiedIds(prev => { const n = new Set(prev); n.delete(`nudge-${invoice.id}`); return n; }), 2500);
                            } catch { /* clipboard denied */ }
                          }}
                          className="btn-secondary text-xs text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                        >
                          {copiedIds.has(`nudge-${invoice.id}`) ? tr('Copied!') : tr('Nudge')}
                        </button>
                      )}
                      {(invoice.status === 'unpaid' || invoice.status === 'overdue') && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (window.confirm(tr('Void this {{amount}} invoice? It will no longer be collectible. This cannot be undone.', { amount: `$${Number(invoice.amount || 0).toFixed(2)}` }))) {
                              handleVoid(invoice.id);
                            }
                          }}
                          disabled={voidingId !== ''}
                          className="btn-secondary text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 disabled:opacity-50"
                        >
                          {voidingId === invoice.id ? tr('Voiding…') : tr('Void')}
                        </button>
                      )}
                      {voidError && voidError.id === invoice.id && <p className="text-xs text-red-600 dark:text-red-400">{voidError.message}</p>}
                    </div>
                    {!isVoided && (
                      <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                        <p className="text-xs font-semibold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mb-2">{tr("Change status")}</p>
                      <div className="flex gap-1">
                        {['unpaid', 'paid', 'overdue'].map(s => {
                          const si = INVOICE_STATUS[s];
                          const active = invoice.status === s;
                          return (
                            <button
                              key={s}
                              onClick={e => { e.stopPropagation(); changeStatus(invoice.id, s); }}
                              disabled={active}
                              className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-all duration-150 min-h-[44px] ${
                                active
                                  ? `${si.bg} ${si.text} cursor-default`
                                  : 'bg-[var(--color-surface-secondary)] dark:bg-gray-800 text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] dark:hover:bg-gray-700'
                              }`}
                            >
                              {tr(si.label)}
                            </button>
                          );
                        })}
                      </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div></>}
    </div>
  );
}
