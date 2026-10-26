/**
 * Display helpers for jobs.scheduled_time / recurring_jobs.scheduled_time.
 * Those are Postgres TIME columns: the API returns "08:00:00" even though the
 * app writes "08:00". Show them as a locale short time ("8:00 AM"); CSV and
 * calendar exports keep the raw HH:mm value.
 */

import { localeFor } from './locale.js';

const formatters = new Map();

function formatterFor(language) {
  const locale = localeFor(language);
  if (!formatters.has(locale)) {
    // timeZone UTC: the value is a wall-clock time, so build it at the UTC
    // epoch and format it there — no device offset can shift the hour.
    formatters.set(locale, new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }));
  }
  return formatters.get(locale);
}

/** "08:00" / "08:00:00" → "8:00 AM" (es: "8:00 a.m."). Unparseable input is returned as-is. */
export function formatScheduledTime(raw, language) {
  if (raw === null || raw === undefined || raw === '') return '';
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(String(raw).trim());
  if (!match) return String(raw);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return String(raw);
  return formatterFor(language).format(new Date(Date.UTC(1970, 0, 1, hours, minutes)));
}
