import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect } from 'react';
import { Link, Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';
import { Calendar, Users, FileText, Settings, LogOut, WifiOff, LayoutDashboard } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';
import { isCurrentlyOffline } from '../lib/offlineStorage';

const navItems = [
  { to: '/app', icon: LayoutDashboard, title: 'Dashboard', exact: true },
  { to: '/app/today', icon: Calendar, title: 'Today' },
  { to: '/app/clients', icon: Users, title: 'Clients' },
  { to: '/app/invoices', icon: FileText, title: 'Invoices' },
  { to: '/app/settings', icon: Settings, title: 'Settings' },
];

export default function Layout() {
  const { tr, t, i18n } = useLocalizedText('layout');
  const navigate = useNavigate();
  const [isOffline, setIsOffline] = useState(isCurrentlyOffline());

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


  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch { /* session may already be gone */ }
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-bg)] dark:bg-gray-950 pb-20 transition-colors duration-200">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-[var(--color-surface)] focus:dark:bg-gray-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold">
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
      <header className="bg-[var(--color-surface)] dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-20 backdrop-blur-sm bg-[var(--color-surface)]/95 dark:bg-gray-900/95" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Logo size="md" />
            <h1 className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white tracking-tight">{tr("MowGo")}</h1>
          </Link>
          <div className="flex items-center gap-1">
            <div className="flex rounded-lg border border-[var(--color-border)] dark:border-gray-700 p-0.5" role="group" aria-label={tr("Language")}>
              {['en', 'es'].map(language => (
                <button
                  key={language}
                  type="button"
                  onClick={() => i18n.changeLanguage(language)}
                  aria-pressed={i18n.resolvedLanguage === language}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                    i18n.resolvedLanguage === language
                      ? 'bg-brand text-white'
                      : 'text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] hover:bg-[var(--color-surface-secondary)] dark:hover:bg-gray-800'
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

      {/* Bottom navigation */}
      <nav aria-label={tr("Main navigation")} className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-2xl mx-auto flex justify-around items-stretch">
          {navItems.map(({ to, icon: Icon, title, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact || to === '/app'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-2 min-w-[56px] transition-colors duration-150 relative ${
                  isActive
                    ? 'text-brand-hover dark:text-emerald-400'
                    : 'text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium leading-tight">{tr(title)}</span>
                  {isActive && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-brand dark:bg-emerald-400" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  );
}
