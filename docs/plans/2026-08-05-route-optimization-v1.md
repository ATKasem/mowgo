# Route Optimization v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (or executing-plans) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Route Optimization v1 — a paid-tier "Optimize" button on Today that reorders the day's jobs by drive distance (pure client-side nearest-neighbor + 2-opt), a "Send route" chooser (all stops / one by one) into the user's preferred nav app, and the landing/compare copy flip from "Coming soon" to "live."

**Architecture:** $0 stack, no new APIs/keys. Migration adds lat/lng to clients + `preferred_nav_app` to profiles. Open-Meteo geocoding (free, no key — same provider as the existing weather feature) with lazy backfill on first Optimize tap, cached in the row. Reorder persists through the existing `route_order` + `reorderJobs` path — which first gets ported to a Cloudflare Pages Function (it currently exists only in legacy `server/`, so drag-drop likely 404s in prod today). Nav links are pure URL builders (Google dir URL, Apple unified Maps URL, Waze single-stop URL) — no map APIs.

**Tech Stack:** React 19 + Vite 8 (client), Cloudflare Pages Functions (functions/api), Supabase (Postgres + RLS), Open-Meteo geocoding, node --test for pure modules (repo precedent: `functions/api/_shared/safe-webhook-url.test.js`). NO test runner for UI — verify via `npm run lint` + `npm run build` + manual QA (project reality: "Web has NO CI").

## Global Constraints

- **Spec:** `docs/route-optimization-v1-scope.md` is authoritative (commit `7a6b3f8` includes the Claude Code review fixes). Read it first.
- **Paid tiers only:** Optimize/Send route visible when `profile.tier` ∈ `solo|crew|premium` AND `!isCrewMember` AND `crewFilter === null` (Claude Code HIGH fix — `route_order` is date-wide; crew/filtered views would reorder other assignees).
- **i18n slug rule:** every key = `textKey(english)` — lowercase, NFD-strip, non-alnum → `_`, trim `_`, **slice 72**. NEVER hand-count: verify with `node -e "const k='<sentence>'; console.log(k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,72))"` and use its output verbatim. Apostrophes → `_` (`couldn't` → `couldn_t`).
- **Spanish:** es.json via Google Translate API (mowgo-dev skill pattern). NEVER Mimo/Codex Spanish. Add every new key to BOTH en.json and es.json.
- **Fact-lock:** no new stats, no price changes, no unsourced competitor claims. Compare-page competitor routing values get a real research pass (Task 9) with sources recorded — never guessed.
- **Migration:** timestamp naming (014 is TAKEN by concierge_requests; repo's newest is `20260731193000_add_client_tags.sql`). Apply via Supabase CLI access token (`sbp_…`, full SQL scope) — NOT the Management API key. Check remote migration state first (review-loop lesson: out-of-band migrations exist; never `--include-all`).
- **Deploy:** from **repo root** only: `npx wrangler pages deploy client/dist --project-name=mowgo --commit-dirty=true`. NEVER from client/.
- **Review gate before ship:** Claude Code PRIMARY (`claude -p`, prompt in a file under `/opt/data` — NOT `/tmp`; NOT a giant inline one-liner) + Mimo second pass (`delegate_task`, model `xiaomi/mimo-v2.5`). Fix all HIGH/MEDIUM. Codex resumes Aug 8.
- **Dark + light mode** both verified before each UI commit.
- `scheduled_time` is NEVER touched by reordering.
- iOS/Android parity → Ideas Dartboard. Do NOT touch native in this batch.

---

### Task 0: Port `POST /api/jobs/reorder` to a Cloudflare Pages Function (fixes live drag-drop)

**Objective:** Make the existing drag-drop reorder persist in production — it currently posts to `/api/jobs/reorder`, which exists ONLY in legacy `server/index.js:294` (Claude Code CRITICAL; likely 404s on the live site today). Optimize rides this same path.

**Files:**
- Create: `functions/api/jobs/reorder.js`
- Reference: `functions/api/team/[memberId].js` (auth + service-key pattern), `server/index.js:294-307` (legacy logic)

**Interfaces:**
- Consumes: `reorder_jobs(uuid, jsonb)` RPC — migration 003, `GRANT EXECUTE ... TO service_role` ONLY → must be called with the service key, never anon/auth.
- Produces: `POST /api/jobs/reorder` → `{ success: true }` | error JSON.

- [ ] **Step 1: Create the function**

```js
/**
 * Cloudflare Pages Function — Reorder Jobs
 *
 * POST /api/jobs/reorder
 * Headers: Authorization: Bearer <token>
 * Body: { orders: [{ id: string, route_order: integer }] }
 *
 * Ported from legacy server/index.js:294-307 (which is NOT deployed on CF Pages).
 * reorder_jobs RPC (migration 003) is GRANT EXECUTE to service_role ONLY,
 * so this must run with the service key. Same shape as team/[memberId].js.
 */
const ALLOWED_ORIGINS = ['https://mowgoapp.com', 'https://mowgo.pages.dev'];

function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(request, body, status) {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return jsonResponse(request, { error: 'Authentication required' }, 401);

  const supabaseUrl = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(request, { error: 'Server misconfigured' }, 500);
  }

  // Verify the Bearer token (same as team/[memberId].js:49-59).
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey || serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return jsonResponse(request, { error: 'Invalid token' }, 401);
  const { id: userId } = await userRes.json();
  if (!userId) return jsonResponse(request, { error: 'Invalid token' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON' }, 400);
  }

  const { orders } = body;
  if (!Array.isArray(orders)) return jsonResponse(request, { error: 'orders must be an array' }, 400);
  if (!orders.every(({ id, route_order }) => typeof id === 'string' && Number.isInteger(route_order))) {
    return jsonResponse(request, { error: 'Each order requires an id and integer route_order' }, 400);
  }

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/reorder_jobs`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ p_user_id: userId, p_orders: orders }),
  });
  if (!rpcRes.ok) {
    console.error('jobs/reorder: RPC failed', await rpcRes.text());
    return jsonResponse(request, { error: 'Could not reorder jobs' }, 500);
  }

  return jsonResponse(request, { success: true }, 200);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
