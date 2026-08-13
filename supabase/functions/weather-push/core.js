const RAIN_THRESHOLD = 60;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function validProbability(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function parseOpenMeteoTomorrow(payload) {
  const times = payload?.daily?.time;
  const probabilities = payload?.daily?.precipitation_probability_max;
  if (!Array.isArray(times) || !Array.isArray(probabilities) || times.length < 2) return null;
  const date = times[1];
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !validProbability(probabilities[1])) return null;
  return { date, rainProbability: probabilities[1] };
}

export function parseNwsPayload(payload) {
  if (!payload || !Array.isArray(payload.features)) return null;
  return payload.features.flatMap(feature => {
    const properties = feature?.properties;
    if (!properties || properties.status !== 'Actual') return [];
    const id = typeof feature.id === 'string' ? feature.id.trim() : '';
    const event = typeof properties.event === 'string' ? properties.event.trim() : '';
    if (!id || !event) return [];
    return [{
      id,
      event,
      severity: typeof properties.severity === 'string' ? properties.severity.trim() : null,
    }];
  });
}

export function decideWeatherAlert({ rainProbability, nwsAlerts, jobCount }) {
  if (!Number.isInteger(jobCount) || jobCount < 1 || !validProbability(rainProbability) || !Array.isArray(nwsAlerts)) return null;
  const reasons = [];
  if (rainProbability >= RAIN_THRESHOLD) reasons.push('rain');
  if (nwsAlerts.length > 0) reasons.push('nws');
  if (reasons.length === 0) return null;

  const jobs = `${jobCount} ${jobCount === 1 ? 'job' : 'jobs'}`;
  const details = [];
  if (reasons.includes('rain')) details.push(`${Math.round(rainProbability)}% rain chance tomorrow`);
  if (reasons.includes('nws')) details.push(`NWS: ${nwsAlerts[0].event}`);
  return {
    title: 'MowGo weather heads-up',
    body: `${details.join(' · ')} may affect ${jobs}. Review tomorrow's route in MowGo.`,
    reasons,
  };
}

export async function buildEventKey({ ownerId, date }) {
  return `weather:alert:${ownerId}:${date}`;
}

function candidateForecastDates(now) {
  const date = new Date(now);
  return [0, 1, 2].map(offset => {
    const candidate = new Date(date);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    return candidate.toISOString().slice(0, 10);
  });
}

async function authorized(request, expected) {
  const supplied = request.headers.get('x-mowgo-cron-secret');
  if (!expected || !supplied) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function runWeatherPush(request, deps) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!await authorized(request, deps.cronSecret)) return json({ error: 'Unauthorized' }, 401);

  const candidateDates = candidateForecastDates(deps.now());
  let owners;
  try {
    owners = await deps.listOwnersWithTomorrowJobs(candidateDates);
  } catch {
    return json({ error: 'Weather notification run failed' }, 500);
  }
  const totals = { processed: owners.length, sent: 0, duplicate: 0, failed: 0 };

  for (const owner of owners) {
    let reservation = null;
    let delivered = false;
    try {
      const weather = await deps.fetchWeather(owner);
      const jobCount = owner.jobDates.filter(date => date === weather.date).length;
      const decision = decideWeatherAlert({ ...weather, jobCount });
      if (!decision) continue;
      const eventKey = await buildEventKey({
        ownerId: owner.id,
        date: weather.date,
      });
      const event = {
        eventKey,
        userId: owner.id,
        forecastDate: weather.date,
        reasons: decision.reasons,
        nwsAlertIds: weather.nwsAlerts.map(alert => alert.id),
      };
      const reservationToken = await deps.reserveEvent(event);
      if (!reservationToken) {
        totals.duplicate += 1;
        continue;
      }
      reservation = { eventKey, reservationToken };
      if (deps.markStarted) await deps.markStarted(eventKey, reservationToken);
      const sent = await deps.sendPush({ userId: owner.id, title: decision.title, body: decision.body });
      if (!sent) {
        await deps.releaseEvent(eventKey, reservationToken);
        reservation = null;
        totals.failed += 1;
        continue;
      }
      delivered = true;
      await deps.markSent(eventKey, reservationToken);
      totals.sent += 1;
    } catch {
      if (reservation && !delivered) {
        await deps.releaseEvent(reservation.eventKey, reservation.reservationToken).catch(() => {});
      }
      totals.failed += 1;
    }
  }
  return json(totals);
}
