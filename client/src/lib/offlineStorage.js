/**
 * Offline storage using service worker's IndexedDB via MessageChannel.
 * Falls back to localStorage when SW is not available.
 */
const SW_FALLBACK = typeof localStorage !== 'undefined';

export async function saveOffline(key, value) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve) => {
      const { port1, port2 } = new MessageChannel();
      port1.onmessage = (e) => resolve(e.data.ok);
      navigator.serviceWorker.controller.postMessage(
        { type: 'SET_OFFLINE', key, value },
        [port2]
      );
      setTimeout(() => resolve(false), 2000);
    });
  }
  // Fallback: localStorage
  try {
    localStorage.setItem(`mf_${key}`, JSON.stringify({ value, updated: Date.now() }));
  } catch (e) { console.warn('offlineStorage: saveOffline localStorage quota exceeded', e); }
}

export async function loadOffline(key) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve) => {
      const { port1, port2 } = new MessageChannel();
      port1.onmessage = (e) => resolve(e.data.value);
      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_OFFLINE', key },
        [port2]
      );
      setTimeout(() => resolve(null), 2000);
    });
  }
  // Fallback: localStorage
  try {
    const raw = localStorage.getItem(`mf_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.value;
    }
  } catch (e) { console.warn('offlineStorage: loadOffline localStorage corrupt data', e); }
  return null;
}

/** Persist app state (jobs, clients, invoices) to offline storage */
export async function persistAppState(jobs, clients, invoices) {
  try {
    await Promise.all([
      saveOffline('jobs', jobs),
      saveOffline('clients', clients),
      saveOffline('invoices', invoices),
    ]);
  } catch (e) { console.warn('offlineStorage: persistAppState failed', e); }
}

/** Determine if the app is currently offline */
export function isCurrentlyOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}
