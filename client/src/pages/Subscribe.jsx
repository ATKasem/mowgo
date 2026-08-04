import useLocalizedText from '../i18n/useLocalizedText';
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowRight, AlertCircle, Sprout, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import ConciergeSetup from '../components/ConciergeSetup';

function SubscribeNav({ tr }) {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-bold text-lg no-underline min-h-[44px] inline-flex items-center">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center"><Sprout className="w-4 h-4 text-white" /></div>
          MowGo
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/compare" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] inline-flex items-center">{tr("Compare")}</Link>
          <Link to="/login" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] inline-flex items-center">{tr("Log In")}</Link>
        </div>
      </div>
    </nav>
  );
}

export default function Subscribe() {
  const { tr, t, i18n } = useLocalizedText('subscribe');
  const { tr: conciergeTr } = useLocalizedText('concierge');
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState(sessionId ? 'verifying' : 'cancelled');
  const [error, setError] = useState('');
  const [conciergeClaimed, setConciergeClaimed] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (status !== 'success' || !user) return;
    let active = true;
    supabase.from('concierge_requests').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data, error: claimError }) => {
        if (!active) return;
        if (claimError) console.error('Concierge claim check:', claimError);
        setConciergeClaimed(Boolean(data));
      });
    return () => { active = false; };
  }, [status, user]);

  useEffect(() => {
    if (!sessionId) return;

    async function verify() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`, { headers });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();

        if (data.status === 'complete' && data.payment_status === 'paid') {
          setStatus('success');
          // Clear session ID from URL to prevent leaks
          window.history.replaceState({}, '', '#/subscribe');
        } else if (data.status === 'complete' && data.payment_status === 'unpaid') {
          // Trial — subscription created but no payment yet
          setStatus('success');
        } else {
          setStatus('failed');
          setError(data.error || tr('Payment was not completed'));
        }
      } catch (err) {
        // Network error — don't lie to the user
        setStatus('failed');
        setError(tr('Could not verify payment. Please contact support or try again.'));
      }
    }

    verify();
  }, [sessionId, retry]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
        <SubscribeNav tr={tr} />
        <div className="text-center flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{tr("Confirming your subscription")}</h1>
          <p className="text-gray-500 dark:text-gray-400">{tr("Just a moment...")}</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
        <SubscribeNav tr={tr} />
        <div className="text-center max-w-2xl w-full mx-auto px-4 py-10 space-y-6 flex-1">
          <div className="card p-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{tr("You're all set!")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">{tr("Welcome to MowGo. Your subscription is active — start managing your lawn care business.")}</p>
          <Link to="/login" className="btn-primary text-base px-8 py-3 gap-2">
            {tr("Log In")} <ArrowRight className="w-4 h-4" />
          </Link>
          </div>
          {user && conciergeClaimed === false && <ConciergeSetup onDone={() => setConciergeClaimed(true)} />}
          {user && conciergeClaimed === true && <p className="text-sm text-gray-600 dark:text-gray-300">{conciergeTr("Your setup request is in — we'll be in touch within 48 hours.")}</p>}
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
        <SubscribeNav tr={tr} />
        <div className="text-center max-w-md mx-auto px-4 flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{tr("Something went wrong")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">{error || tr("We couldn't verify your payment. Please try again.")}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setStatus('verifying'); setError(''); setRetry(r => r + 1); }}
              className="btn-primary text-sm px-6 py-2.5"
            >
              {tr("Try Again")} <RefreshCw className="w-4 h-4" />
            </button>
            <Link to="/" className="btn-secondary text-sm px-6 py-2.5">{tr("Back Home")}</Link>
          </div>
        </div>
      </div>
    );
  }

  // Cancelled
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
      <SubscribeNav tr={tr} />
      <div className="text-center max-w-md mx-auto px-4 flex-1 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{tr("No worries")}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">{tr("You can always try the free plan or subscribe when you're ready.")}</p>
        <div className="flex gap-3 justify-center">
          <Link to="/login?mode=signup" className="btn-primary text-sm px-6 py-2.5">{tr("Try Free")}</Link>
          <Link to="/" className="btn-secondary text-sm px-6 py-2.5">{tr("Back Home")}</Link>
        </div>
      </div>
    </div>
  );
}
