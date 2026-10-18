import { useEffect, useState } from 'react';
import { CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';
import { getMerchantStatus, getPaymentsConfig, startMerchantOnboarding } from '../lib/payments';

// Owner-only card: lets a business set up its own merchant account so
// customers can pay invoices by card (money settles to the business).
// Status comes from merchant_accounts and is updated by the provider webhook.
export default function CardPaymentsSetup() {
  const { tr } = useLocalizedText('settings');
  const [state, setState] = useState({ loading: true, enabled: false, status: 'none' });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const config = await getPaymentsConfig();
      let status = 'none';
      if (config.invoicePayments) {
        try {
          status = await getMerchantStatus();
        } catch {
          if (active) setError(tr('Could not load card payment status.'));
        }
      }
      if (active) setState({ loading: false, enabled: config.invoicePayments, status });
    })();
    return () => { active = false; };
  }, [tr]);

  async function handleStart() {
    setStarting(true);
    setError('');
    const result = await startMerchantOnboarding();
    if (result?.error) setError(result.error);
    setStarting(false);
  }

  const { loading, enabled, status } = state;
  let description;
  let action = null;
  if (loading) {
    description = <Loader2 className="w-4 h-4 animate-spin" />;
  } else if (!enabled) {
    description = tr('Card payments are coming soon. Zelle, Venmo and Cash App requests work today.');
  } else if (status === 'active') {
    description = <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><CheckCircle className="w-4 h-4" />{tr('Card payments are active. Customers can pay invoices by card.')}</span>;
  } else if (status === 'pending') {
    description = tr('Your application is being reviewed. You can finish any remaining steps.');
    action = tr('Continue setup');
  } else if (status === 'restricted') {
    description = tr('More information is needed before you can accept cards.');
    action = tr('Finish setup');
  } else if (status === 'disabled') {
    description = tr('Card payments are turned off for your account. Contact support.');
  } else {
    description = tr('Let customers pay invoices by card. Payments go straight to your business.');
    action = tr('Set up card payments');
  }

  return (
    <div className="card p-5 space-y-3">
      <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-emerald-500" />{tr('Card Payments')}
      </h4>
      <div className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{description}</div>
      {action && (
        <button type="button" onClick={handleStart} disabled={starting} className="btn-secondary w-full">
          {starting ? <><Loader2 className="w-4 h-4 animate-spin" />{tr('Opening...')}</> : action}
        </button>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{tr(error)}</p>}
    </div>
  );
}
