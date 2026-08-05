# Route Optimization v1 — Scope (Make the "Coming Soon" Promise Real)

**Status:** 🆕 SCOPED — Aug 5, 2026
**Why:** The landing page already promises it ("Route Optimization — Coming soon" card + "Card checkout is live. Route optimization ships next — Oklahoma early adopters get new features at no price increase."). A promised feature that never ships is the strongest negative WOM available. It's also the #1 competitive gap flagged in the Aug 1 analysis ("#1 feature request from crews") — Jobber sells routing as a ~$49/mo add-on; MowGo's counter-positioning is "routing included." Hormozi lens (applied Aug 5): not the rate limiter (activation is), but the promise is public, the infra exists (route_order + reorderJobs + Open-Meteo already in stack), and it's a daily-habit retention hook. Decision: ONE small honest v1, $0 APIs, paid tiers only. The mistake would be building Jobber-level turn-by-turn (paid map APIs, nobody in the 1-3 person ICP asks for it).
**Decision (Aug 5 poll):** Send-route targets the user's preferred navigation app — Google, Apple Maps, or Waze — not Google-only. Sourced: Apple Maps supports multi-stop via unified Maps URLs (Apple docs: multiple `waypoint` params); Waze does not support multi-stop deep links (one stop per route, official); Google caps ~10 stops (8 waypoints + destination without an API key). Waze users get next-stop + per-stop tap.

**Owner:** Dev (Mimo-assisted — Codex usage out until Aug 8, then restore Codex). **Priority:** next sprint (card is live on the page).

## Goal (v1)

1. **Optimize button on Today** — one tap reorders the day's jobs by drive distance (nearest-neighbor + light 2-opt on haversine, pure client-side). Zero new APIs, zero keys, works offline.
2. **Paid tiers only** (Solo/Crew/Premium) — free tier keeps rain delay as its hook; routing is the upgrade lever. No lock UI on free; the landing/compare pages sell it.
3. **Undo** — reuses the existing drag-drop rollback path.
4. **Flip the landing card** — "Coming soon" → live; the "ships next" footnote line updates. Fact-lock: no new stats, no price changes.
5. **Send route to preferred nav app** — one tap opens the optimized day as a multi-stop route in the user's preferred app (Google Maps, Apple Maps, or Waze), from a small in-app preference. Still $0: pure deep links, no map APIs.

## Current implementation (read first)

- Jobs have `route_order` (per-date int, renumbered on reorder). `client/src/pages/Today.jsx` has drag-and-drop reordering: `reorderWithinDate()` (re-numbers route_order for the date) + `persistReorder()` (batch `reorderJobs()` from `client/src/lib/data.js` ~line 1067, with rollback on failure). **The persistence layer is done — v1 only adds the algorithm + button.**
- Jobs join `clients!left(*)`; clients have a single `address` text field. **No lat/lng anywhere on clients/jobs** — needs migration + geocoding.
- Profile already stores `latitude`/`longitude` (Business Location feature, migration 013, Open-Meteo geocoded) — the anchor for the route start.
- `client/src/pages/RouteAudit.jsx` + `/api/route-audit` — free route audit lead magnet (already live; NOT touched by v1).
- Landing: `client/src/pages/Landing.jsx` — "Route Optimization / Coming soon" card + pricing footnote "Card checkout is live. Route optimization ships next…" (i18n keys in en.json/es.json, 72-char slug rule).
- Tier gating pattern: `profile.tier === 'crew'` gates Crew features (mowgo skill).

## Changes

