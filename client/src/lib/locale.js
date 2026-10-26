/** Intl locale for the app language (en/es); matches the i18n setup. */
export function localeFor(language) {
  return language === 'es' ? 'es-US' : 'en-US';
}

/**
 * A timestamptz (created_at, sent_at, …) as the viewer's local day, e.g.
 * "Oct 24". Never slice the ISO string: that is the UTC day, which is
 * tomorrow for evening records in the US. Unparseable input gives ''.
 */
export function formatLocalDay(timestamp, language) {
  const date = timestamp ? new Date(timestamp) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(localeFor(language), { month: 'short', day: 'numeric' });
}
