export const THEME_KEY = 'mowgo-theme';

export function getStoredTheme() {
  const theme = localStorage.getItem(THEME_KEY);
  return ['dark', 'light', 'system'].includes(theme) ? theme : null;
}

export function defaultThemeForRoute(_pathname) {
  // Keep first paint coherent across route transitions. System remains an
  // explicit option, but an absent preference is dark everywhere.
  return 'dark';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
}

export function themeForRoute(pathname) {
  return getStoredTheme() || defaultThemeForRoute(pathname);
}

export function storeThemeSelection(theme) {
  if (!['dark', 'light', 'system'].includes(theme)) return;
  localStorage.setItem(THEME_KEY, theme);
}