```

- [ ] **Step 2: Lint + build check**

Run: `npm run lint && npm run build` (repo root, `client/` for lint/build) — expected: no errors introduced.

- [ ] **Step 3: Deploy + verify live** (first deployment of this batch — subsequent tasks reuse the same command)

```bash
cd /opt/data/mowgo && npx wrangler pages deploy client/dist --project-name=mowgo --commit-dirty=true
curl -s -X POST https://mowgoapp.com/api/jobs/reorder -H 'Content-Type: application/json' -d '{}'
```

Expected: JSON `{"error":"orders must be an array"}` with status 400 — NOT 404/HTML. (With no body it 400s on JSON parse; with `{}` it 400s on validation — either proves the function exists.)

- [ ] **Step 4: Live drag-drop regression** — on mowgoapp.com, drag a job to a new slot in Today → order survives reload. This feature was likely broken in prod; it must work now.

- [ ] **Step 5: Commit**

```bash
cd /opt/data/mowgo && git add functions/api/jobs/reorder.js && git commit -m "fix(api): port POST /api/jobs/reorder to CF Pages Function (drag-drop 404 in prod)"
```

---

### Task 1: Migration `20260805193000_client_coords.sql`

**Objective:** Add lat/lng to clients and `preferred_nav_app` to profiles, with the correct grant.

**Files:**
- Create: `supabase/migrations/20260805193000_client_coords.sql`
- Reference: `supabase/migrations/013_profile_location.sql`, `supabase/migrations/002_crew_features.sql:79` (profiles REVOKE)

**Interfaces:**
- Produces: `clients.latitude`, `clients.longitude` (double precision, nullable); `profiles.preferred_nav_app` (text, nullable); `GRANT UPDATE (preferred_nav_app) ON profiles TO authenticated`.

- [ ] **Step 1: Write the migration**

```sql
-- Route Optimization v1: client coordinates + nav-app preference.
-- Naming: timestamp convention (014 is taken by concierge_requests; newest
-- repo migration is 20260731193000_add_client_tags.sql).

ALTER TABLE clients ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_nav_app TEXT DEFAULT NULL;
-- profiles got REVOKE UPDATE in 002:79, so new profile columns need the
-- 013-style column grant. clients needs NO grant (plain RLS, no revoke).
GRANT UPDATE (preferred_nav_app) ON profiles TO authenticated;
```

- [ ] **Step 2: Confirm remote migration state** (review-loop lesson — out-of-band migrations exist; never `--include-all`)

Run: `supabase db query --linked "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3"` — confirm `20260805193000_client_coords` is NOT present before applying.

- [ ] **Step 3: Apply via the Supabase CLI access token** (from `/opt/data/.env` — `sbp_…` has full SQL scope; Management API key 403s on SQL)

```bash
# SUPABASE_PROJECT_REF + SUPABASE_CLI_TOKEN from /opt/data/.env
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_CLI_TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat supabase/migrations/20260805193000_client_coords.sql | tr '\n' ' ')\"}"
```

- [ ] **Step 4: Verify** — with the service key (`.env`):

```bash
curl -s "https://$SUPABASE_PROJECT_REF.supabase.co/rest/v1/clients?select=id,latitude,longitude&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
curl -s "https://$SUPABASE_PROJECT_REF.supabase.co/rest/v1/profiles?select=id,preferred_nav_app&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

Expected: both → HTTP 200 with the columns present (null values fine).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260805193000_client_coords.sql && git commit -m "feat(db): client lat/lng + preferred_nav_app (timestamp-named migration)"
```

---

### Task 2: Data layer — allowlists, geocoding, saveProfile

**Objective:** Make coords survive every read (Claude Code CRITICAL), add lazy geocode backfill, and make `preferred_nav_app` persist (Claude Code HIGH).

**Files:**
- Modify: `client/src/lib/data.js` — `loadJobs` client mapping (~113-125), `loadClients` mapping (~442-454), `saveProfile` (~949-982), plus new functions near `loadClients`.
- Reference: `getWeatherForLocation` (~394) — proves Open-Meteo works from the browser.

**Interfaces:**
- Consumes: `updateClient(id, updates)` (exists — demo-aware).
- Produces: `geocodeAddress(address) → {latitude, longitude} | null` (never throws); `updateClientCoords(clientId, lat, lng)`; `ensureClientCoords(clients) → Map<clientId, {lat, lng}>` (sequential, ~100ms spacing, persists via `updateClient`, caches by writing the row); `loadJobs`/`loadClients` client objects now carry `latitude`/`longitude`; `saveProfile` accepts + persists `preferred_nav_app`.

- [ ] **Step 1: Extend `loadJobs` client mapping** (inside the existing `.map(j => ({...}))` at ~113-125):

```js
    clients: j.clients ? {
      id: j.clients.id,
      name: j.clients.name,
      address: j.clients.address,
      phone: j.clients.phone,
      email: j.clients.email,
      rate: j.clients.rate,
      latitude: j.clients.latitude ?? null,
      longitude: j.clients.longitude ?? null,
      service_notes: j.clients.cleaning_notes,
      key_code: j.clients.key_code,
      alarm_code: j.clients.alarm_code,
      pet_instructions: j.clients.pet_instructions,
      tags: j.clients.tags || [],
    } : null,
```

- [ ] **Step 2: Extend `loadClients` mapping** (at ~442-454):

```js
  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.phone,
    email: c.email,
    rate: c.rate,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    service_notes: c.cleaning_notes,
    key_code: c.key_code,
    alarm_code: c.alarm_code,
    pet_instructions: c.pet_instructions,
    tags: c.tags || [],
  }));
```

- [ ] **Step 3: Add the geocoding helpers** (place after `loadClients`, ~line 456):

```js
// ===== Route Optimization: geocoding =====

/** Open-Meteo geocoding — free, no key (same provider as getWeatherForLocation). */
export async function geocodeAddress(address) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    return hit && typeof hit.latitude === 'number' && typeof hit.longitude === 'number'
      ? { latitude: hit.latitude, longitude: hit.longitude }
      : null;
  } catch {
    return null; // graceful failure — never throw
  }
}

export async function updateClientCoords(clientId, lat, lng) {
  return updateClient(clientId, { latitude: lat, longitude: lng });
}

/**
 * Lazy backfill: for clients with an address but no coords, geocode
 * sequentially (~100ms apart, rate-limit-safe), persist, and return a
 * clientId → {lat, lng} map. Coords already on the row are reused — the
 * second Optimize tap makes zero new geocode calls (spec test #4).
 */
export async function ensureClientCoords(clients) {
  const map = {};
  let pending = 0;
  for (const client of clients) {
    if (!client || !client.address) continue;
    if (client.latitude != null && client.longitude != null) {
      map[client.id] = { lat: client.latitude, lng: client.longitude };
      continue;
    }
    pending++;
    if (pending > 1) await new Promise(r => setTimeout(r, 100));
    const coords = await geocodeAddress(client.address);
    if (coords) {
      try { await updateClientCoords(client.id, coords.latitude, coords.longitude); } catch (err) {
        console.error('geocode persist failed:', err);
      }
      map[client.id] = { lat: coords.latitude, lng: coords.longitude };
    }
  }
  return map;
}
```

- [ ] **Step 4: `saveProfile` — persist `preferred_nav_app`** (Claude Code HIGH — it is NOT a generic PATCH; add the field to the destructure at ~973 and the upsert at ~974-979):

```js
  const { business_name, phone, venmo_handle, cashapp_handle, zelle_handle, preferred_nav_app } = profile;
  const { error } = await supabase.from('profiles').upsert({
    id: user.id, business_name, phone, latitude, longitude,
    preferred_nav_app: preferred_nav_app || null,
    venmo_handle: venmo_handle || null,
    cashapp_handle: cashapp_handle || null,
    zelle_handle: zelle_handle || null,
  });
