import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Schedule from './pages/Schedule';
import RoutePage from './pages/Route';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Marketing / landing */}
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<Privacy />} />

        {/* App */}
        <Route element={<Layout />}>
          <Route path="/app" element={<Schedule />} />
          <Route path="/app/route" element={<RoutePage />} />
          <Route path="/app/clients" element={<Clients />} />
          <Route path="/app/invoices" element={<Invoices />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
