/**
 * Returns the correct maps URL for the user's platform.
 * iOS → Apple Maps, everything else → Google Maps.
 */
export function getMapsUrl(address) {
  const q = encodeURIComponent(address);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isMac = /Macintosh/.test(navigator.userAgent) && !isIOS;
  return (isIOS || isMac)
    ? `http://maps.apple.com/?q=${q}`
    : `https://maps.google.com/?q=${q}`;
}