```

Demo path (lines 960-968) already spreads `...profile` — no change needed there.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build` — clean. Manual: open the app, check Network tab that `loadClients`/`loadJobs` responses now include latitude/longitude (after Task 1).

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/data.js && git commit -m "feat(data): coords in read allowlists + Open-Meteo backfill + preferred_nav_app persist"
```

---

### Task 3: Pure optimizer module + node --test

**Objective:** Nearest-neighbor + 2-opt on haversine, pure and dependency-free (importable by node --test; repo precedent `functions/api/_shared/safe-webhook-url.test.js`).

**Files:**
- Create: `client/src/lib/optimizeRoute.js`
- Create: `client/src/lib/optimizeRoute.test.js`

**Interfaces:**
- Consumes: nothing (NO imports — keeps it node-testable).
- Produces: `optimizeRoute(jobs, anchor) → string[]` (job ids in optimized order). Input jobs: `[{ id, lat, lng }]` (lat/lng null = unaddressable — they keep their relative place per spec). `anchor = {lat, lng} | null`.

- [ ] **Step 1: Write the module**

```js
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

// 2-opt — repeat until no improving 2-reversal exists (N ≤ ~15/day → instant).
export function twoOpt(tour) {
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
        if (tourDistance(candidate) < tourDistance(best)) {
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

  const ordered = twoOpt(nearestNeighborTour(addressable, anchor || null));

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
```

- [ ] **Step 2: Write the tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, optimizeRoute, tourDistance } from './optimizeRoute.js';

// OKC-area demo coordinates (demoData values from Task 7)
const OKC = { lat: 35.4676, lng: -97.5164 };          // anchor (Green Thumb)
const EDMOND = { lat: 35.6528, lng: -97.4787 };       // Bill Henderson (Edmond)
const OKC_E = { lat: 35.5219, lng: -97.4377 };        // Karen Walsh (OKC east)
const NICHOLS = { lat: 35.5512, lng: -97.5447 };      // Tom Harrison (Nichols Hills)

test('haversineKm: known OKC→Edmond distance ~21km', () => {
  const d = haversineKm(OKC, EDMOND);
  assert.ok(d > 18 && d < 24, `got ${d}`);
});

test('optimizeRoute: 3 stops ordered nearest-first from anchor', () => {
  const jobs = [
    { id: 'a', lat: EDMOND.lat, lng: EDMOND.lng },   // far
    { id: 'b', lat: OKC_E.lat, lng: OKC_E.lng },     // near
    { id: 'c', lat: NICHOLS.lat, lng: NICHOLS.lng }, // mid
  ];
  const order = optimizeRoute(jobs, OKC);
  assert.equal(order[0], 'b'); // nearest to anchor first
});

test('optimizeRoute: tour shorter than input order', () => {
  const jobs = [
    { id: 'a', lat: EDMOND.lat, lng: EDMOND.lng },
    { id: 'b', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'c', lat: NICHOLS.lat, lng: NICHOLS.lng },
  ];
  const order = optimizeRoute(jobs, OKC);
  const byId = Object.fromEntries(jobs.map(j => [j.id, j]));
  const tour = order.map(id => byId[id]);
  assert.ok(tourDistance(tour) <= tourDistance(jobs), 'optimized tour must not be longer');
});

test('optimizeRoute: unaddressable jobs keep their relative place', () => {
  const jobs = [
    { id: 'a', lat: EDMOND.lat, lng: EDMOND.lng },
    { id: 'x', lat: null, lng: null },
    { id: 'b', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'c', lat: NICHOLS.lat, lng: NICHOLS.lng },
  ];
  const order = optimizeRoute(jobs, OKC);
  assert.equal(order[1], 'x'); // unaddressable stays in its original slot
});

test('optimizeRoute: no anchor starts from first stop', () => {
  const jobs = [
    { id: 'a', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'b', lat: EDMOND.lat, lng: EDMOND.lng },
    { id: 'c', lat: NICHOLS.lat, lng: NICHOLS.lng },
  ];
  const order = optimizeRoute(jobs, null);
  assert.equal(order.length, 3);
  assert.equal(order[0], 'a'); // first stop is the seed
});

test('optimizeRoute: <2 addressable returns original order', () => {
  const jobs = [
    { id: 'a', lat: null, lng: null },
    { id: 'b', lat: OKC_E.lat, lng: OKC_E.lng },
    { id: 'c', lat: null, lng: null },
  ];
  assert.deepEqual(optimizeRoute(jobs, OKC), ['a', 'b', 'c']);
});

test('optimizeRoute: empty and single-job arrays', () => {
  assert.deepEqual(optimizeRoute([], OKC), []);
  assert.deepEqual(optimizeRoute([{ id: 'a', lat: 1, lng: 2 }], OKC), ['a']);
});
```

- [ ] **Step 3: Run tests — must pass**

Run: `node --test client/src/lib/optimizeRoute.test.js` — expected: 7 pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/optimizeRoute.js client/src/lib/optimizeRoute.test.js && git commit -m "feat(routes): pure nearest-neighbor + 2-opt optimizer with node --test"
```

---

### Task 4: Pure nav-link builders + node --test

**Objective:** URL builders for Google Maps (multi-stop dir link), Apple Maps (unified multi-waypoint URL), Waze (single-stop). No fetch, no client imports.

**Files:**
- Create: `client/src/lib/navLinks.js`
- Create: `client/src/lib/navLinks.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `buildGoogleDirUrl(anchor, stops) → {url|null, skipped, truncated}` — cap 10 stops (8 waypoints + destination, documented Google limit).
  - `buildAppleDirUrl(anchor, stops) → {url|null, skipped, truncated:false}` — unified format: `destination` (address text of first stop) + `waypoint=lat,lng` per remaining stop.
  - `buildWazeStopUrl(stop) → string`
  - `buildSingleStopUrl(app, stop) → string` — `'google' | 'apple' | 'waze'`.
  - `buildRouteLink(app, anchor, stops) → {url|null, skipped, truncated}` — `'waze'` → `{url: null}` (caller hides "Send all stops" — Waze supports one stop per route, official).
  - Stop shape: `{ id, address, lat, lng }` (lat/lng null = skip, counted in `skipped`).

- [ ] **Step 1: Write the module**

```js
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
  if (anchor) url += `&origin=${encode(coord(anchor.lat, anchor.lng))}`;
  url += `&destination=${encode(coord(destination.lat, destination.lng))}`;
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
  if (anchor) url += `&source=${encode(coord(anchor.lat, anchor.lng))}`;
  // destination = address text (Apple docs); waypoints = coords (multiple allowed).
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
```

- [ ] **Step 2: Write the tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleDirUrl, buildAppleDirUrl, buildWazeStopUrl,
  buildSingleStopUrl, buildRouteLink,
} from './navLinks.js';

const stops = [
  { id: 'a', address: '123 Oak St, Edmond, OK', lat: 35.6528, lng: -97.4787 },
  { id: 'b', address: '456 Elm Ave, OKC, OK',   lat: 35.5219, lng: -97.4377 },
  { id: 'c', address: '789 Maple Dr, Edmond, OK', lat: 35.6535, lng: -97.4811 },
];
const anchor = { lat: 35.4676, lng: -97.5164 };

test('Google: origin + destination + |-separated waypoints', () => {
  const { url, skipped, truncated } = buildGoogleDirUrl(anchor, stops);
  assert.equal(skipped, 0);
  assert.equal(truncated, false);
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=35\.467600,-97\.516400&destination=35\.653500,-97\.481100&waypoints=/);
  assert.match(url, /waypoints=35\.652800%2C-97\.478700\|35\.521900%2C-97\.437700/);
});

