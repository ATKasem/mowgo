import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Listen for install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setShowPrompt(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }

  if (!showPrompt || installed) return null;

  return (
    <div className="fixed bottom-20 inset-x-0 z-30 px-4 pointer-events-none">
      <div className="card max-w-md mx-auto p-4 flex items-center gap-3 pointer-events-auto animate-[slideUp_0.3s_ease-out] shadow-lg border-sky-200 dark:border-sky-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white">Install CleanFlow</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Add to your home screen for quick access</p>
        </div>
        <button onClick={install} className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">
          Install
        </button>
        <button onClick={() => setShowPrompt(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
