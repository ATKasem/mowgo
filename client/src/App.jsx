import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Today from './pages/Today';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import { demoInvoices, demoJobs } from './lib/demoData';
import Subscribe from './pages/Subscribe';

export default function App() {
  const [invoices, setInvoices] = useState(demoInvoices);
  const [jobs, setJobs] = useState(demoJobs);

  return (
    <HashRouter>
      <Routes>
        {/* Marketing / landing */}
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/subscribe" element={<Subscribe />} />

        {/* App */}
        <Route element={<Layout />}>
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