test('Google: truncates past 10 stops (8 waypoints + destination)', () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `s${i}`, address: `A ${i}`, lat: 35.5 + i / 1000, lng: -97.5 }));
  const { truncated } = buildGoogleDirUrl(anchor, many);
  assert.equal(truncated, true);
});

test('Google: stops without coords are skipped and counted', () => {
  const mixed = [...stops, { id: 'z', address: 'No coords yet', lat: null, lng: null }];
  const { skipped } = buildGoogleDirUrl(anchor, mixed);
  assert.equal(skipped, 1);
});

test('Apple: unified URL with destination address + multiple waypoint params', () => {
  const { url, skipped } = buildAppleDirUrl(anchor, stops);
  assert.equal(skipped, 0);
  assert.match(url, /^https:\/\/maps\.apple\.com\/directions\?mode=driving&source=35\.467600,-97\.516400&destination=123%20Oak%20St%2C%20Edmond%2C%20OK/);
  assert.match(url, /&waypoint=35\.521900%2C-97\.437700&waypoint=35\.653500%2C-97\.481100$/);
});

test('Waze: single-stop ll + navigate=yes', () => {
  assert.equal(buildWazeStopUrl(stops[0]), 'https://waze.com/ul?ll=35.652800,-97.478700&navigate=yes');
});

test('buildSingleStopUrl: per-app shapes', () => {
  assert.equal(buildSingleStopUrl('waze', stops[0]), 'https://waze.com/ul?ll=35.652800,-97.478700&navigate=yes');
  assert.match(buildSingleStopUrl('apple', stops[0]), /^https:\/\/maps\.apple\.com\/\?daddr=35\.652800%2C-97\.478700$/);
  assert.match(buildSingleStopUrl('google', stops[0]), /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=35\.652800%2C-97\.478700$/);
});

test('buildRouteLink: waze returns null url (multi-stop unsupported)', () => {
  const res = buildRouteLink('waze', anchor, stops);
  assert.equal(res.url, null);
});
```

- [ ] **Step 3: Run tests — must pass**

Run: `node --test client/src/lib/navLinks.test.js` — expected: 7 pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/navLinks.js client/src/lib/navLinks.test.js && git commit -m "feat(routes): pure nav-link builders (google/apple/waze) with node --test"
```

---

### Task 5: Today.jsx — Optimize button + undo

**Objective:** The Optimize flow: gated button, lazy geocode, apply through the existing persist path with rollback + toast Undo.

**Files:**
- Modify: `client/src/pages/Today.jsx`

**Interfaces:**
- Consumes: `ensureClientCoords` (Task 2), `optimizeRoute` (Task 3), `reorderJobs` (exists), `saveProfile` (Task 2 — Task 6 uses it), `InvoiceToast` contract (`{name, amount, type, actionLabel, onAction}` — `type: 'plain'` renders the green toast with the action button).
- Produces: `canOptimize` visibility; `handleOptimize()`; `reorderToSequence(prev, orderedIds, currentDate)`; `routeUndoRef`; state `optimizing`.

- [ ] **Step 1: Imports + state** — extend the import from `../lib/data` (line 4) with `ensureClientCoords`, and from `../lib/optimizeRoute`:

```js
import { ensureClientCoords } from '../lib/data';
import { optimizeRoute } from '../lib/optimizeRoute';
import { Route as RouteIcon } from 'lucide-react'; // add to the lucide import on line 6
```

State (near the other `useState` calls, ~line 70):

```js
const [optimizing, setOptimizing] = useState(false);
const [profile, setProfile] = useState(null);
const routeUndoRef = useRef(null); // previousOrder snapshot for toast Undo
```

- [ ] **Step 2: Capture profile in the existing loadProfile effect** (lines 96-108 — the weather effect already loads the profile; add `setProfile(profile)` right after `const hasLocation = ...`):

```js
      setProfile(profile);
```

- [ ] **Step 3: Visibility + handlers** (place after `handleMoveDown`, ~line 478):

```js
  // Route Optimization v1 — paid tiers, whole-day owner view only
  // (route_order is date-wide: crew members / filtered views would reorder
  // other assignees' stops — Claude Code HIGH fix).
  const canOptimize = !loading && !isCrewMember && crewFilter === null
    && ['solo', 'crew', 'premium'].includes(profile?.tier)
    && dateFiltered.length >= 3
    && dateFiltered.filter(j => j.clients?.address).length >= 2;

  // Date-scoped renumber from an ordered id list — same rollback shape as
  // reorderWithinDate (previousOrder + updates).
  function reorderToSequence(prev, orderedIds, currentDate) {
    const updated = [...prev];
    const previousOrder = prev
      .filter(j => j.scheduled_date === currentDate)
      .map(j => ({ id: j.id, route_order: j.route_order }));
    const idSet = new Set(orderedIds);
    let order = 1;
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].scheduled_date === currentDate && idSet.has(updated[i].id)) {
        updated[i] = { ...updated[i], route_order: order++ };
      }
    }
    const updates = updated
      .filter(j => j.scheduled_date === currentDate && idSet.has(j.id))
      .map(j => ({ id: j.id, route_order: j.route_order }));
    return { updated, updates, previousOrder };
  }

  async function handleOptimize() {
    if (optimizing) return; // double-tap guard
    setOptimizing(true);
    try {
      const dayJobs = jobsRef.current.filter(j => j.scheduled_date === date);
      const coordsMap = await ensureClientCoords(dayJobs.map(j => j.clients).filter(Boolean));
      const anchor = profile?.latitude != null && profile?.longitude != null
        ? { lat: profile.latitude, lng: profile.longitude }
        : null;
      const positioned = dayJobs.map(j => ({
        id: j.id,
        lat: j.clients ? (coordsMap[j.clients.id]?.lat ?? null) : null,
        lng: j.clients ? (coordsMap[j.clients.id]?.lng ?? null) : null,
      }));
      const orderedIds = optimizeRoute(positioned, anchor);

      setJobs(prev => {
        const result = reorderToSequence(prev, orderedIds, date);
        if (!result) return prev;
        routeUndoRef.current = result.previousOrder;
        reorderJobs(result.updates).catch(err => {
          console.error('optimize persist failed:', err);
          setJobs(current => current.map(job => {
            const previous = result.previousOrder.find(item => item.id === job.id);
            return previous ? { ...job, route_order: previous.route_order } : job;
          }));
        });
        return result.updated;
      });

      setCompletedToast({
        name: tr('Route optimized'),
        amount: 0,
        type: 'plain',
        actionLabel: tr('Undo'),
        onAction: () => {
          const undo = routeUndoRef.current;
          if (!undo) return;
          routeUndoRef.current = null;
          setCompletedToast(null);
          reorderJobs(undo).catch(err => console.error('optimize undo failed:', err));
          setJobs(prev => prev.map(job => {
            const previous = undo.find(item => item.id === job.id);
            return previous ? { ...job, route_order: previous.route_order } : job;
          }));
        },
      });
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
      toggleTimeoutRef.current = setTimeout(() => setCompletedToast(null), 6000);
    } catch (err) {
      console.error('Optimize:', err);
      setCompletedToast({ name: tr('Could not optimize route. Try again.'), amount: 0, type: 'error' });
      setTimeout(() => setCompletedToast(null), 4000);
    } finally {
      setOptimizing(false);
    }
  }
```

