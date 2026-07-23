import { Check, CloudRain } from 'lucide-react';

export default function InvoiceToast({ toast }) {
  if (!toast) return null;

  const isRain = toast.type === 'rain';
  const Icon = isRain ? CloudRain : Check;
  const bg = isRain
    ? 'card bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
    : 'card bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
  const textColor = isRain ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300';
  const iconColor = isRain ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
  const subColor = isRain ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div role="status" aria-live="polite" className="fixed top-4 inset-x-0 z-30 flex justify-center pointer-events-none" style={{ animation: 'slideDown 0.3s ease-out' }}>
      <div className={`${bg} px-4 py-3 flex items-center gap-2 pointer-events-auto shadow-lg`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <div>
          <p className={`text-sm font-semibold ${textColor}`}>
            {isRain ? toast.name : `Invoice created for ${toast.name}`}
          </p>
          {!isRain && <p className={`text-xs ${subColor}`}>${toast.amount} — unpaid</p>}
        </div>
      </div>
    </div>
  );
}
