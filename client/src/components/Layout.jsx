import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Calendar, Users, FileText, Settings,
  Sprout, LogOut, WifiOff, LayoutDashboard, MessageSquare, X
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import InstallPrompt from './InstallPrompt';
import AutopilotChat from './AutopilotChat';
import { isCurrentlyOffline } from '../lib/offlineStorage';

const navItems = [
  { to: '/app', icon: LayoutDashboard, title: 'Home', exact: true },
  { to: '/app/today', icon: Calendar, title: 'Today' },
  { to: '/app/clients', icon: Users, title: 'Clients' },
  { to: '/app/invoices', icon: FileText, title: 'Invoices' },
  { to: '/app/settings', icon: Settings, title: 'Settings' },
];

export default function Layout() {
  const { tr, t, i18n } = useLocalizedText('layout');
  const navigate = useNavigate();
  const [isOffline, setIsOffline] = useState(isCurrentlyOffline());
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Chat drawer focus trap (WCAG 2.4.3)
  useEffect(() => {
    if (!chatOpen) return;
    const drawer = document.querySelector('[role="dialog"]');
    if (!drawer) return;
    const focusable = drawer.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    focusable?.[0]?.focus();

    function handleTab(e) {
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    drawer.addEventListener('keydown', handleTab);
    return () => drawer.removeEventListener('keydown', handleTab);
  }, [chatOpen]);

  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch { /* session may already be gone */ }
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 transition-colors duration-200">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:dark:bg-gray-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold">
        {tr("Skip to main content")}
      </a>
      {/* Offline banner */}
      {isOffline && (
        <div className="bg-amber-500 text-white text-center text-xs font-semibold py-1.5 flex items-center justify-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5" />
          {tr("You're offline — changes will sync when reconnected")}
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-20 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{tr("MowGo")}</h1>
          </Link>
          <div className="flex items-center gap-1">
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5" role="group" aria-label={tr("Language")}>
              {['en', 'es'].map(language => (
                <button
                  key={language}
                  type="button"
                  onClick={() => i18n.changeLanguage(language)}
                  aria-pressed={i18n.resolvedLanguage === language}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                    i18n.resolvedLanguage === language
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {language.toUpperCase()}
                </button>
              ))}
            </div>
            <ThemeToggle />
            <button onClick={logout} className="btn-ghost text-xs gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              {tr("Log out")}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="max-w-2xl mx-auto px-4 pt-5 pb-6">
        <Outlet />
      </main>

      {/* Install prompt */}
      <InstallPrompt />

      {/* Bottom navigation */}
      <nav aria-label={tr("Main navigation")} className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-2xl mx-auto flex justify-around items-stretch">
          {navItems.map(({ to, icon: Icon, title, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact || to === '/app'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-2 min-w-[56px] transition-colors duration-150 relative ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium leading-tight">{tr(title)}</span>
                  {isActive && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Floating chat button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
          aria-label={tr("Open assistant")}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      )}

      {/* Chat drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setChatOpen(false)}
          />
          {/* Panel — centered compact sheet */}
          <div role="dialog" aria-modal="true" aria-label={tr("AI assistant")} className="absolute bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-h-[70vh] flex flex-col overflow-hidden"
               style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Handle bar + close + reset */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{tr("Ask anything")}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label={tr("Close")}
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            {/* Chat content */}
            <div className="flex-1 overflow-hidden px-4 pt-2 pb-4">
              <AutopilotChat compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
