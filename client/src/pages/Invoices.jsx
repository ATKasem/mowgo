import { useState } from 'react';
import { demoInvoices } from '../lib/demoData';
import { FileText, CheckCircle, AlertCircle, Clock, Send, ArrowUpRight } from 'lucide-react';

const statusConfig = {
  paid: { icon: CheckCircle, bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'badge-success', label: 'Paid' },
  unpaid: { icon: AlertCircle, bg: 'bg-amber-50', text: 'text-amber-700', badge: 'badge-warning', label: 'Unpaid' },
  overdue: { icon: Clock, bg: 'bg-red-50', text: 'text-red-700', badge: 'badge-danger', label: 'Overdue' },
};

export default function Invoices() {
  const [invoices, setInvoices] = useState(demoInvoices);
  const [sentReminders, setSentReminders] = useState(new Set());

  function sendReminder(id) {
    setSentReminders(new Set([...sentReminders, id]));
    setTimeout(() => {
      setSentReminders(prev => { const next = new Set(prev); next.delete(id); return next; });
    }, 2000);
  }

  const totalUnpaid = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0);

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900">Invoices</h2>
        {totalUnpaid > 0 && (
          <p className="text-sm text-gray-500 mt-0.5">
            ${totalUnpaid} outstanding
          </p>
        )}
      </div>

      {/* Summary card */}
      {totalUnpaid > 0 && (
        <div className="card p-4 mb-4 bg-gradient-to-r from-amber-50 to-white border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800">${totalUnpaid} in unpaid invoices</p>
              <p className="text-sm text-amber-600">{invoices.filter(i => i.status !== 'paid').length} invoice{invoices.filter(i => i.status !== 'paid').length !== 1 ? 's' : ''} needing attention</p>
            </div>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div className="space-y-2">
        {invoices.length === 0 && (
          <div className="card p-8 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No invoices yet</p>
            <p className="text-gray-400 text-sm mt-1">Invoices appear when you complete a job</p>
          </div>
        )}
        {invoices.map(inv => {
          const config = statusConfig[inv.status] || statusConfig.unpaid;
          const StatusIcon = config.icon;
          return (
            <div key={inv.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                  <StatusIcon className={`w-5 h-5 ${config.text}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{inv.clients?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    &middot; ${inv.amount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={config.badge}>{config.label}</span>
                {inv.status === 'unpaid' && (
                  <button
                    onClick={() => sendReminder(inv.id)}
                    disabled={sentReminders.has(inv.id)}
                    className={`text-xs font-semibold inline-flex items-center gap-1 transition-all duration-200 ${
                      sentReminders.has(inv.id)
                        ? 'text-emerald-600'
                        : 'text-sky-600 hover:text-sky-700'
                    }`}
                  >
                    {sentReminders.has(inv.id) ? (
                      <><CheckCircle className="w-3 h-3" /> Sent</>
                    ) : (
                      <><Send className="w-3 h-3" /> Remind</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
