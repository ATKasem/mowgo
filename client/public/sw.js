/* MowGo service worker — minimal, safe.
   - Static assets: cache-first (fast, offline-capable)
   - Navigations: network-first, fall back to cached app shell when offline
   - API calls (/api/, supabase): NEVER cached
*/
// Bump this when the app shell/assets change so installed PWAs discard stale
// bundles instead of rendering a blank page after a deployment.
const CACHE = 'mowgo-v2';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: default (supabase, payment pages, fonts)
  if (url.pathname.startsWith('/api/')) return; // API: never cache

  // Navigations: network-first with cache fallback (offline app shell)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only the app shell ('/' or '/index.html') updates the offline fallback.
          // Other pages (demo, marketing) must never poison the shell cache.
          if (response.ok && (url.pathname === '/' || url.pathname === '/index.html')) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
