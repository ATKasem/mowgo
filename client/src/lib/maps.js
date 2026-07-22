/**
 * Returns the correct maps URL for the user's platform.
 * iOS → Apple Maps, everything else → Google Maps.
 */
export function getMapsUrl(address) {
  const q = encodeURIComponent(address);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return isIOS
    ? `http://maps.apple.com/?q=${q}`  // Apple Maps (opens app if installed, web fallback)
    : `https://maps.google.com/?q=${q}`; // Google Maps
}
