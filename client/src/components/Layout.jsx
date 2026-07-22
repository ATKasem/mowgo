import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Calendar, MapPin, Users, FileText, Settings,
  Sparkles, LogOut
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import InstallPrompt from './InstallPrompt';

const navItems = [
  { to: '/', icon: Calendar, title: 'Schedule' },
  { to: '/route', icon: MapPin, title: 'Route' },
  { to: '/clients', icon: Users, title: 'Clients' },
  { to: '/invoices', icon: FileText, title: 'Invoices' },
  { to: '/settings', icon: Settings, title: 'Settings' },
];

export default function Layout() {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-20 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">CleanFlow</h1>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button onClick={logout} className="btn-ghost text-xs gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        <Outlet />
      </main>

      {/* Install prompt */}
      <InstallPrompt />

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-20 safe-bottom">
        <div className="max-w-2xl mx-auto flex justify-around">
          {navItems.map(({ to, icon: Icon, title }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors duration-150 ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{title}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
