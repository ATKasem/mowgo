/**
 * Stable order for a day's stops, matching iOS (Job.displayOrder) and Android
 * (JobWithClient.DISPLAY_ORDER): route_order first (unordered last), then time
 * (untimed last), then id. Status deliberately plays no part — a job must not
 * move when it is started or completed, or the next tap lands on a different
 * job. loadJobs' server order (orderJobs in data.js) agrees with this.
 */
const routeRank = value => (Number.isFinite(value) ? value : Infinity);
// HH:mm only: the app writes "08:00", the DB returns "08:00:00".
const timeKey = value => (value ? String(value).slice(0, 5) : null);

export function compareDayOrder(a, b) {
  const route = routeRank(a.route_order) - routeRank(b.route_order);
  if (route !== 0 && !Number.isNaN(route)) return route;
  const timeA = timeKey(a.scheduled_time);
  const timeB = timeKey(b.scheduled_time);
  if (timeA !== timeB) {
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    return timeA < timeB ? -1 : 1;
  }
  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
}

/** All jobs: by date, then [compareDayOrder] within each day. */
export function compareScheduleOrder(a, b) {
  if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date < b.scheduled_date ? -1 : 1;
  return compareDayOrder(a, b);
}

export function sortJobs(jobs) {
  return [...jobs].sort(compareScheduleOrder);
}
