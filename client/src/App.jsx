import { useState, useEffect, createContext, useContext } from 'react';
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Today from './pages/Today';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import { supabase, isDemoMode } from './lib/supabase';
import { loadJobs, loadInvoices, onDataChange } from './lib/data';
import Subscribe from './pages/Subscribe';
import Compare from './pages/Compare';
import SwitchingFromLawnPro from './pages/SwitchingFromLawnPro';
import JobberPriceIncrease from './pages/JobberPriceIncrease';
import QuoteIQAlternative from './pages/QuoteIQAlternative';
import RuunlyComparison from './pages/RuunlyComparison';
import ProBaseComparison from './pages/ProBaseComparison';
import Booking from './pages/Booking';
import PortalReturn from './pages/PortalReturn';
import AdminConcierge from './pages/AdminConcierge';
import RouteAudit from './pages/RouteAudit';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';

// ===== Auth Context =====
export const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ===== Auth Guard =====
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !isDemoMode()) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return children;
}

// ===== Error Boundary =====
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {i18n.t('app.something_went_wrong')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{this.state.error.message}</p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              {i18n.t('app.reload_app')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ===== Supabase Error Redirect =====
// When Supabase redirects back with error params (expired/invalid reset link),
// the hash may not include a route path (e.g. #error=access_denied&...).
// This component detects that and rewrites to /#/login so Login.jsx can show
// a friendly error message instead of a blank page.
function SupabaseErrorRedirect() {
  const navigate = useNavigate();
  const VALID_HASH_PARAMS = new Set(['error', 'error_code', 'error_description', 'type', 'access_token', 'expires_at', 'expires_in', 'refresh_token', 'token_type', 'sb']);
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    // Already on /login or /reset-password — let the page component handle it
    if (hash.startsWith('#/login') || hash.startsWith('#/reset-password')) return;

    const hashStr = hash.startsWith('#') ? hash.slice(1) : hash;

    // Validate hash params against allowlist before processing
    const params = new URLSearchParams(hashStr);
    const paramKeys = [...params.keys()];
    const hasValidParams = paramKeys.length > 0 && paramKeys.every(k => VALID_HASH_PARAMS.has(k));

    // Handle error hashes (expired/invalid reset link)
    if (hasValidParams && params.has('error')) {
      window.history.replaceState({}, '', window.location.pathname + '#/login?' + params.toString());
      navigate('/login?' + params.toString(), { replace: true });
      return;
    }

    // Handle recovery hashes (access_token + type=recovery) — route to reset password page
    if (hasValidParams && params.get('type') === 'recovery' && params.has('access_token')) {
      window.history.replaceState({}, '', window.location.pathname + '#/reset-password?' + params.toString());
      navigate('/reset-password?' + params.toString(), { replace: true });
      return;
    }
  }, [navigate]);
  return null;
}

// ===== App =====
export default function App() {
  useTranslation();
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Load data on mount + when demo data changes
  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setDataLoading(true);
      try {
        const [j, inv] = await Promise.all([loadJobs(), loadInvoices()]);
        if (mounted) { setJobs(j); setInvoices(inv); }
      } catch (err) {
        console.error('fetchData:', err);
      } finally {
        if (mounted) setDataLoading(false);
      }
    }
    fetchData();

    // Listen for demo-mode data changes
    const unsub = onDataChange(() => fetchData());
    return () => { mounted = false; unsub(); };
  }, []);

  return (
    <ErrorBoundary>
    <HashRouter>
      <AuthProvider>
        <SupabaseErrorRedirect />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/route-audit" element={<RouteAudit />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/blog/jobber-price-increase-2026" element={<JobberPriceIncrease />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/switch-from-lawnpro" element={<SwitchingFromLawnPro />} />
          <Route path="/quoteiq-alternative" element={<QuoteIQAlternative />} />
          <Route path="/compare/ruunly" element={<RuunlyComparison />} />
          <Route path="/compare/probase" element={<ProBaseComparison />} />
          <Route path="/book/:businessId" element={<Booking />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/portal-return" element={<PortalReturn />} />
          <Route path="/admin/concierge" element={<AdminConcierge />} />

          {/* Protected */}
          <Route element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/home" element={<Home jobs={jobs} invoices={invoices} />} />
            <Route path="/app/today" element={<Today jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} loading={dataLoading} />} />
            <Route path="/app/clients" element={<Clients jobs={jobs} />} />
            <Route path="/app/invoices" element={<Invoices invoices={invoices} setInvoices={setInvoices} />} />
            <Route path="/app/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/app" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
    </ErrorBoundary>
  );
}
