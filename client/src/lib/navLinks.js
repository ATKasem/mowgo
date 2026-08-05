// Pure nav-link builders — NO client imports (node --test compatible).
//
// Google Maps URLs (developers.google.com/maps/documentation/urls/get-started):
//   - commas in coordinate params MUST be encoded as %2C; waypoint pipes as %7C
//   - max 9 waypoints + destination (only 3 on mobile browsers) → cap at 10 stops
//   - travelmode=driving keeps the intent explicit
// Apple unified Maps URLs (developer.apple.com/documentation/mapkit/unified-map-urls):
//   - /directions?source=&destination=&waypoint=… (repeatable); destination is the
//     ENDING destination, waypoints are the stops in between (per Apple's table).
//     Coordinates use RAW commas in Apple's documented examples.
//   - unified URLs require iOS 18.4+ / macOS 15.4+; older devices degrade to
//     single-stop links (per-stop tap remains the fallback).
// Waze: single destination only (one stop per route — official); multi-stop links
//       do not exist, callers hide "Send all stops" for waze.
const GOOGLE_CAP = 10; // 9 waypoints + destination (documented max otherwise)
const APPLE_CAP = 10;  // defensive — Apple documents no waypoint cap

function coord(lat, lng) {
  return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}

function encode(s) {
  return encodeURIComponent(String(s));
}

export function buildGoogleDirUrl(anchor, stops) {
  const withCoords = stops.filter(s => s.lat != null && s.lng != null);
  const skipped = stops.length - withCoords.length;
  if (!withCoords.length) return { url: null, skipped, truncated: false };

  const capped = withCoords.slice(0, GOOGLE_CAP);
  const truncated = withCoords.length > GOOGLE_CAP;
  const destination = capped[capped.length - 1];

  let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
  if (anchor) url += `&origin=${encode(coord(anchor.lat, anchor.lng))}`;
  url += `&destination=${encode(coord(destination.lat, destination.lng))}`;
  const waypoints = capped.slice(0, -1).map(s => coord(s.lat, s.lng));
  if (waypoints.length) url += `&waypoints=${waypoints.map(encode).join('%7C')}`;
  return { url, skipped, truncated, count: capped.length };
}

export function buildAppleDirUrl(anchor, stops) {
  const withCoords = stops.filter(s => s.lat != null && s.lng != null);
  const skipped = stops.length - withCoords.length;
  if (!withCoords.length) return { url: null, skipped, truncated: false };

  const capped = withCoords.slice(0, APPLE_CAP);
  const truncated = withCoords.length > APPLE_CAP;
  const destination = capped[capped.length - 1]; // ending destination (Apple docs)
  const middle = capped.slice(0, -1); // waypoints = stops in between source/destination

  let url = 'https://maps.apple.com/directions?mode=driving';
  if (anchor) url += `&source=${coord(anchor.lat, anchor.lng)}`;
  url += `&destination=${encode(destination.address || coord(destination.lat, destination.lng))}`;
  for (const s of middle) url += `&waypoint=${coord(s.lat, s.lng)}`;
  return { url, skipped, truncated, count: capped.length };
}

export function buildWazeStopUrl(stop) {
  return `https://waze.com/ul?ll=${coord(stop.lat, stop.lng)}&navigate=yes`;
}

export function buildSingleStopUrl(app, stop) {
  if (app === 'waze') return buildWazeStopUrl(stop);
  if (app === 'apple') return `https://maps.apple.com/?daddr=${encode(coord(stop.lat, stop.lng))}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encode(coord(stop.lat, stop.lng))}`;
}

export function buildRouteLink(app, anchor, stops) {
  if (app === 'waze') return { url: null, skipped: 0, truncated: false };
  return app === 'apple' ? buildAppleDirUrl(anchor, stops) : buildGoogleDirUrl(anchor, stops);
}
