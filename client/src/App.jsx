import { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Login from './pages/Login';
import Home from './pages/Home';
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
import AutopilotChat from './components/AutopilotChat';

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

// ===== Supabase Error Redirect =====
// When Supabase redirects back with error params (expired/invalid reset link),
// the hash may not include a route path (e.g. #error=access_denied&...).
// This component detects that and rewrites to /#/login so Login.jsx can show
// a friendly error message instead of a blank page.
function SupabaseErrorRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('error=')) return;
    // Already on /login — let Login.jsx handle it
    if (hash.startsWith('#/login')) return;
    // Rewrite hash to include /login route so the Login component renders
    const errorHash = hash.startsWith('#') ? hash.slice(1) : hash;
    window.history.replaceState({}, '', window.location.pathname + '#/login&' + errorHash);
    navigate('/login', { replace: true });
  }, [navigate]);
  return null;
}

// ===== App =====
export default function App() {
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Load data on mount + when demo data changes
  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setDataLoading(true);
      const [j, inv] = await Promise.all([loadJobs(), loadInvoices()]);
      if (mounted) { setJobs(j); setInvoices(inv); setDataLoading(false); }
    }
    fetchData();

    // Listen for demo-mode data changes
    const unsub = onDataChange(() => fetchData());
    return () => { mounted = false; unsub(); };
  }, []);

  return (
    <HashRouter>
      <AuthProvider>
        <SupabaseErrorRedirect />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/blog/jobber-price-increase-2026" element={<JobberPriceIncrease />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/switch-from-lawnpro" element={<SwitchingFromLawnPro />} />
          <Route path="/login" element={<Login />} />

          {/* Protected */}
          <Route element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }>
            <Route path="/app" element={<Home jobs={jobs} invoices={invoices} />} />
            <Route path="/app/today" element={<Today jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} loading={dataLoading} />} />
            <Route path="/app/clients" element={<Clients jobs={jobs} />} />
            <Route path="/app/invoices" element={<Invoices invoices={invoices} setInvoices={setInvoices} />} />
            <Route path="/app/settings" element={<Settings />} />
            <Route path="/app/autopilot" element={<AutopilotChat />} />
            <Route path="*" element={<Navigate to="/app" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
