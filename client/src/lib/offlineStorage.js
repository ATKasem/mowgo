/**
 * Offline storage using service worker's IndexedDB via MessageChannel.
 * Falls back to localStorage when SW is not available.
 */
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

/**
 * Wipe cached responses and offline records. Call on sign-out so customer data
 * does not persist on a shared device after the session ends.
 */
export async function clearOffline() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    await new Promise((resolve) => {
      const { port1, port2 } = new MessageChannel();
      port1.onmessage = () => resolve(true);
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_OFFLINE' }, [port2]);
      setTimeout(() => resolve(false), 2000);
    });
  }
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('mf_')) localStorage.removeItem(key);
    }
  } catch (e) { console.warn('offlineStorage: clearOffline failed', e); }
}

/** Determine if the app is currently offline */
export function isCurrentlyOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}
