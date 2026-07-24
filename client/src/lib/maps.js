/**
 * Returns the correct maps URL based on the user's platform.
 * iOS/macOS → Apple Maps (system default)
 * Android → Google Maps (system default)
 * Everything else → Google Maps (universal fallback)
 */
export function getMapsUrl(address) {
  const q = encodeURIComponent(address);
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isMac = /Macintosh/.test(ua) && !isIOS;
  const isAndroid = /Android/.test(ua);

  if (isIOS || isMac) return `https://maps.apple.com/?q=${q}`;
  if (isAndroid) return `geo:0,0?q=${q}`; // opens Google Maps app natively
  return `https://maps.google.com/?q=${q}`; // web fallback
}
