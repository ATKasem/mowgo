import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isDemoMode } from '../lib/supabase';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const { tr, t, i18n } = useLocalizedText('login');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState(() => (searchParams.get('mode') === 'signup' ? 'signup' : 'login')); // login | signup | forgot
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Paid-plan checkout intent carried in the URL ("Start Free Trial" → /login?mode=signup&plan=solo&interval=month)
  const planParam = searchParams.get('plan');
  const intervalParam = searchParams.get('interval');
  const hasPaidPlanIntent = (planParam === 'solo' || planParam === 'crew')
    && (intervalParam === 'month' || intervalParam === 'year');

  // Referral code from URL or pre-stash (survives email-confirm round trip)
  const refParam = searchParams.get('ref');
  const [refCode, setRefCode] = useState('');

  useEffect(() => {
    if (refParam) setRefCode(refParam.toUpperCase().trim());
    else {
      const stash = localStorage.getItem('mowgo_ref_code');
      if (stash) {
        const ts = Number(localStorage.getItem('mowgo_ref_ts') || 0);
        if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) setRefCode(stash);
        else localStorage.removeItem('mowgo_ref_code');
      }
    }
  }, [refParam]);

  const demo = isDemoMode();

  // Seed/refresh the checkout intent from the URL (localStorage survives the
  // email-confirmation new tab). The URL is the freshest signal — a fresh click
  // wins over any stored intent and always refreshes the 30-min TTL.
  useEffect(() => {
    const plan = searchParams.get('plan');
    const interval = searchParams.get('interval');
    if ((plan === 'solo' || plan === 'crew') && (interval === 'month' || interval === 'year')) {
      localStorage.setItem('mowgo_plan_intent', plan);
      localStorage.setItem('mowgo_interval_intent', interval);
      localStorage.setItem('mowgo_intent_time', String(Date.now()));
    }
  }, [searchParams]);

  // Handle password recovery callback or error params from Supabase redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    // Parse route query params separately from HashRouter's route fragment.
    // Hash may be "#/login?error=..." or a raw Supabase "#error=..." callback.
    const queryIndex = hash.indexOf('?');
    const hashStr = queryIndex >= 0
      ? hash.slice(queryIndex + 1)
      : (hash.startsWith('#') ? hash.slice(1) : hash);
    const params = new URLSearchParams(hashStr);

    const errorType = params.get('error');
    const errorCode = params.get('error_code');
    const errorDesc = params.get('error_description');
    // Handle error params from Supabase redirect (expired/invalid reset link)
    if (errorType) {
      const friendlyMessages = {
        'otp_expired': tr('This password reset link has expired. Please request a new one.'),
        'access_denied': tr('This password reset link is invalid or has expired. Please request a new one.'),
        'checkout_failed': tr("Couldn't start checkout. Please try again."),
      };
      const message = friendlyMessages[errorCode] || decodeURIComponent(errorDesc || errorType);
      setError(message);
      window.history.replaceState({}, '', '/#/login');
    }
  }, [tr]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Stash referral code BEFORE signUp() so it survives the email-confirmation
    // round trip (new tab has no ?ref param; applyStashedRefCode reads the stash).
    if (mode === 'signup' && refCode) {
      localStorage.setItem('mowgo_ref_code', refCode);
      localStorage.setItem('mowgo_ref_ts', String(Date.now()));
    }

    if (demo) {
      setLoading(false);
      setTimeout(() => navigate('/app'), 400);
      return;
    }

    try {
      // Forgot mode — send reset email
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/#/reset-password',
        });
        if (resetError) {
          // Show the actual error — don't mask it
          const msg = resetError.message || resetError.msg || resetError.error_description || resetError.code || '';
          if (!msg || msg === '{}') {
            setError(tr('Something went wrong. Please try again.'));
          } else if (msg.includes('rate limit') || msg.includes('rate_limit') || msg.toLowerCase().includes('too many')) {
            setError(tr('Too many attempts. Please wait a moment and try again.'));
          } else {
            setError(msg);
          }
          setLoading(false);
          return;
        }
        setResetSent(true);
        setLoading(false);
        return;
      }

      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (result.error) {
        setError(typeof result.error.message === 'string' ? result.error.message : (result.error.msg || result.error.error_code || tr('Something went wrong. Please try again.')));
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        if (result.data?.user?.identities?.length === 0) {
          setError(tr('An account with this email already exists.'));
          setLoading(false);
          return;
        }
        if (result.data?.session === null) {
          setConfirmSent(true);
          setLoading(false);
          return;
        }
        // Speed-to-lead (spec: signup instant touch). Fire-and-forget —
        // idempotent server-side (lead_touches UNIQUE(lead_email, kind)).
        // The Dashboard-mount catch-all covers the email-confirm path.
        if (result.data?.session?.access_token) {
          fetch('/api/lead-touch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${result.data.session.access_token}` },
            body: JSON.stringify({ email }),
          }).catch(() => {});
        }
      }

      const { resumeCheckoutIntent } = await import('../lib/payments');
      const resume = await resumeCheckoutIntent();
      if (resume.status !== 'none') {
        if (resume.status === 'error') setError(resume.message || tr('Payment failed'));
        setLoading(false);
        return;
      }

      // Call site 2: apply a stashed referral code (login after email confirm,
      // or signup that returned a session directly). Silent on failure.
      const { applyStashedRefCode } = await import('../lib/referrals');
      await applyStashedRefCode();

      navigate('/app');
    } catch (err) {
      setError(tr('Connection failed. Check your internet and try again.'));
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/">
            <Logo size="lg" className="mx-auto mb-3" />
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{tr("MowGo")}</h1>
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr("Simple scheduling for lawn care crews")}</p>
          {mode === 'signup' && (hasPaidPlanIntent ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4 text-center">{tr('Start your 14-day {{plan}} trial — unlimited clients, no credit card.', { plan: planParam === 'crew' ? 'Crew' : 'Solo' })}</p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4 text-center">{tr("Create your free account — 5 clients, no credit card.")}</p>
          ))}
        </div>

        {confirmSent ? (
          /* Confirmation sent (signup) */
          <div className="card p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">{tr("Check your email")}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr("We sent a confirmation link to {{email}}. Click it to activate your account.", { email })}</p>
              {hasPaidPlanIntent && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{tr("After you confirm, we'll walk you through checkout to start your trial — no charge until it ends.")}</p>
              )}
            </div>
            <button onClick={() => { setConfirmSent(false); setMode('login'); }} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
              {tr("Back to login")}
            </button>
          </div>
        ) : resetSent ? (
          /* Password reset email sent */
          <div className="card p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">{tr("Reset link sent")}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr("If an account exists for {{email}}, you'll receive a password reset link shortly.", { email })}</p>
            </div>
            <button onClick={() => { setResetSent(false); setMode('login'); }} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
              {tr("Back to login")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Forgot password header */}
            {mode === 'forgot' && (
              <div className="text-center -mt-1 mb-1">
                <h2 className="font-semibold text-gray-900 dark:text-white">{tr("Reset your password")}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tr("Enter your email and we'll send you a reset link")}</p>
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="label">{tr("Email")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  placeholder={tr("you@example.com")}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password — shown except in forgot mode */}
            {mode !== 'forgot' && (
              <div>
                <label className="label">{tr("Password")}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pl-10"
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>
              </div>
            )}

            {/* Forgot password link — login mode only */}
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(''); }}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors -mt-2"
              >
                {tr("Forgot your password?")}
              </button>
            )}

            {/* Referral code — optional, signup mode only. ?ref=CODE prefills. */}
            {mode === 'signup' && (
              <div>
                <label className="label">{tr("Referral code (optional)")}</label>
                <input
                  type="text"
                  placeholder={tr("e.g. 7KM2QP")}
                  value={refCode}
                  onChange={e => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  className="input"
                  autoComplete="off"
                  maxLength={6}
                />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full gap-2 text-sm py-2.5"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{tr(mode === 'forgot' ? 'Sending...' : mode === 'login' ? 'Signing in...' : 'Creating account...')}</>
              ) : demo ? (
                <><ArrowRight className="w-4 h-4" />{tr("Continue with Demo")}</>
              ) : (
                <>{tr(mode === 'forgot' ? 'Send Reset Link' : mode === 'login' ? 'Log In' : 'Create Account')}</>
              )}
            </button>

            {/* Toggle mode — hidden in forgot */}
            {mode !== 'forgot' ? (
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-2.5 min-h-[44px]"
              >
                {tr(mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in')}
              </button>
            ) : mode === 'forgot' ? (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-2.5 min-h-[44px]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {tr("Back to login")}
              </button>
            ) : null}

            {/* Demo mode indicator */}
            {demo && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg py-2">
                {tr("Running in demo mode — no account needed")}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
