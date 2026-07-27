import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isDemoMode } from '../lib/supabase';
import { Sprout, Mail, Lock, ArrowRight, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const demo = isDemoMode();

  // Handle password recovery callback or error params from Supabase redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    // Strip leading '#' and parse params
    // Hash may be "#/login&error=..." (after SupabaseErrorRedirect) or "#error=..."
    const hashStr = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(hashStr);

    const errorType = params.get('error');
    const errorCode = params.get('error_code');
    const errorDesc = params.get('error_description');
    // Handle error params from Supabase redirect (expired/invalid reset link)
    if (errorType) {
      const friendlyMessages = {
        'otp_expired': 'This password reset link has expired. Please request a new one.',
        'access_denied': 'This password reset link is invalid or has expired. Please request a new one.',
      };
      const message = friendlyMessages[errorCode] || decodeURIComponent(errorDesc || errorType);
      setError(message);
      window.history.replaceState({}, '', '/#/login');
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

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
            setError('Something went wrong. Please try again.');
          } else if (msg.includes('rate limit') || msg.includes('rate_limit') || msg.toLowerCase().includes('too many')) {
            setError('Too many attempts. Please wait a moment and try again.');
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
        setError(typeof result.error.message === 'string' ? result.error.message : (result.error.msg || result.error.error_code || 'Something went wrong. Please try again.'));
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        if (result.data?.user?.identities?.length === 0) {
          setError('An account with this email already exists.');
          setLoading(false);
          return;
        }
        if (result.data?.session === null) {
          setConfirmSent(true);
          setLoading(false);
          return;
        }
      }

      navigate('/app');
    } catch (err) {
      setError('Connection failed. Check your internet and try again.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">MowGo</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Simple scheduling for lawn care crews</p>
        </div>

        {confirmSent ? (
          /* Confirmation sent (signup) */
          <div className="card p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Check your email</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
            </div>
            <button onClick={() => { setConfirmSent(false); setMode('login'); }} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
              Back to login
            </button>
          </div>
        ) : resetSent ? (
          /* Password reset email sent */
          <div className="card p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Reset link sent</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.</p>
            </div>
            <button onClick={() => { setResetSent(false); setMode('login'); }} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
              Back to login
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
                <h2 className="font-semibold text-gray-900 dark:text-white">Reset your password</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter your email and we'll send you a reset link</p>
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="you@example.com"
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
                <label className="label">Password</label>
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
                Forgot your password?
              </button>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full gap-2 text-sm py-2.5"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'forgot' ? 'Sending...' : mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
              ) : demo ? (
                <><ArrowRight className="w-4 h-4" />Continue with Demo</>
              ) : (
                <>{mode === 'forgot' ? 'Send Reset Link' : mode === 'login' ? 'Log In' : 'Create Account'}</>
              )}
            </button>

            {/* Toggle mode — hidden in forgot */}
            {mode !== 'forgot' ? (
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-2.5 min-h-[44px]"
              >
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
              </button>
            ) : mode === 'forgot' ? (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-2.5 min-h-[44px]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to login
              </button>
            ) : null}

            {/* Demo mode indicator */}
            {demo && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg py-2">
                Running in demo mode — no account needed
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
