import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { applyTheme, themeForRoute } from './lib/theme.js'

// Global error handlers for uncaught errors and unhandled promise rejections
// (ErrorBoundary only catches render errors — these catch async/event-handler errors)
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Apply theme before React hydration to prevent flash
const initialRoute = window.location.hash.replace(/^#/, '').split('?')[0] || '/';
applyTheme(themeForRoute(initialRoute));

// Register the service worker (PWA install + offline app shell).
// Only in production: dev server hot-reload clashes with SW caching.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
