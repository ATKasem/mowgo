import { useState } from 'react';
import { FileText, CheckCircle, AlertCircle, Send, Receipt } from 'lucide-react';

const statusConfig = {
  paid: { icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', badge: 'badge-success', label: 'Paid' },
  unpaid: { icon: AlertCircle, bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', badge: 'badge-warning', label: 'Unpaid' },
  overdue: { icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', badge: 'badge-danger', label: 'Overdue' },
};

export default function Invoices({ invoices, setInvoices }) {
  const [sentReminders, setSentReminders] = useState(new Set());

  function sendReminder(id) {
    setSentReminders(new Set([...sentReminders, id]));
    setTimeout(() => setSentReminders(prev => { const n = new Set(prev); n.delete(id); return n; }), 2500);
  }

  const unpaid = invoices.filter(i => i.status !== 'paid');
  const totalUnpaid = unpaid.reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

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

      <div className="space-y-2">
        {invoices.length === 0 && (
          <div className="card p-10 text-center"><Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" /><p className="text-gray-500 dark:text-gray-400 font-semibold">No invoices yet</p><p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Invoices are created when you complete a job</p></div>
        )}
        {invoices.map(invoice => {
          const statusInfo = statusConfig[invoice.status] || statusConfig.unpaid;
          const Icon = statusInfo.icon;
          return (
            <div key={invoice.id} className="card p-4 flex items-center justify-between hover:border-sky-200 dark:hover:border-sky-800 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${statusInfo.bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${statusInfo.text}`} /></div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{invoice.clients?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &middot; <span className="font-semibold text-gray-700 dark:text-gray-300">${invoice.amount}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={statusInfo.badge}>{statusInfo.label}</span>
                {invoice.status === 'unpaid' && (
                  <button onClick={() => { if (!sentReminders.has(invoice.id)) sendReminder(invoice.id); }} aria-disabled={sentReminders.has(invoice.id)} className={`text-xs font-semibold inline-flex items-center gap-1 transition-all duration-200 ${sentReminders.has(invoice.id) ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400 hover:text-sky-700'}`}>
                    {sentReminders.has(invoice.id) ? <><CheckCircle className="w-3 h-3" />Sent!</> : <><Send className="w-3 h-3" />Remind</>}
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
