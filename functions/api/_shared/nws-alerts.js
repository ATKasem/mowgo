const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active';
const CACHE_TTL_SECONDS = 120;
const DEFAULT_TIMEOUT_MS = 8_000;

function nullableString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function officialNwsUrl(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    try {
      const url = new URL(candidate);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && (url.hostname === 'weather.gov' || url.hostname.endsWith('.weather.gov'))) {
        url.protocol = 'https:';
        return url.toString();
      }
    } catch {
      // Ignore malformed or non-URL upstream fields.
    }
  }
  return null;
}

export function parseCoordinates(latitudeValue, longitudeValue) {
  if (
    latitudeValue === null || String(latitudeValue).trim() === ''
    || longitudeValue === null || String(longitudeValue).trim() === ''
  ) return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function normalizeNwsAlert(feature) {
  if (!feature || typeof feature !== 'object' || !feature.properties || typeof feature.properties !== 'object') {
    return null;
  }
  const properties = feature.properties;
  const title = nullableString(properties.headline) || nullableString(properties.event);
  if (!title) return null;

  return {
    source: 'National Weather Service',
    title,
    severity: nullableString(properties.severity),
    urgency: nullableString(properties.urgency),
    certainty: nullableString(properties.certainty),
    onset: nullableString(properties.onset) || nullableString(properties.effective),
    expires: nullableString(properties.expires) || nullableString(properties.ends),
    area: nullableString(properties.areaDesc),
    instruction: nullableString(properties.instruction),
    url: officialNwsUrl(properties.web, feature.id),
  };
}

function cacheKey(latitude, longitude) {
  const point = `${latitude},${longitude}`;
  return new Request(`https://mowgo.internal/nws-alerts?point=${encodeURIComponent(point)}`);
}

export async function fetchActiveNwsAlerts({
  latitude,
  longitude,
  userAgent,
  fetchImpl = fetch,
  cache,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (typeof userAgent !== 'string' || !userAgent.trim() || userAgent.length > 256 || /[\r\n]/.test(userAgent)) {
    throw new Error('NWS User-Agent is not configured');
  }

  const key = cacheKey(latitude, longitude);
  if (cache) {
    try {
      const cached = await cache.match(key);
      if (cached) {
        const alerts = await cached.json();
        if (Array.isArray(alerts)) return alerts;
      }
    } catch {
      // A cache outage must not prevent a fresh authoritative lookup.
    }
  }

  const url = new URL(NWS_ALERTS_URL);
  url.searchParams.set('point', `${latitude},${longitude}`);

  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': userAgent.trim(),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error('NWS request timed out');
    }
    throw new Error('NWS alerts are unavailable');
  }

  if (!response.ok) throw new Error('NWS alerts are unavailable');

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('NWS returned an invalid response');
  }
  if (!payload || !Array.isArray(payload.features)) throw new Error('NWS returned an invalid response');

  const alerts = payload.features.map(normalizeNwsAlert).filter(Boolean);
  if (cache) {
    try {
      await cache.put(key, Response.json(alerts, {
        headers: { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
      }));
    } catch {
      // Cache writes are best effort; the authoritative response remains usable.
    }
  }
  return alerts;
}
