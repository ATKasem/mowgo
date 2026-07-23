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

// ===== App =====
export default function App() {
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Load data on mount + when demo data changes
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      setDataLoading(true);
      const [j, inv] = await Promise.all([loadJobs(), loadInvoices()]);
      if (mounted) { setJobs(j); setInvoices(inv); setDataLoading(false); }
    }
    fetch();

    // Listen for demo-mode data changes
    const unsub = onDataChange(() => fetch());
    return () => { mounted = false; unsub(); };
  }, []);

  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/subscribe" element={<Subscribe />} />
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
            <Route path="*" element={<Navigate to="/app" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
