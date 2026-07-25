import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowRight, AlertCircle } from 'lucide-react';

export default function Subscribe() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState(sessionId ? 'verifying' : 'cancelled');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    async function verify() {
      try {
        const res = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();

        if (data.status === 'complete' && data.payment_status === 'paid') {
          setStatus('success');
          // Clear session ID from URL to prevent leaks
          window.history.replaceState({}, '', window.location.pathname);
        } else if (data.status === 'complete' && data.payment_status === 'unpaid') {
          // Trial — subscription created but no payment yet
          setStatus('success');
        } else {
          setStatus('failed');
          setError(data.error || 'Payment was not completed');
        }
      } catch (err) {
        // Network error — don't lie to the user
        setStatus('failed');
        setError('Could not verify payment. Please contact support or try again.');
      }
    }

    verify();
  }, [sessionId]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Confirming your subscription</h1>
          <p className="text-gray-500 dark:text-gray-400">Just a moment...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">You're all set!</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Welcome to MowFlow. Your subscription is active — start managing your lawn care business.</p>
          <Link to="/login" className="btn-primary text-base px-8 py-3 gap-2">
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">{error || 'We couldn\'t verify your payment. Please try again.'}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="btn-primary text-sm px-6 py-2.5">Try Again</Link>
            <Link to="/login" className="btn-secondary text-sm px-6 py-2.5">Try Free</Link>
          </div>
        </div>
      </div>
    );
  }

  // Cancelled
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">No worries</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">You can always try the free plan or subscribe when you're ready.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/login" className="btn-primary text-sm px-6 py-2.5">Try Free</Link>
          <Link to="/" className="btn-secondary text-sm px-6 py-2.5">Back Home</Link>
        </div>
      </div>
    </div>
  );
}
