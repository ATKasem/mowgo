import useLocalizedText from '../i18n/useLocalizedText';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { applyTheme, getStoredTheme, storeThemeSelection } from '../lib/theme';

export default function ThemeToggle() {
  const { tr, t, i18n } = useLocalizedText('themeToggle');
  // Authenticated app behavior remains dark-first when no preference exists.
  const [theme, setTheme] = useState(() => getStoredTheme() || 'dark');

  useEffect(() => {
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
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    storeThemeSelection(next);
    setTheme(next);
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
