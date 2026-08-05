// Pure nav-link builders — NO client imports (node --test compatible).
// Google cap: 8 waypoints + destination without an API key (documented limit).
const GOOGLE_CAP = 10;

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

  let url = 'https://www.google.com/maps/dir/?api=1';
  if (anchor) url += `&origin=${coord(anchor.lat, anchor.lng)}`;
  url += `&destination=${coord(destination.lat, destination.lng)}`;
  const waypoints = capped.slice(0, -1).map(s => coord(s.lat, s.lng));
  if (waypoints.length) url += `&waypoints=${waypoints.map(encode).join('|')}`;
  return { url, skipped, truncated };
}

export function buildAppleDirUrl(anchor, stops) {
  const withCoords = stops.filter(s => s.lat != null && s.lng != null);
  const skipped = stops.length - withCoords.length;
  if (!withCoords.length) return { url: null, skipped, truncated: false };

  const [first, ...rest] = withCoords;
  let url = 'https://maps.apple.com/directions?mode=driving';
  if (anchor) url += `&source=${coord(anchor.lat, anchor.lng)}`;
  url += `&destination=${encode(first.address || coord(first.lat, first.lng))}`;
  for (const s of rest) url += `&waypoint=${encode(coord(s.lat, s.lng))}`;
  return { url, skipped, truncated: false };
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
