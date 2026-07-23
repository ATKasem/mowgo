import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply theme before React hydration to prevent flash
const theme = localStorage.getItem('mowflow-theme') || (() => {
  // Default to glass on Capacitor iOS for native app feel
  if (typeof window !== 'undefined' && window.Capacitor?.getPlatform() === 'ios') return 'glass';
  return 'system';
})();

const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark', isDark && theme !== 'glass');
document.documentElement.classList.toggle('glass', theme === 'glass');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
