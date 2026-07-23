import { useState, useCallback, useMemo } from 'react';
import { updateInvoiceStatus } from '../lib/data';
import { CheckCircle, AlertCircle, Copy, Receipt, Filter, X, ChevronRight, ClipboardCheck } from 'lucide-react';
import { INVOICE_STATUS } from '../lib/constants';

const iconMap = { CheckCircle, AlertCircle };

/** Generate invoice text for clipboard */
function invoiceText(invoice) {
  const name = invoice.clients?.name || 'Client';
  const amount = invoice.amount || 0;
  const date = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'today';
  const phone = localStorage.getItem('mf_business_phone') || '';
  const bizName = localStorage.getItem('mf_business_name') || '';

  const payInfo = phone
    ? `Pay via Venmo @${bizName || 'YourBiz'} or Zelle: ${phone}`
    : 'Please send payment at your earliest convenience.';

  return `Hi ${name} — your lawn was serviced on ${date}. $${amount} due. ${payInfo} Thanks!`;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
];

export default function Invoices({ invoices, setInvoices }) {
  const [copiedIds, setCopiedIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [showFilter, setShowFilter] = useState(false);

  const copyToClipboard = useCallback(async (invoice) => {
    try {
      await navigator.clipboard.writeText(invoiceText(invoice));
      setCopiedIds(prev => new Set([...prev, invoice.id]));
      setTimeout(() => setCopiedIds(prev => { const n = new Set(prev); n.delete(invoice.id); return n; }), 2500);
    } catch { /* clipboard denied */ }
  }, []);

  const markAsPaid = useCallback(async (id) => {
    try {
      await updateInvoiceStatus(id, 'paid');
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i));
    } catch (err) { console.error('markAsPaid:', err); }
  }, [setInvoices]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return invoices;
    return invoices.filter(i => i.status === statusFilter);
  }, [invoices, statusFilter]);

  const unpaid = invoices.filter(i => i.status !== 'paid');
  const totalUnpaid = unpaid.reduce((s, i) => s + (i.amount || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invoices</h2>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-sm text-gray-500 dark:text-gray-400">{invoices.length} total</p>
          <span className="text-gray-300 dark:text-gray-600">&middot;</span>
          {unpaid.length > 0 && <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">${totalUnpaid} outstanding</p>}
          {totalPaid > 0 && <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">${totalPaid} collected</p>}
        </div>
      </div>

      {unpaid.length > 0 && (
        <div className="card p-4 mb-4 bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/20 dark:to-gray-900 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
            <div><p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">${totalUnpaid} in unpaid invoices</p><p className="text-xs text-amber-600 dark:text-amber-400">{unpaid.length} invoice{unpaid.length !== 1 ? 's' : ''} need{unpaid.length === 1 ? 's' : ''} attention</p></div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="relative" style={{ overflow: 'visible' }}>
          <button onClick={() => setShowFilter(!showFilter)} className="btn-secondary h-full px-3 gap-1" aria-label="Filter invoices by status"><Filter className="w-4 h-4" /></button>
          {showFilter && (
            <div className="absolute left-0 top-full mt-1 card p-1 z-20 min-w-[110px] shadow-lg"
                 onMouseLeave={() => setShowFilter(false)}
                 onKeyDown={e => { if (e.key === 'Escape') { setShowFilter(false); } }}
                 onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowFilter(false); }}>
              {STATUS_FILTERS.map(f => (
                <button key={f.value} onClick={() => { setStatusFilter(f.value); setShowFilter(false); }} className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${statusFilter === f.value ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{f.label}</button>
              ))}
            </div>
          )}
        </div>
        {statusFilter !== 'all' && (
          <button onClick={() => setStatusFilter('all')} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
            {STATUS_FILTERS.find(f => f.value === statusFilter)?.label} <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-10 text-center"><Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" /><p className="text-gray-500 dark:text-gray-400 font-semibold">No invoices</p><p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{statusFilter !== 'all' ? 'No matching invoices' : 'Invoices are created when you complete a job'}</p></div>
        )}
        {filtered.map(invoice => {
          const statusInfo = INVOICE_STATUS[invoice.status] || INVOICE_STATUS.unpaid;
          const Icon = iconMap[statusInfo.icon] || AlertCircle;
          const dateStr = invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown date';
          const isPaid = invoice.status === 'paid';
          const isExpanded = expandedId === invoice.id;
          return (
            <div key={invoice.id}>
              <div className="card p-4 flex items-center justify-between hover:border-emerald-200 dark:hover:border-emerald-800 transition-all cursor-pointer"
                   role="button" tabIndex={0}
                   onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : invoice.id); } }}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${statusInfo.bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${statusInfo.text}`} /></div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{invoice.clients?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{dateStr} &middot; <span className="font-semibold text-gray-700 dark:text-gray-300">${invoice.amount}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={statusInfo.badge}>{statusInfo.label}</span>
                  {!isPaid && (
                    <button
                      onClick={e => { e.stopPropagation(); copyToClipboard(invoice); }}
                      className="relative text-xs font-semibold inline-flex items-center gap-1 transition-all duration-200 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 group"
                    >
                      {copiedIds.has(invoice.id) ? (
                        <><ClipboardCheck className="w-3 h-3" />Copied!
                          <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity pointer-events-none">
                            Paste into a text to the client
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45" />
                          </span>
                        </>) : (
                        <><Copy className="w-3 h-3" />Copy
                          <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity pointer-events-none">
                            Copy a payment request to send via text
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45" />
                          </span>
                        </>)}
                    </button>
                  )}
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-4 pt-3 space-y-3" style={{ animation: 'slideDown 0.15s ease-out' }}>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-xs text-gray-400 dark:text-gray-500 block">Client</span><span className="font-medium text-gray-900 dark:text-white">{invoice.clients?.name || 'Unknown'}</span></div>
                    <div><span className="text-xs text-gray-400 dark:text-gray-500 block">Amount</span><span className="font-bold text-gray-900 dark:text-white">${invoice.amount}</span></div>
                    <div><span className="text-xs text-gray-400 dark:text-gray-500 block">Created</span><span className="text-gray-700 dark:text-gray-300">{dateStr}</span></div>
                    <div><span className="text-xs text-gray-400 dark:text-gray-500 block">Status</span><span className={statusInfo.badge}>{statusInfo.label}</span></div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {!isPaid && (
                      <button onClick={e => { e.stopPropagation(); markAsPaid(invoice.id); }} className="btn-primary flex-1 text-xs gap-1 bg-emerald-500 hover:bg-emerald-600">
                        <CheckCircle className="w-3.5 h-3.5" />Mark as Paid
                      </button>
                    )}
                    {!isPaid && (
                      <button onClick={e => { e.stopPropagation(); copyToClipboard(invoice); }} className="relative btn-secondary flex-1 text-xs gap-1 group">
                        <Copy className="w-3.5 h-3.5" />{copiedIds.has(invoice.id) ? 'Copied!' : 'Copy to Text'}
                        <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity pointer-events-none z-30">
                          Copies a payment request — paste in a text
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45" />
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