### 1. Migration `014_client_coords.sql`
- `ALTER TABLE clients ADD COLUMN latitude double precision, ADD COLUMN longitude double precision;`
- `ALTER TABLE profiles ADD COLUMN preferred_nav_app text DEFAULT NULL;` — 'google' | 'apple' | 'waze'; NULL = platform default (iOS → apple, else google). Mirror 013's grant pattern for the new column.
- `GRANT UPDATE (latitude, longitude) ON clients TO ...` — mirror the 013 pattern (profile UPDATE was revoked in 002; verify clients' existing grants before writing and include the column grant).
- Apply via the Supabase CLI access token (sbp_… has full SQL scope — `POST /v1/projects/<ref>/database/query`), not the Management API key (403 on SQL). Verify after: `GET /rest/v1/clients?select=id,latitude,longitude&limit=1` with service key → 200.

### 2. Data layer (`client/src/lib/data.js`)
- `geocodeAddress(address)` — Open-Meteo geocoding API (`https://geocoding-api.open-meteo.com/v1/search?name=<q>&count=1&language=en&format=json`). Free, no key. Returns `{latitude, longitude}` or null. Graceful failure (null, no throw).
- `updateClientCoords(clientId, lat, lng)` — PATCH clients row (demo mode: in-memory).
- `ensureClientCoords(clients)` — lazy backfill: for clients with an address but no coords, geocode sequentially with a small delay (~100ms, rate-limit-safe), persist, return map `clientId → {lat, lng}`. Cache in the row so the second Optimize tap refetches nothing.
- `optimizeRoute(jobs, anchor)` — **pure function**: haversine distance, nearest-neighbor tour + light 2-opt pass (N ≤ ~15/day → instant, near-optimal). Anchor = client closest to profile lat/lng (fallback: first job). Jobs with no coords stay in their relative place (optimizer works around them). Returns reordered array (same objects, new order).
- Demo mode: demo clients get coordinates in `demoData.js` so the demo shows the feature offline.

### 3. Today.jsx
- "**Optimize**" button in the day header, visible only when: `profile.tier` is solo/crew/premium AND that day has ≥3 jobs AND ≥2 of them have client addresses.
- Tap → ensureClientCoords (spinner) → optimizeRoute → apply through the **existing** `reorderWithinDate` + `persistReorder` path (route_order renumber + `reorderJobs` batch) → toast "Route optimized" + **Undo** (existing rollback).
- Geocode failures: optimize with whatever coords exist; toast notes "some addresses couldn't be mapped."
- `scheduled_time` is **not** touched by reordering — matches existing drag-and-drop behavior (order is what the crew follows; times stay put).

### 4. Send route (preferred-app navigation)
- New **"Send route"** button next to Optimize (same visibility rule: paid tiers, ≥3 jobs, ≥2 addressable). Opens the current on-screen order — the same order the crew follows — as a multi-stop route.
- Preference picker (small, 3 options on Today): `preferred_nav_app` — Google Maps / Apple Maps / Waze. Persists via PATCH profile (same path as 013 latitude/longitude). Platform default until chosen: iOS → Apple Maps, Android → Google Maps.
- URL builders in `client/src/lib/navLinks.js` — pure functions, no fetch, unit-testable:
  - **Google:** `https://www.google.com/maps/dir/?api=1&origin=<anchor lat,lng>&destination=<last stop>&waypoints=<mid stops, | separated>` (coords). Cap ~10 stops (8 waypoints + destination without an API key — documented Google limit). Over cap: first N sent, toast notes the rest stay per-stop.
  - **Apple:** `https://maps.apple.com/directions?source=<anchor>&destination=<last stop address>&waypoint=<mid stop lat,lng>&waypoint=…&mode=driving` — Apple's unified Maps URL format (official docs: multiple `waypoint` params supported). iOS 16+; older iOS degrades to single destination (per-stop tap remains).
  - **Waze:** no multi-stop deep link exists (one stop per route — official). Waze preference → button becomes "Send next stop to Waze" (`https://waze.com/ul?ll=<lat>,<lng>&navigate=yes`); the full route stays in-app + per-stop tap.
- Stops without coords are skipped from the link; toast counts skipped. Opens via `window.open`. Same builders later feed the native apps (dartboard parity item).

### 5. Landing + copy (fact-lock)
- Card: "Coming soon" badge → **removed** (pill deleted, card stays with the same title + description — the pill is the only lie on the card).
- Footnote: "Card checkout is live. Route optimization ships next — Oklahoma early adopters get new features at no price increase." → "Route optimization is live — included on Solo, Crew, and Premium."
- Compare page: add/update routing row if the table has one (verify during implementation; GPS Navigation row exists).
- **i18n: all new strings in en.json + es.json — Spanish via Google Translate API (mowgo-dev pattern, NEVER Mimo/Codex Spanish). 72-char slug rule.**

### 6. Ship path
- Web first → `vite build` → deploy from **repo root** (`npx wrangler pages deploy client/dist --project-name=mowgo --commit-dirty=true` — NEVER from client/) or push-and-wait fallback → verify live bundle.
- **Review pass on the diff** (project rule): dispatch Mimo subagent (`xiaomi/mimo-v2.5`) — security + quality — fix HIGH/MEDIUM before ship. Codex resumes Aug 8.
- iOS/Android parity → **Ideas Dartboard** as follow-up (same rhythm as rain delay + leads). Web ≠ iOS rule: don't touch native in this batch.

## Out of scope (v1)

- ❌ Turn-by-turn navigation with traffic (Jobber-level) — paid map APIs; tap-to-navigate already exists
- ❌ Drive-time estimates (v1.1 candidate — OSRM public API, free, no key)
- ❌ Multi-crew / multi-truck route splitting (Crew tier v2)
- ❌ Free tier access
- ❌ Route-audit live demo integration (the public lead magnet stays as-is)
- ❌ Webhook events (no external integrations need route events)
- ❌ Waze multi-stop routes (not possible — Waze supports one stop per route; Waze users get next-stop + per-stop tap)

## Test plan

1. Button visibility: hidden on free tier; hidden <3 jobs; hidden when <2 addressable clients; shown on paid tiers
2. Optimize reorders + persists: route_order updated in DB, order survives reload
3. Undo restores the previous order (and DB state)
4. Lazy geocode backfill: first tap geocodes + caches; second tap makes no new geocode calls
5. Jobs without client addresses stay in place
6. Demo mode: works fully offline (demo coords)
7. Geocode failure: button still works with partial coords, honest toast
8. Build green → deployed → live bundle grep shows the new landing line + card flip
9. Mimo review pass: no HIGH/MEDIUM findings unaddressed
10. Send route: Google URL contains anchor + stops in optimized order; cap truncation over ~10 stops
11. Apple URL uses unified format (destination + waypoint params); Waze preference → next-stop link + honest copy
12. Preference persists across reload; platform default applies until user picks

## Effort: 1-2 days (Mimo-assisted). Landing order: migration + data layer (d1) → Today button + algorithm + nav links/preference (d1-2) → landing/i18n + review + deploy (d2).