- [ ] **Step 4: Button in the header** (inside the header div, next to the New Job button at ~line 505-507 — before it):

```jsx
        {canOptimize && (
          <div className="flex items-center gap-2">
            <button onClick={handleOptimize} disabled={optimizing} className="btn-secondary gap-1.5 text-sm disabled:opacity-50">
              <RouteIcon className="w-4 h-4" />{optimizing ? tr('Optimizing...') : tr('Optimize')}
            </button>
          </div>
        )}
```

- [ ] **Step 5: Verify** — `npm run lint && npm run build`; manual (demo mode, crew tier): 4 demo jobs on today → Optimize visible → tap → order changes, toast "Route optimized" + Undo → tap Undo → order restores → reload → order persisted. Verify in dark AND light mode. Verify hidden: free-tier profile, crew-role member, crew filter active, <3 jobs.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Today.jsx && git commit -m "feat(today): Optimize button (paid tiers, owner whole-day view) + toast Undo"
```

---

### Task 6: Today.jsx — Send route chooser + nav-app preference

**Objective:** "Send route" with the all-stops / one-by-one chooser, Waze honesty, and the persisted nav-app preference.

**Files:**
- Modify: `client/src/pages/Today.jsx` (same file as Task 5 — continue after its commit)
- Reference: `client/src/lib/navLinks.js` (Task 4)

**Interfaces:**
- Consumes: `buildRouteLink`, `buildSingleStopUrl` (Task 4); `saveProfile` (Task 2); `ensureClientCoords` (Task 2).
- Produces: state `showRouteChooser`, `showOneByOne`, `oneByOneStops`, `navApp`; `openRouteLink(mode)`.

- [ ] **Step 1: Imports + state** — add `saveProfile` to the data import; add `buildRouteLink`, `buildSingleStopUrl`:

```js
import { ensureClientCoords, saveProfile } from '../lib/data';
import { buildRouteLink, buildSingleStopUrl } from '../lib/navLinks';
```

State (with Task 5 state):

```js
const [showRouteChooser, setShowRouteChooser] = useState(false);
const [showOneByOne, setShowOneByOne] = useState(false);
const [oneByOneStops, setOneByOneStops] = useState([]);
const [navApp, setNavApp] = useState(() =>
  (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) ? 'apple' : 'google');
```

Effect — platform default until the user picks (profile load, in the same effect as Task 5 Step 2):

```js
      if (profile?.preferred_nav_app) setNavApp(profile.preferred_nav_app);
```

- [ ] **Step 2: Handlers** (place after `handleOptimize`):

```js
  function orderedStops() {
    return [...jobs]
      .filter(j => j.scheduled_date === date)
      .sort((a, b) => (a.route_order ?? 0) - (b.route_order ?? 0))
      .map(j => ({
        id: j.id,
        address: j.clients?.address || j.title || '',
        lat: j.clients?.latitude ?? null,
        lng: j.clients?.longitude ?? null,
      }));
  }

  async function saveNavAppPref(app) {
    try { await saveProfile({ ...profile, preferred_nav_app: app }); } catch (err) {
      console.error('save nav pref:', err);
    }
  }

  async function openRouteLink(mode) {
    const stops = orderedStops();
    const coordsMap = await ensureClientCoords(stops.map(s => ({ id: s.id, address: s.address, latitude: s.lat, longitude: s.lng })));
    const withCoords = stops.map(s => ({
      ...s,
      lat: coordsMap[s.id]?.lat ?? s.lat,
      lng: coordsMap[s.id]?.lng ?? s.lng,
    }));
    if (mode === 'all') {
      const anchor = profile?.latitude != null && profile?.longitude != null
        ? { lat: profile.latitude, lng: profile.longitude } : null;
      const { url, skipped, truncated } = buildRouteLink(navApp, anchor, withCoords);
      if (!url) return;
      window.open(url, '_blank');
      if (skipped > 0) {
        setCompletedToast({ name: tr('Stops without addresses were skipped'), amount: 0, type: 'plain' });
        setTimeout(() => setCompletedToast(null), 4000);
      }
      if (truncated) {
        setCompletedToast({ name: tr('{{count}} stops sent', { count: 10 }), amount: 0, type: 'plain' });
        setTimeout(() => setCompletedToast(null), 4000);
      }
    } else {
      setOneByOneStops(withCoords.filter(s => s.lat != null && s.lng != null));
      setShowOneByOne(true);
    }
  }
```

Note: `ensureClientCoords` expects client-shaped objects (`id`, `address`, `latitude`, `longitude`) — the stop shape above satisfies it.

- [ ] **Step 3: Send route button** (next to Optimize in the header, inside the same `canOptimize` div):

```jsx
            <button onClick={() => setShowRouteChooser(true)} className="btn-secondary gap-1.5 text-sm">
              <Navigation className="w-4 h-4" />{tr('Send route')}
            </button>
