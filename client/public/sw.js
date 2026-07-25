// Bumped to v4: v3 and earlier cached API responses containing customer data.
// The activate handler deletes every cache that is not CACHE_NAME, so this
// rename purges those entries from devices already in the field.
const CACHE_NAME = 'mowflow-v4';
const DB_NAME = 'mowflow-offline';
const DB_VERSION = 1;

// ===== IndexedDB =====
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('store', 'readonly');
    const req = tx.objectStore('store').get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => resolve(null);
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('store', 'readwrite');
    tx.objectStore('store').put({ key, value, updated: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// ===== Install =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html', '/manifest.json', '/favicon.svg', '/icons.svg']).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ===== Activate =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ===== Fetch =====

/**
 * Only the app shell and its static assets are cacheable.
 *
 * Responses from /api/* and from Supabase carry customer records — addresses,
 * phone numbers, gate and alarm codes. Cache Storage is unencrypted, unbounded,
 * and outlives the session, so anything account-scoped is fetched fresh and
 * never written to disk.
 */
function isCacheable(request, url) {
  if (request.method !== 'GET') return false;
  // Same-origin only — never persist third-party or backend responses.
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  // Requests carrying credentials are account-scoped by definition.
  if (request.headers.has('authorization')) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-HTTP requests
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname === 'm.stripe.network') return;

  const cacheable = isCacheable(event.request, url);

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (cacheable && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        if (!cacheable) {
          return new Response('Offline — check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline — check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});

// ===== Message handling (for main thread to store/retrieve offline data) =====
self.addEventListener('message', (event) => {
  const { type, key, value } = event.data || {};
  if (type === 'SET_OFFLINE') {
    event.waitUntil(dbSet(key, value).then(() => {
      if (event.ports?.[0]) event.ports[0].postMessage({ ok: true });
    }));
  } else if (type === 'GET_OFFLINE') {
    event.waitUntil(dbGet(key).then((val) => {
      if (event.ports?.[0]) event.ports[0].postMessage({ value: val });
    }));
  } else if (type === 'CLEAR_OFFLINE') {
    // Called on sign-out so the next user of the device inherits nothing.
    event.waitUntil(
      Promise.all([
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
        openDB().then((db) => new Promise((resolve) => {
          const tx = db.transaction('store', 'readwrite');
          tx.objectStore('store').clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        })).catch(() => {}),
      ]).then(() => {
        if (event.ports?.[0]) event.ports[0].postMessage({ ok: true });
      })
    );
  }
});
