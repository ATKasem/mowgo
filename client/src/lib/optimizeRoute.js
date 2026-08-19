// Pure route-optimization module — NO client imports (kept importable by node --test).
// Spec: docs/route-optimization-v1-scope.md §2.

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function tourDistance(tour) {
  let total = 0;
  for (let i = 1; i < tour.length; i++) total += haversineKm(tour[i - 1], tour[i]);
  return total;
}

export function nearestNeighborTour(entries, anchor) {
  const remaining = [...entries];
  const tour = [];
  let current = anchor ? { lat: anchor.lat, lng: anchor.lng } : null;
  while (remaining.length) {
    let bestIdx = 0;
    if (current) {
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineKm(current, remaining[i]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    tour.push(next);
    current = next;
  }
  return tour;
}

function totalWithAnchor(tour, anchor) {
  return (anchor ? haversineKm(anchor, tour[0]) : 0) + tourDistance(tour);
}

// 2-opt — repeat until no improving 2-reversal exists (N ≤ ~15/day → instant).
// Anchor-aware: the acceptance test includes the anchor→first-stop leg, so a
// reversal that saves inter-stop miles but costs more from the business
// location is rejected (Claude Code review fix).
export function twoOpt(tour, anchor = null) {
  let best = [...tour];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (totalWithAnchor(candidate, anchor) < totalWithAnchor(best, anchor)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * suggestDay(jobsByDay, newClient) → { dayIndex, dayName, avgDistanceKm } or null.
 * jobsByDay: { 0: [{lat,lng},...], ... } (0=Sun..6=Sat) — only days with
 * existing jobs are considered. Picks the day whose existing jobs are
 * geographically closest to newClient on average.
 */
export function suggestDay(jobsByDay, newClient) {
  let bestDay = null;
  let bestAvg = Infinity;

  for (const [dayIndex, jobs] of Object.entries(jobsByDay)) {
    if (!jobs || jobs.length === 0) continue;
    const totalDist = jobs.reduce((sum, j) => sum + haversineKm(newClient, j), 0);
    const avg = totalDist / jobs.length;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestDay = parseInt(dayIndex, 10);
    }
  }

  if (bestDay === null) return null;
  return { dayIndex: bestDay, dayName: DAY_NAMES[bestDay], avgDistanceKm: Math.round(bestAvg * 10) / 10 };
}

/**
 * optimizeRoute(jobs, anchor, zoneMap?) → ordered job id array.
 * jobs: [{ id, lat, lng }] — null lat/lng = unaddressable, stays in its
 * relative place (spec: "optimizer works around them").
 */
export function optimizeRoute(jobs, anchor, zoneMap) {
  if (zoneMap !== undefined) return optimizeRouteByZone(jobs, anchor, zoneMap);
  if (jobs.length <= 2) return jobs.map(j => j.id);
  const addressable = jobs
    .map((j, idx) => ({ idx, lat: j.lat, lng: j.lng }))
    .filter(p => p.lat != null && p.lng != null);
  if (addressable.length < 2) return jobs.map(j => j.id); // nothing to optimize

  const without = jobs
    .map((j, idx) => ({ idx, lat: j.lat, lng: j.lng }))
    .filter(p => p.lat == null || p.lng == null);

  // Defensive size cap: 2-opt is ~O(n³); a real day rarely exceeds ~30 stops.
  // Above that, nearest-neighbor only, so a huge bulk-imported day can never
  // freeze the tab (Claude Code review fix).
  const ordered = addressable.length <= 30
    ? twoOpt(nearestNeighborTour(addressable, anchor || null), anchor || null)
    : nearestNeighborTour(addressable, anchor || null);

  // Merge: unaddressable jobs slot back into their original gaps, in their
  // original relative order.
  const orderedSet = new Set(ordered.map(p => p.idx));
  const result = [];
  let oi = 0;
  let wi = 0;
  for (let i = 0; i < jobs.length; i++) {
    if (orderedSet.has(i)) result.push(ordered[oi++]);
    else result.push(without[wi++]);
  }
  return result.map(p => jobs[p.idx].id);
}

/**
 * Groups jobs by zone, orders zones nearest-first from their centroid, then
 * optimizes the jobs within each zone. Null/undefined zones always come last.
 */
export function optimizeRouteByZone(jobs, anchor, zoneMap) {
  // zoneMap carries the caller's zone metadata; job.zone_id determines group
  // membership so jobs remain routable even if that metadata is stale.
  void zoneMap;

  const zoneGroups = new Map();
  const unzoned = [];
  for (const job of jobs) {
    if (job.zone_id == null) {
      unzoned.push(job);
      continue;
    }
    if (!zoneGroups.has(job.zone_id)) zoneGroups.set(job.zone_id, []);
    zoneGroups.get(job.zone_id).push(job);
  }

  const zones = [...zoneGroups.values()].map(zoneJobs => {
    const addressable = zoneJobs.filter(job => job.lat != null && job.lng != null);
    const centroid = addressable.length === 0 ? null : {
      lat: addressable.reduce((sum, job) => sum + job.lat, 0) / addressable.length,
      lng: addressable.reduce((sum, job) => sum + job.lng, 0) / addressable.length,
    };
    return { jobs: zoneJobs, centroid };
  });

  if (anchor) {
    zones.sort((a, b) => {
      const distanceA = a.centroid ? haversineKm(anchor, a.centroid) : Infinity;
      const distanceB = b.centroid ? haversineKm(anchor, b.centroid) : Infinity;
      return distanceA - distanceB;
    });
  }

  return [
    ...zones.flatMap(zone => optimizeRoute(zone.jobs, anchor)),
    ...optimizeRoute(unzoned, anchor),
  ];
}
