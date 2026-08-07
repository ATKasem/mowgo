import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useLocalizedText from '../i18n/useLocalizedText';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function PortalReturn() {
  const { tr } = useLocalizedText('portalReturn');
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    // Attempt deep link
    window.location.href = 'mowgo://settings?portal_returned=true';

    // If still here after 2s, app probably didn't open — show fallback
    const timer = setTimeout(() => setFallback(true), 2000);

    const onVisibility = () => {
      // Page becomes hidden → app likely opened, cancel fallback
      if (document.hidden) clearTimeout(timer);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {tr('Return to MowGo')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {tr('Tap below to go back to the app')}
          </p>
        </div>

        {/* Primary button */}
        <button
          onClick={() => {
            window.location.href = 'mowgo://settings?portal_returned=true';
            setTimeout(() => setFallback(true), 2000);
          }}
          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-lg py-4 px-6 rounded-xl shadow-sm transition-colors cursor-pointer"
        >
          {tr('Open MowGo')}
          <ArrowUpRight className="w-5 h-5" />
        </button>

        {/* Fallback link */}
        {fallback && (
          <div className="mt-6 animate-in fade-in duration-300">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">
              {tr("App not installed?")}
            </p>
            <Link
              to="/login"
              className="text-emerald-500 hover:text-emerald-400 text-sm font-medium underline underline-offset-2"
            >
              {tr('Continue in your browser')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
