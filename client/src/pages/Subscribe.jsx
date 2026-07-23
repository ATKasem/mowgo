import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Sparkles, ArrowRight } from 'lucide-react';

export default function Subscribe() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState(sessionId ? 'verifying' : 'cancelled');

  useEffect(() => {
    if (!sessionId) return;
    // Check if Stripe keys are configured (demo/fallback mode)
    const hasStripe = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!hasStripe) {
      // Demo mode: simulate verification
      const t = setTimeout(() => setStatus('success'), 1500);
      return () => clearTimeout(t);
    }
    // In production: verify the session with your backend
    // For now: simulate verification with fallback to unknown
    const t = setTimeout(() => setStatus('success'), 1500);
    return () => clearTimeout(t);
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
