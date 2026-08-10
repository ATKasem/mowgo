/** True when the conditions response contains at least one value worth displaying. */
export function meaningfulDayConditions(conditions) {
  return ['currentTemp', 'windMph', 'soilTempF', 'rain7dInches']
    .some(key => Number.isFinite(conditions?.[key]));
}

/** Presentation state for the Day Conditions card. */
export function dayConditionsView(hasLocation, loading, conditions) {
  if (loading || hasLocation === null) return 'loading';
  if (!hasLocation) return 'no-location';
  return meaningfulDayConditions(conditions) ? 'ready' : 'unavailable';
}

/** Shared Today/Dashboard presentation predicate for owner-visible team progress. */
export function teamProgressView(progress = []) {
  const hasCrew = progress.some(member => member?.role === 'crew');
  if (!hasCrew) return { show: false, rows: [], empty: false };

  const rows = progress.filter(member => Number(member?.total) > 0);
  return { show: true, rows, empty: rows.length === 0 };
}
