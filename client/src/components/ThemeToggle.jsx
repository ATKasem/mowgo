import useLocalizedText from '../i18n/useLocalizedText';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

const THEME_KEY = 'mowgo-theme';

export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', isDark);
}

export default function ThemeToggle() {
  const { tr, t, i18n } = useLocalizedText('themeToggle');
  const [theme, setTheme] = useState(() => getStoredTheme());

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  }, [theme]);

  // Listen for system changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  function cycle() {
    setTheme(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark');
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const label = tr(theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Auto');

  const accessibleLabel = tr('Theme: {{label}}', { label });

  return (
    <button onClick={cycle} className="btn-ghost text-xs gap-1.5" aria-label={accessibleLabel} title={accessibleLabel}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
