import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Login from './pages/Login';
import Today from './pages/Today';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import { demoInvoices, demoJobs } from './lib/demoData';
import { supabase, isDemoMode } from './lib/supabase';
import Subscribe from './pages/Subscribe';

/** Auth guard — redirects to /login if no session (unless in demo mode) */
function RequireAuth({ children }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isDemoMode()) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/login', { replace: true });
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login', { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return children;
}

export default function App() {
  const [invoices, setInvoices] = useState(demoInvoices);
  const [jobs, setJobs] = useState(demoJobs);

  return (
    <HashRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/login" element={<Login />} />

        {/* Protected app */}
        <Route element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }>
          <Route path="/app" element={<Today jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} />} />
          <Route path="/app/clients" element={<Clients jobs={jobs} />} />
          <Route path="/app/invoices" element={<Invoices invoices={invoices} setInvoices={setInvoices} />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
