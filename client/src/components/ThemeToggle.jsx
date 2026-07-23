import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Sparkles } from 'lucide-react';

const THEME_KEY = 'mowflow-theme';

export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'system';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', isDark && theme !== 'glass');
  root.classList.toggle('glass', theme === 'glass');
}

export default function ThemeToggle() {
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
    setTheme(prev =>
      prev === 'light' ? 'dark' :
      prev === 'dark' ? 'system' :
      prev === 'system' ? 'glass' :
      'light'
    );
  }

  const config = {
    light:  { Icon: Sun, label: 'Light' },
    dark:   { Icon: Moon, label: 'Dark' },
    system: { Icon: Monitor, label: 'Auto' },
    glass:  { Icon: Sparkles, label: 'Glass' },
  };
  const { Icon, label } = config[theme] || config.system;

  return (
    <button onClick={cycle} className="btn-ghost text-xs gap-1.5" aria-label={`Theme: ${label}`} title={`Theme: ${label}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
