import { AlertCircle, Check, CloudRain } from 'lucide-react';

export default function InvoiceToast({ toast }) {
  if (!toast) return null;

  const isRain = toast.type === 'rain';
  const isError = toast.type === 'error';
  const Icon = isError ? AlertCircle : isRain ? CloudRain : Check;
  const bg = isError
    ? 'card bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
    : isRain
    ? 'card bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
    : 'card bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800';
  const textColor = isError ? 'text-red-800 dark:text-red-200' : isRain ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200';
  const iconColor = isError ? 'text-red-600 dark:text-red-400' : isRain ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300';
  const subColor = isError ? 'text-red-600 dark:text-red-400' : isRain ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300';

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 z-30 flex justify-center pointer-events-none" style={{ animation: 'slideDown 0.3s ease-out', top: 'calc(4rem + env(safe-area-inset-top, 0px) + 8px)' }}>
      <div className={`${bg} px-4 py-3 mx-4 flex items-center gap-2 pointer-events-auto shadow-lg max-w-sm`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <div>
          <p className={`text-sm font-semibold ${textColor}`}>
            {isRain ? toast.name : toast.type === 'recurring' ? toast.name : `Invoice created for ${toast.name}`}
          </p>
          {!isRain && <p className={`text-xs ${subColor}`}>${toast.amount} — unpaid</p>}
        </div>
      </div>
    </div>
  );
}
