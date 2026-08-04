import { useEffect } from 'react';

// Sets a per-page document title + meta description (SPA has a single static title).
// Re-runs when the localized strings change (language switch).
export default function usePageTitle(title, description) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
  }, [title, description]);
}