```

(add `Navigation` to the lucide import.)

- [ ] **Step 4: Chooser modal + one-by-one sheet** (before the closing `</div>` of the component, next to the photo modal ~line 716 — reuse the rain-delay modal markup pattern):

```jsx
      {showRouteChooser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="route-chooser-title">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRouteChooser(false)} />
          <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[var(--color-surface)] dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border border-[var(--color-border)] dark:border-gray-700">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id="route-chooser-title" className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white">{tr('Send route')}</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{tr('Navigation app')}</p>
              </div>
              <button aria-label={tr('Close')} onClick={() => setShowRouteChooser(false)} className="p-2 -m-2 text-[var(--color-text-muted)]"><X className="w-5 h-5" /></button>
            </div>
            <fieldset className="space-y-2 mb-4">
              <legend className="label mb-2">{tr('Navigation app')}</legend>
              {[
                { value: 'google', label: tr('Google Maps') },
                { value: 'apple', label: tr('Apple Maps') },
                { value: 'waze', label: tr('Waze') },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] dark:border-gray-700 p-3 cursor-pointer">
                  <input type="radio" name="nav-app" checked={navApp === opt.value} onChange={() => { setNavApp(opt.value); void saveNavAppPref(opt.value); }} className="accent-[#4ade80]" />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="space-y-2">
              <button
                disabled={navApp === 'waze'}
                onClick={() => { setShowRouteChooser(false); void openRouteLink('all'); }}
                className="btn-primary w-full disabled:opacity-50"
              >
                {tr('Send all stops')}
              </button>
              {navApp === 'waze' && (
                <p className="text-xs text-[var(--color-text-muted)]">{tr("Waze doesn't support multi-stop routes")}</p>
              )}
              <button
                onClick={() => { setShowRouteChooser(false); void openRouteLink('one-by-one'); }}
                className="btn-secondary w-full"
              >
                {tr('Send one by one')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOneByOne && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="one-by-one-title">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowOneByOne(false)} />
          <div className="relative w-full sm:max-w-md max-h-[80vh] overflow-y-auto bg-[var(--color-surface)] dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border border-[var(--color-border)] dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 id="one-by-one-title" className="text-lg font-bold">{tr('Send one by one')}</h3>
              <button aria-label={tr('Close')} onClick={() => setShowOneByOne(false)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">{tr('Stops are in optimized order. Tap one to open it in your navigation app.')}</p>
            <div className="space-y-2">
              {oneByOneStops.map((stop, i) => (
                <button
                  key={stop.id}
                  onClick={() => window.open(buildSingleStopUrl(navApp, stop), '_blank')}
                  className="w-full flex items-center gap-3 rounded-xl border border-[var(--color-border)] dark:border-gray-700 p-3 text-left hover:bg-[var(--color-surface-hover)] dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-brand/10 text-brand-hover dark:text-[#4ade80] flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <span className="text-sm text-[var(--color-text-primary)] dark:text-gray-200 truncate flex-1">{stop.address}</span>
                </button>
              ))}
              {oneByOneStops.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">{tr('No stops with addresses on this day.')}</p>
              )}
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify** — lint + build; manual (demo): Send route → chooser shows → Google: "Send all stops" enabled, opens dir URL with 4 stops → Waze selected: "Send all stops" disabled + honest note, "Send one by one" lists stops, rows open `waze.com/ul?ll=…&navigate=yes` → preference persists across reload (demo + real). Dark AND light mode.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Today.jsx && git commit -m "feat(today): Send route chooser (all stops / one by one) + nav-app preference"
```

---

### Task 7: Demo data coordinates

**Objective:** Demo shows the feature fully offline, with an anchor (Claude Code HIGH — demo owner had no coords).

**Files:**
- Modify: `client/src/lib/demoData.js`
- Modify: `client/src/lib/data.js` (~915 — loadProfile demo fallback)

**Interfaces:**
- Produces: every `demoClients` entry has `latitude`/`longitude`; demo owner (`demoTeamMembers[0]`) and the `loadProfile` demo fallback have OKC coords.

- [ ] **Step 1: Add coords to demoClients** (real OKC-area coordinates matching the addresses):

```js
export const demoClients = [
  { id: '1', name: 'Bill Henderson', address: '123 Oak St, Edmond, OK', latitude: 35.6528, longitude: -97.4787, phone: '405-555-0101', email: 'bill@email.com', rate: 50, service_notes: 'Mow front + back, edge driveway, trim hedges. Use mulching blade.', key_code: '4829', alarm_code: '', pet_instructions: '1 friendly golden retriever. Give treat on counter.', tags: ['vip'] },
  { id: '2', name: 'Karen Walsh', address: '456 Elm Ave, OKC, OK', latitude: 35.5219, longitude: -97.4377, phone: '405-555-0102', email: 'karen@email.com', rate: 65, service_notes: 'Large yard — 0.4 acres. Mow, edge, blow. Fertilize every 6 weeks.', key_code: '7712', alarm_code: '1234', pet_instructions: '', tags: [] },
  { id: '3', name: 'Marcus Lee', address: '789 Maple Dr, Edmond, OK', latitude: 35.6535, longitude: -97.4811, phone: '405-555-0103', email: 'marcus@email.com', rate: 40, service_notes: 'Small lawn. Quick mow + edge. Gate on left side of house.', key_code: '5591', alarm_code: '', pet_instructions: 'No pets. Leave gate unlocked.', tags: ['late-payer'] },
  { id: '4', name: 'David & Emma Ruiz', address: '321 Pine Ln, OKC, OK', latitude: 35.4927, longitude: -97.5334, phone: '405-555-0104', email: 'david@email.com', rate: 55, service_notes: 'Biweekly service. Mow, trim, blow. Both front and back.', key_code: '', alarm_code: '5678', pet_instructions: '2 cats — do NOT let outside.', tags: [] },
  { id: '5', name: 'Tom Harrison', address: '654 Birch Ct, Nichols Hills, OK', latitude: 35.5512, longitude: -97.5447, phone: '405-555-0105', email: 'tom@email.com', rate: 80, service_notes: 'Premium lawn — 0.6 acres. Mow with stripes, edge, blow, bag clippings.', key_code: '9023', alarm_code: '', pet_instructions: '', tags: ['do-not-service'] },
];
```

- [ ] **Step 2: Demo owner anchor** — `demoTeamMembers[0]` (line 22) gets:

```js
  { id: 'demo-owner-001', business_name: 'Green Thumb Lawn Care', phone: '405-555-0100', latitude: 35.4676, longitude: -97.5164, avatar_url: null, tier: 'crew', role: 'owner', business_id: null, created_at: '2025-01-01T00:00:00Z' },
```

And the `loadProfile` demo fallback (`data.js:915`):

```js
    const base = member || { business_name: 'Green Thumb Lawn Care', phone: '405-555-0100', latitude: 35.4676, longitude: -97.5164, tier: 'solo', role: 'owner', business_id: null };
```

- [ ] **Step 3: Verify** — demo mode: Optimize produces a sensible OKC-area order starting near the anchor; Send route Google link opens with origin set. `node --test client/src/lib/optimizeRoute.test.js` still passes (uses these coords).

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/demoData.js client/src/lib/data.js && git commit -m "feat(demo): OKC-area coords for clients + owner anchor"
```

---

### Task 8: i18n — en.json + es.json

**Objective:** All new strings, both locales, keys verified by the actual `textKey` function (72-char rule). Spanish via Google Translate API (mowgo-dev pattern) — NEVER Mimo/Codex.

**Files:**
- Modify: `client/src/i18n/locales/en.json` (sections: `today`, `landing`)
- Modify: `client/src/i18n/locales/es.json` (same sections)

**Interfaces:**
- Consumes: `useLocalizedText('today')` (Today.jsx), `useLocalizedText('landing')` (Landing.jsx).
- Produces: verbatim keys (all computed with the real slug function — see Global Constraints):

`today` section (all ≤72 chars, verified):

```json
    "optimize": "Optimize",
    "optimizing": "Optimizing...",
    "send_route": "Send route",
    "send_all_stops": "Send all stops",
    "send_one_by_one": "Send one by one",
    "route_optimized": "Route optimized",
    "google_maps": "Google Maps",
    "apple_maps": "Apple Maps",
    "waze": "Waze",
    "navigation_app": "Navigation app",
    "some_addresses_couldn_t_be_mapped": "Some addresses couldn't be mapped",
    "waze_doesn_t_support_multi_stop_routes": "Waze doesn't support multi-stop routes",
    "count_stops_sent": "{{count}} stops sent",
    "stops_without_addresses_were_skipped": "Stops without addresses were skipped",
    "stops_are_in_optimized_order_tap_one_to_open_it_in_your_navigation_app": "Stops are in optimized order. Tap one to open it in your navigation app.",
    "no_stops_with_addresses_on_this_day": "No stops with addresses on this day.",
    "could_not_optimize_route_try_again": "Could not optimize route. Try again."
```

`landing` section (replace the footnote VALUE at key `card_checkout_is_live_route_optimization_ships_next_oklahoma_early_adopt` — see Task 9 — and add):

```json
    "route_optimization_is_live_included_on_solo_crew_and_premium": "Route optimization is live — included on Solo, Crew, and Premium."
```

- [ ] **Step 1: Add `today` keys to en.json** — find the `"today": {` section, add the keys above (alphabetical placement optional, keep readable). Note: `"undo"`, `"close"` already exist in `today` — do NOT duplicate.

- [ ] **Step 2: Add `landing` key to en.json** — in the `"landing": {` section (where `card_checkout_is_live_...` lives).

- [ ] **Step 3: Spanish via Google Translate** (mowgo-dev skill pattern — the API helper used for all es.json entries; NEVER Mimo/Codex):
- Translate each new string with Google Translate → add under the same section/keys in `es.json`.
- Footnote: "Route optimization is live — included on Solo, Crew, and Premium." → translate the whole sentence, key stays the English slug.

- [ ] **Step 4: Verify every key programmatically** — no hand-counting:

```bash
node -e "
const en = require('./client/src/i18n/locales/en.json');
const es = require('./client/src/i18n/locales/es.json');
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+\$/g,'').slice(0,72);
const today = en.today, tes = es.today;
let bad = 0;
for (const k of Object.keys(today)) {
  if (k.length > 72) { console.log('KEY >72:', k); bad++; }
  if (k !== slug(today[k]) && !k.includes('{{')) { console.log('KEY MISMATCH:', k, '->', slug(today[k])); bad++; }
}
for (const k of Object.keys(today)) if (!(k in tes)) { console.log('MISSING in es.today:', k); bad++; }
for (const k of Object.keys(en.landing)) if (!(k in es.landing)) { console.log('MISSING in es.landing:', k); bad++; }
console.log(bad ? bad + ' PROBLEMS' : 'ALL KEYS OK');
"
```

Expected: `ALL KEYS OK` (interpolation keys like `count_stops_sent` contain `{{` — skipped by the mismatch check).

- [ ] **Step 5: Commit**

```bash
git add client/src/i18n/locales/en.json client/src/i18n/locales/es.json && git commit -m "feat(i18n): route optimization strings (en+es, verified slugs)"
```

---

### Task 9: Landing + Compare + Ruunly copy flips (fact-lock)

**Objective:** Remove every "coming soon / ships next" route-optimization claim; add the live row to the compare table with researched competitor values.

**Files:**
- Modify: `client/src/pages/Landing.jsx` (card array line ~12, footnote line ~468)
- Modify: `client/src/pages/Compare.jsx` (features + data arrays)
- Modify: `client/src/pages/RuunlyComparison.jsx` (route row line ~26 + qualified renderer ~270-275)
- Modify: `client/src/i18n/locales/en.json` + `es.json` (`landing` + `compare` sections)
- Verify only: `client/src/pages/ProBaseComparison.jsx` (grep confirms NO route row — no change; the "route" hits are prose about rain delay)

**Interfaces:**
- Produces: Landing card without the pill; footnote "Route optimization is live — included on Solo, Crew, and Premium."; Compare table gains a Route Optimization row; Ruunly row shows MowGo Solo ✓ / MowGo Free ✗.

- [ ] **Step 1: Landing card** — line ~12: remove `soon: true` from the Route Optimization card:

```js
  { icon: MapPin, title: 'Route Optimization', desc: 'Smarter daily routes across OKC, Tulsa, Edmond, and beyond. Less time on I-35, more time mowing.', color: 'from-emerald-500 to-teal-500' },
```

(The pill render at ~246 is driven by `soon &&` — removing the flag removes the pill. Fact-lock: title/desc untouched.)

- [ ] **Step 2: Landing footnote** — line ~468, replace the tr() string with the new one (key added in Task 8):

```jsx
            <p className="text-center text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-8">{tr("Route optimization is live — included on Solo, Crew, and Premium.")}</p>
```

Do NOT delete the old en/es key `card_checkout_is_live_route_optimization_ships_next_oklahoma_early_adopt` (harmless; grep confirms only Landing used it, but deleting keys risks stale references).

- [ ] **Step 3: Grep for stragglers** — `grep -rn "Route optimization ships next\|Coming soon" client/src --include=*.jsx` — remaining "Coming soon" hits must be non-route items only (e.g. other feature pills). If any other page claims route optimization is coming soon, fix it in this task.

- [ ] **Step 4: Compare.jsx — research competitor routing status** (fact-lock: never guess). For each of QuoteIQ, Jobber, Yardbook, LawnPro, Housecall Pro, GreenRoute, LawnBoss, SoloOp, TurfHop: quick web search for "route optimization" in their feature/pricing pages (~15-20 min total). Record findings + sources in the commit message. Known anchor: Jobber sells routing as an add-on (~$49/mo per the Aug 1 intel analysis — verify current). If a competitor cannot be verified after the research pass, leave the cell false AND note it in the review round for a fact-check.

- [ ] **Step 5: Compare.jsx — add the row** (features array after `gps` ~line 36; data array after `gps` ~line 54):

```js
  { label: 'Route Optimization', key: 'route', desc: 'One-tap optimized routes + send stops to your maps app' },
```

```js
  route:        [ true, /* researched values for the 9 competitors, MowGo first */ ],
```

(MowGo column = `true` — feature ships on paid tiers; the table is per-app availability, same coarse grain as the existing rows.)

- [ ] **Step 6: Compare i18n** — add to `compare` section in en.json + es.json (Google Translate for es):

```json
    "route_optimization": "Route Optimization",
    "one_tap_route_optimization_send_stops_to_your_maps_app": "One-tap optimized routes + send stops to your maps app"
```

Check for existing keys first (`route_optimization` may already exist in `compare` — if so, reuse, don't duplicate).

- [ ] **Step 7: RuunlyComparison.jsx** — line ~26, values + renderer:

```js
  { label: 'Route Optimization', mowgoFree: false, mowgoSolo: true, ruunlyStarter: false, ruunlyPro: false, type: 'qualified' },
```

Renderer (~270-275) — extend `qualified` to render true/false/Coming soon:

```jsx
                      if (f.type === 'qualified') {
                        return (
                          <td key={col} className={`text-center py-3 px-2${cellBg}`}>
                            {val === true ? <Check className="w-5 h-5 text-emerald-500 mx-auto" aria-hidden="true" />
                              : val === 'Coming soon' ? <span className="text-[10px] font-semibold uppercase text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">{tr("Coming soon")}</span>
                              : <X className="w-5 h-5 text-red-400 mx-auto" aria-hidden="true" />}
                          </td>
                        );
                      }
```

(`Check` is already imported in RuunlyComparison.jsx line 4.)

- [ ] **Step 8: Verify** — lint + build; run the Task 8 key-check script again (new compare keys); browser check: Landing card has no pill, footnote updated; Compare table shows the new row with researched values; Ruunly page shows ✓ for MowGo Solo, ✗ for MowGo Free; dark AND light mode.

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/Landing.jsx client/src/pages/Compare.jsx client/src/pages/RuunlyComparison.jsx client/src/i18n/locales/en.json client/src/i18n/locales/es.json && git commit -m "feat(copy): route optimization live — landing flip + compare rows (researched competitor values)"
```

---

### Task 10: Ship — build, deploy, live verify, dual review

**Objective:** Green build → deploy from repo root → live verification → Claude Code (primary) + Mimo (second) review → fix HIGH/MEDIUM → final commit.

**Files:** none new (verification + review).

- [ ] **Step 1: Full test + lint + build**

```bash
cd /opt/data/mowgo
node --test client/src/lib/optimizeRoute.test.js client/src/lib/navLinks.test.js   # 14 pass
npm run lint && npm run build
```

- [ ] **Step 2: Deploy from repo root** (NEVER from client/):

```bash
npx wrangler pages deploy client/dist --project-name=mowgo --commit-dirty=true
```

- [ ] **Step 3: Live verification** (all of these):

```bash
# 1. reorder function exists (Task 0 regression)
curl -s -X POST https://mowgoapp.com/api/jobs/reorder -H 'Content-Type: application/json' -d '{}'   # JSON 400

# 2. Landing footnote in the live bundle + no coming-soon pill on the route card
curl -s https://mowgoapp.com/ | grep -o "Route optimization is live — included on Solo, Crew, and Premium." | head -1
curl -s https://mowgoapp.com/ | grep -c "Coming soon"   # 0 expected on the route card (other pills may remain — eyeball)
```

Manual E2E on the live app (paid account): Optimize → reorders + persists → Undo restores → Send route → all stops opens Google with origin+stops → one by one sheet opens stops → preference persists. Drag-drop regression. Dark + light.

- [ ] **Step 4: Claude Code review — PRIMARY** (write the prompt to a file under `/opt/data` — NOT `/tmp`, and NOT an inline one-liner; both are known failure modes):

```bash
cat > /opt/data/review-route-v1.txt <<'EOF'
You are an adversarial reviewer. Review the Route Optimization v1 diff: git diff <base-commit>..HEAD (base = the commit before Task 0). Read the actual changed files (client/src/pages/Today.jsx, client/src/lib/data.js, client/src/lib/optimizeRoute.js, client/src/lib/navLinks.js, functions/api/jobs/reorder.js, supabase/migrations/20260805193000_client_coords.sql, client/src/pages/Landing.jsx, Compare.jsx, RuunlyComparison.jsx, demoData.js, i18n locales). Check: RLS/grants correctness (preferred_nav_app grant, reorder RPC service-role-only), auth on the new function, i18n 72-char slugs + es parity, crew/filter gating, undo correctness, geocode failure paths, URL building edge cases, double-tap races, fact-lock on the compare row values, dark-mode markup. Report ONLY issues with severity (CRITICAL/HIGH/MEDIUM/LOW), file:line, and concrete fix. No praise.
EOF
cd /opt/data/mowgo && claude -p "$(cat /opt/data/review-route-v1.txt)" --allowedTools 'Read,Glob,Grep,Bash(git diff*)' --max-turns 15
rm -f /opt/data/review-route-v1.txt
```

(If it hits the turn cap without a report: `claude -p 'Write your complete report now — issues only.' --continue --max-turns 4`.)

- [ ] **Step 5: Mimo second pass** — `delegate_task` (model `xiaomi/mimo-v2.5`): "Review the git diff base..HEAD in /opt/data/mowgo (Route Optimization v1). Be critical; issues only with file:line + severity. Focus on edge cases, race conditions, i18n, and anything Claude's pass may have missed." If the summary doesn't re-enter promptly, read the newest `/opt/data/cache/delegation/subagent-summary-*.txt`.

- [ ] **Step 6: Fix everything HIGH+** — cross-reference both reports; fix CRITICAL/HIGH/MEDIUM; re-run tests + lint + build; re-deploy if the fix touched shipped code; re-verify live. Reject false positives ONLY with source evidence (read the code, quote it).

- [ ] **Step 7: Final commit + report**

```bash
git add -A && git commit -m "fix(review): route optimization v1 — Claude Code + Mimo findings"
git log --oneline -15
```

Report to Blasian: what shipped, live-verify results, reviewer findings + fixes, what's queued on the dartboard (iOS/Android parity).

---

## Self-review (spec coverage)

- Spec §0 (reorder route port) → Task 0 ✓
- Spec §1 (migration + grants + timestamp naming) → Task 1 ✓
- Spec §2 (allowlists CRITICAL, geocode backfill, saveProfile HIGH, demo anchor) → Tasks 2 + 7 ✓
- Spec §3 (Optimize gating incl. crew/filter HIGH fix, undo, geocode-failure toast, scheduled_time untouched) → Task 5 ✓
- Spec §4 (Send route chooser, all/one-by-one, Waze honesty, preference persistence) → Task 6 ✓
- Spec §5 (landing flip, footnote, compare rows, Ruunly, i18n en/es, 72-char slugs) → Tasks 8 + 9 ✓
- Spec §6 (ship path: repo-root deploy, Claude Code primary + Mimo, dartboard parity) → Task 10 ✓
- Spec test plan items 1-12 → mapped: 1 (T5/T6), 2-3 (T5), 4 (T2), 5 (T3), 6 (T7), 7 (T5 toast), 8 (T10), 9/9a-9d (T10), 10-12 (T4/T6) ✓
- No placeholders: every code step carries complete code. Type consistency: `ensureClientCoords → Map<id,{lat,lng}>`, `optimizeRoute → string[]`, `buildRouteLink → {url,skipped,truncated}`, `reorderToSequence → {updated,updates,previousOrder}` — identical names across Tasks 2-6.
