import { useState, useEffect, useRef, useCallback, createContext, useContext, Suspense, lazy } from 'react';
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
// Landing + Login stay statically imported — they're the initial-paint routes
// for cold traffic (site root and /login) and must render with no extra chunk fetch.
import Landing from './pages/Landing';
import Login from './pages/Login';
import { supabase, isDemoMode } from './lib/supabase';
import { loadJobs, loadInvoices, loadProfile, onDataChange, subscribeToNewLeads } from './lib/data';
import { resumeCheckoutIntent } from './lib/payments';
import { useTranslation } from 'react-i18next';
import useLocalizedText from './i18n/useLocalizedText';
import i18n from './i18n';
import InvoiceToast from './components/InvoiceToast';
import { applyTheme, themeForRoute } from './lib/theme';

// Everything else is route-level code-split — none of it is needed for the
// initial paint, so it shouldn't cost cold traffic a 1MB+ download.
const Privacy = lazy(() => import('./pages/Privacy'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Today = lazy(() => import('./pages/Today'));
const Clients = lazy(() => import('./pages/Clients'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Settings = lazy(() => import('./pages/Settings'));
const Subscribe = lazy(() => import('./pages/Subscribe'));
const Compare = lazy(() => import('./pages/Compare'));
const SwitchingFromLawnPro = lazy(() => import('./pages/SwitchingFromLawnPro'));
const JobberPriceIncrease = lazy(() => import('./pages/JobberPriceIncrease'));
const LawnCareSoftwareCost = lazy(() => import('./pages/LawnCareSoftwareCost'));
const QuoteIQAlternative = lazy(() => import('./pages/QuoteIQAlternative'));
const RuunlyComparison = lazy(() => import('./pages/RuunlyComparison'));
const ProBaseComparison = lazy(() => import('./pages/ProBaseComparison'));
const JobberIsTooExpensive = lazy(() => import('./pages/JobberIsTooExpensive'));
const NoPerUserFees = lazy(() => import('./pages/NoPerUserFees'));
const BestForSmallCrews = lazy(() => import('./pages/BestForSmallCrews'));
const Booking = lazy(() => import('./pages/Booking'));
const PortalReturn = lazy(() => import('./pages/PortalReturn'));
const PaymentComplete = lazy(() => import('./pages/PaymentComplete'));
const AdminConcierge = lazy(() => import('./pages/AdminConcierge'));
const RouteAudit = lazy(() => import('./pages/RouteAudit'));
const Rates = lazy(() => import('./pages/Rates'));
const SmsOptIn = lazy(() => import('./pages/SmsOptIn'));
const Terms = lazy(() => import('./pages/Terms'));
const ImportFromYardbook = lazy(() => import('./pages/ImportFromYardbook'));

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

// ===== Route chunk loading fallback (for React.lazy pages) =====
function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Marketing pages are dark-first for visitors with no saved preference.
// A saved light/dark/system choice always wins, including on public routes.
function ClientsRoute(props) {
  const { user, loading } = useAuth();
  const [isOwner, setIsOwner] = useState(null);
  useEffect(() => {
    let active = true;
    if (loading) return undefined;
    if (!user && !isDemoMode()) { setIsOwner(false); return undefined; }
    loadProfile()
      .then(profile => { if (active) setIsOwner(Boolean(profile && profile.role !== 'crew')); })
      .catch(() => { if (active) setIsOwner(false); });
    return () => { active = false; };
  }, [loading, user?.id]);
  if (loading || isOwner === null) return <PageLoading />;
  return <Clients {...props} isOwner={isOwner} />;
}

function RouteTheme() {
  const { pathname } = useLocation();
  useEffect(() => {
    applyTheme(themeForRoute(pathname));
  }, [pathname]);
  return null;
}

// Meta Pixel — fire pageView on every route change (SPA HashRouter)
function MetaPixelPageView() {
  const { pathname } = useLocation();
  useEffect(() => {
    try { if (typeof fbq === 'function') fbq('track', 'PageView'); } catch {}
  }, [pathname]);
  return null;
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
// Resumes a paid-plan checkout (Start Free Trial) when a signed-in user lands on
// any route with a stored intent — covers the email-confirmation return, which
// opens a new tab and lands on the Landing route (localStorage carries the intent).
function ResumeCheckoutIntent() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Expire any past trial on mount (cheap, idempotent, best-effort).
      try { if (!cancelled) await supabase.rpc('expire_trial'); } catch { /* non-fatal */ }
      const intent = localStorage.getItem('mowgo_plan_intent');
      if (!intent) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.access_token) return;
      const resume = await resumeCheckoutIntent();
      if (!cancelled && resume.status === 'error') {
        // Surface the failure on the login page (retryable errors keep the intent)
        navigate(`/login?mode=login&error_code=checkout_failed&error=${encodeURIComponent(resume.message || '')}`);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);
  return null;
}

// Applies a stashed referral code after the email-confirmation round trip.
// INDEPENDENT, UNGATED sibling of ResumeCheckoutIntent — a referral-only
// signup never sets mowgo_plan_intent, so wiring this inside that effect
// would silently never fire (round-3 CRIT-2). Fires on any route mount once
// a session exists; applyStashedRefCode is idempotent and clears the stash.
function ApplyStashedRefCode() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.access_token) return;
      const { applyStashedRefCode } = await import('./lib/referrals');
      if (!cancelled) await applyStashedRefCode();
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}

// Subscribes the signed-in owner to new-lead Realtime events (instant lead
// alerts, web in-app channel) and forwards each new lead up to App() for the
// toast + Leads-tab badge. Lives inside AuthProvider so it can read the
// authenticated user id; subscribeToNewLeads() itself no-ops in demo mode.
function LeadAlertListener({ onNewLead }) {
  const { user } = useAuth();
  useEffect(() => {
    if (!isDemoMode() && !user?.id) return undefined;
    return subscribeToNewLeads(user?.id, onNewLead);
  }, [user?.id, onNewLead]);
  return null;
}

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
  const { tr } = useLocalizedText('app');
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [leadToast, setLeadToast] = useState(null);
  const [unreadLeadCount, setUnreadLeadCount] = useState(0);
  const leadToastTimer = useRef(null);

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

  useEffect(() => () => { if (leadToastTimer.current) clearTimeout(leadToastTimer.current); }, []);

  // New-lead alert: toast (any page) + increments the Leads-tab badge.
  const handleNewLead = useCallback((lead) => {
    setUnreadLeadCount(count => count + 1);
    setLeadToast({ name: `${tr('New lead request')}: ${lead.name} · ${tr('Booking link')}`, amount: 0, type: 'lead' });
    if (leadToastTimer.current) clearTimeout(leadToastTimer.current);
    leadToastTimer.current = setTimeout(() => setLeadToast(null), 5000);
  }, [tr]);

  const clearUnreadLeads = useCallback(() => setUnreadLeadCount(0), []);

  return (
    <ErrorBoundary>
    <HashRouter>
      <RouteTheme />
      <MetaPixelPageView />
      <AuthProvider>
        <SupabaseErrorRedirect />
        <ResumeCheckoutIntent />
        <ApplyStashedRefCode />
        <LeadAlertListener onNewLead={handleNewLead} />
        <InvoiceToast toast={leadToast} position="bottom" />
        <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/route-audit" element={<RouteAudit />} />
          <Route path="/rates" element={<Rates />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/blog/jobber-price-increase-2026" element={<JobberPriceIncrease />} />
          <Route path="/blog/lawn-care-software-cost-2026" element={<LawnCareSoftwareCost />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/sms-optin" element={<SmsOptIn />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/switch-from-lawnpro" element={<SwitchingFromLawnPro />} />
          <Route path="/quoteiq-alternative" element={<QuoteIQAlternative />} />
          <Route path="/jobber-too-expensive" element={<JobberIsTooExpensive />} />
          <Route path="/no-per-user-fees" element={<NoPerUserFees />} />
          <Route path="/best-for-small-crews" element={<BestForSmallCrews />} />
          <Route path="/compare/ruunly" element={<RuunlyComparison />} />
          <Route path="/compare/probase" element={<ProBaseComparison />} />
          <Route path="/book/:businessId" element={<Booking />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/portal-return" element={<PortalReturn />} />
          <Route path="/payment-complete" element={<PaymentComplete />} />
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
            <Route path="/app/clients" element={<ClientsRoute jobs={jobs} unreadLeadCount={unreadLeadCount} onLeadsViewed={clearUnreadLeads} />} />
            <Route path="/app/invoices" element={<Invoices invoices={invoices} setInvoices={setInvoices} />} />
            <Route path="/app/settings" element={<Settings />} />
            <Route path="/import/yardbook" element={<ImportFromYardbook />} />
            <Route path="*" element={<Navigate to="/app" />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </HashRouter>
    </ErrorBoundary>
  );
}
