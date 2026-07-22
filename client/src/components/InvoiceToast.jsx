import { Check } from 'lucide-react';

export default function InvoiceToast({ toast }) {
  if (!toast) return null;

  return (
    <div role="status" aria-live="polite" className="fixed top-4 inset-x-0 z-30 flex justify-center pointer-events-none" style={{ animation: 'slideDown 0.3s ease-out' }}>
      <div className="card bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center gap-2 pointer-events-auto shadow-lg">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Invoice created for {toast.name}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">${toast.amount} — unpaid</p>
        </div>
      </div>
    </div>
  );
}
