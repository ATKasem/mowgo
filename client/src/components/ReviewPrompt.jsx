import useLocalizedText from '../i18n/useLocalizedText';
import { useState } from 'react';
import { X, Star } from 'lucide-react';

const REVIEW_LINK = 'https://www.capterra.com/p/268981/MowGo/reviews/';

export default function ReviewPrompt({ show, onClose }) {
  const { tr } = useLocalizedText('reviewPrompt');

  if (!show) return null;

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

        <div className="text-center space-y-3">
          {/* Star icon */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Star className="w-7 h-7 text-amber-500" fill="currentColor" />
          </div>

          {/* Heading */}
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white">
            {tr('Loving MowGo?')}
          </h3>

          {/* Body */}
          <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">
            {tr('Help us out with a review ⭐')}
          </p>

          {/* Review button */}
          <a
            href={REVIEW_LINK}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/20"
          >
            {tr('Leave a Review')} →
          </a>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="block w-full text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:text-white transition-colors mt-1"
          >
            {tr('Maybe Later')}
          </button>
        </div>
      </div>
    </div>
  );
}
