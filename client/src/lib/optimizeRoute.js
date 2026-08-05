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

/**
 * optimizeRoute(jobs, anchor) → ordered job id array.
 * jobs: [{ id, lat, lng }] — null lat/lng = unaddressable, stays in its
 * relative place (spec: "optimizer works around them").
 */
export function optimizeRoute(jobs, anchor) {
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
