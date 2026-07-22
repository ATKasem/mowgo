/**
 * Returns the correct maps URL for the user's platform.
 * iOS → Apple Maps, everything else → Google Maps.
 */
export function getMapsUrl(address) {
  const q = encodeURIComponent(address);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return isIOS
    ? `maps://?q=${q}`          // Apple Maps (native app)
    : `https://maps.google.com/?q=${q}`; // Google Maps
}
