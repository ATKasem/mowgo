import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isDemoMode } from '../lib/supabase';
import { Sprout, Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const demo = isDemoMode();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (demo) {
      // Demo mode: skip auth, just go to app
      setLoading(false);
      setTimeout(() => navigate('/app'), 400);
      return;
    }

    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        // Supabase may require email confirmation
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
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">MowFlow</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Simple scheduling for lawn care crews</p>
        </div>

        {/* Confirmation sent */}
        {confirmSent ? (
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
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Email */}
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

            {/* Password */}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full gap-2 text-sm py-2.5"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
              ) : demo ? (
                <><ArrowRight className="w-4 h-4" />Continue with Demo</>
              ) : (
                <>{mode === 'login' ? 'Log In' : 'Create Account'}</>
              )}
            </button>

            {/* Toggle mode */}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>

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
