import useLocalizedText from '../i18n/useLocalizedText';
import { useState } from 'react';
import { X, Star, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

const REVIEW_LINK = 'https://www.capterra.com/p/268981/MowGo/reviews/';

export default function ReviewPrompt({ show, onClose }) {
  const { tr } = useLocalizedText('reviewPrompt');
  const [quote, setQuote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  if (!show) return null;

  async function submitQuote(e) {
    e.preventDefault();
    const trimmed = quote.trim();
    if (trimmed.length < 2) return;
    setSaving(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('no session');
      const profile = session.user.user_metadata?.full_name || '';
      const { error: insertError } = await supabase
        .from('testimonials')
        .insert({ user_id: session.user.id, quote: trimmed, name: profile, role: '', plan: '' });
      if (insertError) throw insertError;
      setSaved(true);
    } catch (err) {
      // Never surface raw Supabase/auth errors — keep technical details out of the UI
      setError(tr('Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal */}
      <div className="relative bg-[var(--color-surface)] dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:text-white transition-colors min-w-10 min-h-10 flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {saved ? (
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white">
              {tr('Thanks — that helps other crews.')}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">
              {tr('Want to leave a public review too?')}
            </p>
            <a
              href={REVIEW_LINK}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/20"
            >
              {tr('Review on Capterra')} →
            </a>
            <button
              onClick={onClose}
              className="block w-full text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:text-white transition-colors mt-1"
            >
              {tr('Maybe Later')}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            {/* Star icon */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Star className="w-7 h-7 text-amber-500" fill="currentColor" />
            </div>

            {/* Heading */}
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white">
              {tr('10 jobs done. How is it going?')}
            </h3>

            {/* Body */}
            <form onSubmit={submitQuote} className="space-y-3">
              <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">
                {tr('One line about what changed for your business — it might end up on our site.')}
              </p>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                maxLength={600}
                rows={3}
                required
                placeholder={tr('Example: “I stopped rebooking rain-outs by hand. Whole week moves in one tap.”')}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
              {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={saving || quote.trim().length < 2}
                className="inline-flex w-full items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/20 disabled:opacity-50"
              >
                {saving ? tr('Saving…') : tr('Share it')}
              </button>
            </form>

            {/* Dismiss */}
            <button
              onClick={onClose}
              className="block w-full text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:text-white transition-colors mt-1"
            >
              {tr('Maybe Later')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
