import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Today from './pages/Today';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import { demoInvoices } from './lib/demoData';

export default function App() {
  const [invoices, setInvoices] = useState(demoInvoices);

  return (
    <HashRouter>
      <Routes>
        {/* Marketing / landing */}
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<Privacy />} />

        {/* App */}
        <Route element={<Layout />}>
          <Route path="/app" element={<Today invoices={invoices} setInvoices={setInvoices} />} />
          <Route path="/app/clients" element={<Clients />} />
          <Route path="/app/invoices" element={<Invoices invoices={invoices} setInvoices={setInvoices} />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
