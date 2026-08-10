/**
 * Cloudflare Pages Function — active official NWS alerts for a point.
 *
 * GET /api/weather-alerts?latitude=35.4676&longitude=-97.5164
 *
 * Required Cloudflare environment variable:
 *   NWS_USER_AGENT — descriptive application identity and real contact URL/email
 */
import { fetchActiveNwsAlerts, parseCoordinates } from './_shared/nws-alerts.js';

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
};

function json(body, status) {
  const cacheControl = status >= 200 && status < 300 ? 'public, max-age=60' : 'no-store';
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, 'Cache-Control': cacheControl },
  });
}

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const coordinates = parseCoordinates(url.searchParams.get('latitude'), url.searchParams.get('longitude'));
  if (!coordinates) return json({ error: 'Valid latitude and longitude are required.' }, 400);

  if (typeof env.NWS_USER_AGENT !== 'string' || !env.NWS_USER_AGENT.trim()) {
    console.warn('Weather alerts function: NWS_USER_AGENT is not configured');
    return json({ error: 'Weather alerts are unavailable.' }, 503);
  }

  try {
    const alerts = await fetchActiveNwsAlerts({
      ...coordinates,
      userAgent: env.NWS_USER_AGENT,
      fetchImpl: data?.fetchImpl || fetch,
      cache: data?.cache || globalThis.caches?.default,
    });
    return json({ alerts }, 200);
  } catch (error) {
    console.warn('Weather alerts function: NWS lookup failed', error?.message || 'unknown error');
    return json({ error: 'Weather alerts are unavailable.' }, 502);
  }
}
