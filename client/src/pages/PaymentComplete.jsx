import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';

// Where a business's customer lands after paying (or backing out of) an
// invoice on the payment provider's hosted page. Public — the payer usually
// has no MowGo account. The invoice is marked paid by the provider's
// webhook, not by visiting this page.
export default function PaymentComplete() {
  const { tr } = useLocalizedText('paymentComplete');
  const [searchParams] = useSearchParams();
  const canceled = searchParams.get('canceled') === '1';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${canceled ? 'bg-gray-500/10' : 'bg-emerald-500/10'}`}>
          {canceled
            ? <XCircle className="w-8 h-8 text-gray-400" />
            : <CheckCircle2 className="w-8 h-8 text-emerald-500" />}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {canceled ? tr('Payment not completed') : tr('Thank you!')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {canceled
            ? tr('No charge was made. You can use the same payment link again whenever you’re ready.')
            : tr('Your payment was received. You can close this page.')}
        </p>
      </div>
    </div>
  );
}
