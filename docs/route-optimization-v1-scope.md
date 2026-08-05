# Route Optimization v1 — Scope (Make the "Coming Soon" Promise Real)

**Status:** 🆕 SCOPED — Aug 5, 2026
**Why:** The landing page already promises it ("Route Optimization — Coming soon" card + "Card checkout is live. Route optimization ships next — Oklahoma early adopters get new features at no price increase."). A promised feature that never ships is the strongest negative WOM available. It's also the #1 competitive gap flagged in the Aug 1 analysis ("#1 feature request from crews") — Jobber sells routing as a ~$49/mo add-on; MowGo's counter-positioning is "routing included." Hormozi lens (applied Aug 5): not the rate limiter (activation is), but the promise is public, the infra exists (route_order + reorderJobs + Open-Meteo already in stack), and it's a daily-habit retention hook. Decision: ONE small honest v1, $0 APIs, paid tiers only. The mistake would be building Jobber-level turn-by-turn (paid map APIs, nobody in the 1-3 person ICP asks for it).
**Decision (Aug 5 poll):** Send-route targets the user's preferred navigation app — Google, Apple Maps, or Waze — not Google-only. Sourced: Apple Maps supports multi-stop via unified Maps URLs (Apple docs: multiple `waypoint` params); Waze does not support multi-stop deep links (one stop per route, official); Google caps ~10 stops (8 waypoints + destination without an API key). Waze users get next-stop + per-stop tap. **Second round (Aug 5):** the user chooses — "Send all stops" (multi-stop link) **or** "Send one by one" (single-stop links stepped through the optimized order, works in every app incl. Waze). The in-app reorder is the floor — nav links are the add-on, never the reverse.

**Claude Code review (Aug 5):** 7 findings — 3 CRITICAL (migration 014 name collides — repo is timestamp-named now; loadJobs/loadClients allowlists strip lat/lng on every read; `/api/jobs/reorder` exists only in legacy server/, NOT in CF Pages Functions → drag-drop reorder likely 404s in prod today — v1 ports it first), 3 HIGH (saveProfile hardcodes fields → preferred_nav_app silently dropped unless added; crew-filter/crew-role reorder clobbers other assignees — button gated to whole-day owner view; demo owner lacks anchor coords), 1 MEDIUM (clients GRANT unnecessary — only profiles got the revoke/column-grant treatment in 002). All verified against source and folded into the sections below.

**Owner:** Dev (Mimo-assisted — Codex usage out until Aug 8, then restore Codex). **Priority:** next sprint (card is live on the page).

## Goal (v1)

1. **Optimize button on Today** — one tap reorders the day's jobs by drive distance (nearest-neighbor + light 2-opt on haversine, pure client-side). Zero new APIs, zero keys, works offline.
2. **Paid tiers only** (Solo/Crew/Premium) — free tier keeps rain delay as its hook; routing is the upgrade lever. No lock UI on free; the landing/compare pages sell it.
3. **Undo** — reuses the existing drag-drop rollback path.
4. **Flip the landing card** — "Coming soon" → live; the "ships next" footnote line updates. Fact-lock: no new stats, no price changes.
5. **Send route to preferred nav app** — one tap opens the optimized day as a multi-stop route in the user's preferred app (Google Maps, Apple Maps, or Waze), from a small in-app preference. Still $0: pure deep links, no map APIs.

## Current implementation (read first)

- Jobs have `route_order` (per-date int, renumbered on reorder). `client/src/pages/Today.jsx` has drag-and-drop reordering: `reorderWithinDate()` (re-numbers route_order for the date) + `persistReorder()` (batch `reorderJobs()` from `client/src/lib/data.js` ~line 1070, with rollback on failure). **The DB layer exists, but the HTTP route does not ship in prod: `reorderJobs()` posts to `/api/jobs/reorder`, implemented ONLY in legacy `server/index.js:294` — no CF Pages Function exists (Claude Code CRITICAL). Drag-and-drop reorder likely 404s on the live site today. v1 ports the route first (prerequisite section below).**
- Jobs join `clients!left(*)`; clients have a single `address` text field. **No lat/lng anywhere on clients/jobs** — needs migration + geocoding.
- Profile already stores `latitude`/`longitude` (Business Location feature, migration 013, Open-Meteo geocoded) — the anchor for the route start.
- `client/src/pages/RouteAudit.jsx` + `/api/route-audit` — free route audit lead magnet (already live; NOT touched by v1).
- Landing: `client/src/pages/Landing.jsx` — "Route Optimization / Coming soon" card + pricing footnote "Card checkout is live. Route optimization ships next…" (i18n keys in en.json/es.json, 72-char slug rule).
- Tier gating pattern: `profile.tier === 'crew'` gates Crew features (mowgo skill).

## Changes

### 0. PREREQUISITE — port `POST /api/jobs/reorder` to CF Pages Functions (fixes live drag-drop)
- New `functions/api/jobs/reorder.js` mirroring `server/index.js:294-307` + the auth/service-key pattern from `functions/api/team/[memberId].js` (Bearer token → `supabase.auth.getUser()` with anon key to get `user.id`; service key `env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY` for the RPC — `reorder_jobs` (migration 003) is `GRANT EXECUTE ... TO service_role` ONLY, authenticated cannot call it).
- Validate body like the legacy route: `orders` array of `{id: string, route_order: integer}` → 400 otherwise. CORS allowlist `mowgoapp.com` + `mowgo.pages.dev`. Response `{ success: true }`.
- Verify live before building on it: `curl -s -X POST https://mowgoapp.com/api/jobs/reorder -H 'Content-Type: application/json' -d '{}'` → JSON 400 (function exists), not 404/HTML. Then drag-drop reorder regression on the live app.
- This is a pre-existing prod bug (drag-drop reorder), not new scope: Optimize rides the same persist path.

### 1. Migration `20260805193000_client_coords.sql`
- **Naming: timestamp convention** — `014_client_coords.sql` COLLIDES (014_concierge_requests.sql exists; newest repo migration is `20260731193000_add_client_tags.sql`). Use `<UTC-timestamp>_client_coords.sql` (Claude Code CRITICAL).
- `ALTER TABLE clients ADD COLUMN latitude double precision, ADD COLUMN longitude double precision;`
- `ALTER TABLE profiles ADD COLUMN preferred_nav_app text DEFAULT NULL;` — 'google' | 'apple' | 'waze'; NULL = platform default (iOS → apple, else google).
- `GRANT UPDATE (preferred_nav_app) ON profiles TO authenticated;` — REQUIRED: profiles got `REVOKE UPDATE` in 002:79, so new profile columns need the 013-style column grant. **NO clients grant needed** — clients never received the revoke treatment (plain RLS `FOR ALL` policy in 001), UPDATE is already allowed (Claude Code MEDIUM).
- Apply via the Supabase CLI access token (sbp_… has full SQL scope — `POST /v1/projects/<ref>/database/query`), not the Management API key (403 on SQL). Verify after: `GET /rest/v1/clients?select=id,latitude,longitude&limit=1` with service key → 200.

### 2. Data layer (`client/src/lib/data.js`)
- `geocodeAddress(address)` — Open-Meteo geocoding API (`https://geocoding-api.open-meteo.com/v1/search?name=<q>&count=1&language=en&format=json`). Free, no key. Returns `{latitude, longitude}` or null. Graceful failure (null, no throw).
- `updateClientCoords(clientId, lat, lng)` — PATCH clients row (demo mode: in-memory).
- **READ ALLOWLISTS MUST ADD COORDS (Claude Code CRITICAL):** `loadJobs()` client sub-object (~data.js:113-125) and `loadClients()` (~data.js:442-454) hand-map to fixed field lists without latitude/longitude — without edits here, coords are stripped on every read and every Optimize tap re-geocodes everything. Add `latitude`/`longitude` to both mappings.
- `ensureClientCoords(clients)` — lazy backfill: for clients with an address but no coords, geocode sequentially with a small delay (~100ms, rate-limit-safe), persist via `updateClient(id, { latitude, longitude })`, return map `clientId → {lat, lng}`. Cache in the row so the second Optimize tap refetches nothing.
- `optimizeRoute(jobs, anchor)` — **pure function**: haversine distance, nearest-neighbor tour + light 2-opt pass (N ≤ ~15/day → instant, near-optimal). Anchor = client closest to profile lat/lng (fallback: first job). Jobs with no coords stay in their relative place (optimizer works around them). Returns reordered array (same objects, new order).
- Demo mode: demo clients get coordinates in `demoData.js` AND the demo owner gets `latitude`/`longitude` (demoData.js:22 + loadProfile demo fallback data.js:915) so the anchor exists (Claude Code HIGH).

### 3. Today.jsx
- "**Optimize**" button in the day header, visible only when: `profile.tier` is solo/crew/premium AND `!isCrewMember` AND `crewFilter === null` AND that day has ≥3 jobs AND ≥2 of them have client addresses. (Claude Code HIGH: `reorderWithinDate` renumbers ALL jobs for the date — a crew member or filtered view would reorder other assignees' stops. Whole-day owner view only.) Operates on `dateFiltered`. Disabled while optimizing (double-tap guard).
- Tap → ensureClientCoords (spinner) → optimizeRoute → apply through the **existing** `reorderWithinDate` + `persistReorder` path (route_order renumber + `reorderJobs` batch) → toast "Route optimized" + **Undo** (existing rollback).
- Geocode failures: optimize with whatever coords exist; toast notes "some addresses couldn't be mapped."
- `scheduled_time` is **not** touched by reordering — matches existing drag-and-drop behavior (order is what the crew follows; times stay put).

### 4. Send route (preferred-app navigation)
- New **"Send route"** button next to Optimize (same visibility rule: paid tiers, ≥3 jobs, ≥2 addressable). Opens the current on-screen order — the same order the crew follows. **Chooser on tap: "Send all stops" or "Send one by one"** (both persist nothing extra — pure links).
- **Send all stops** → multi-stop deep link (Google/Apple only). **Send one by one** → a sheet listing the stops in optimized order; tapping a row opens that single stop in the preferred app. Works in every app including Waze. The in-app reorder is the floor — this button is the delivery vehicle, and v1 ships even if nav links slip.
- Preference picker (small, 3 options on Today): `preferred_nav_app` — Google Maps / Apple Maps / Waze. Persists via `saveProfile({...profile, preferred_nav_app})` — **`saveProfile` must be edited to include the field in its destructure + upsert (data.js:973-981); it is NOT a generic PATCH (Claude Code HIGH — silent-drop otherwise).** Platform default until chosen: iOS → Apple Maps, Android → Google Maps.
- URL builders in `client/src/lib/navLinks.js` — pure functions, no fetch, unit-testable:
  - **Google:** `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=<anchor lat,lng>&destination=<last stop>&waypoints=<mid stops, %7C separated>` (coords, commas %2C-encoded per docs). Cap 10 stops (9 waypoints + destination; 3 waypoints on mobile browsers — documented Google limit, verified Aug 5). Over cap: first N sent, toast notes the rest stay per-stop.
  - **Apple:** `https://maps.apple.com/directions?source=<anchor>&destination=<last stop address>&waypoint=<mid stop lat,lng>&waypoint=…&mode=driving` — Apple's unified Maps URL format (official docs: multiple `waypoint` params; destination = ENDING destination, waypoints = in-between; coords use raw commas). **Requires iOS 18.4+ / macOS 15.4+** (unified URLs — verified Aug 5); older iOS degrades to single destination (per-stop tap remains).
  - **Waze:** no multi-stop deep link exists (one stop per route — official). "Send all stops" is hidden for Waze with honest copy; "Send one by one" is their path (`https://waze.com/ul?ll=<lat>,<lng>&navigate=yes` per stop).
- Stops without coords are skipped from the link; toast counts skipped. Opens via `window.open`. Same builders later feed the native apps (dartboard parity item).

### 5. Landing + copy (fact-lock)
- Card: "Coming soon" badge → **removed** (pill deleted, card stays with the same title + description — the pill is the only lie on the card).
- Footnote: "Card checkout is live. Route optimization ships next — Oklahoma early adopters get new features at no price increase." → "Route optimization is live — included on Solo, Crew, and Premium."
- Compare page: add/update routing row if the table has one (verify during implementation; GPS Navigation row exists).
- **i18n: all new strings in en.json + es.json — Spanish via Google Translate API (mowgo-dev pattern, NEVER Mimo/Codex Spanish). 72-char slug rule.**

### 6. Ship path
- Web first → `vite build` → deploy from **repo root** (`npx wrangler pages deploy client/dist --project-name=mowgo --commit-dirty=true` — NEVER from client/) or push-and-wait fallback → verify live bundle.
- **Review pass on the diff** (project rule): Claude Code PRIMARY (`claude -p` print mode — user pays, strongest reviewer) + Mimo second pass (`delegate_task` xiaomi/mimo-v2.5); fix HIGH/MEDIUM before ship. Codex resumes Aug 8.
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

1. Button visibility: hidden on free tier; hidden <3 jobs; hidden when <2 addressable clients; hidden for crew-role members; hidden when a crew filter is active; shown on paid tiers in whole-day owner view
2. Optimize reorders + persists: route_order updated in DB, order survives reload
3. Undo restores the previous order (and DB state)
4. Lazy geocode backfill: first tap geocodes + caches; second tap makes no new geocode calls
5. Jobs without client addresses stay in place
6. Demo mode: works fully offline (demo coords)
7. Geocode failure: button still works with partial coords, honest toast
8. Build green → deployed → live bundle grep shows the new landing line + card flip
9. Review pass (Claude Code primary + Mimo second): no HIGH/MEDIUM findings unaddressed
9a. PREREQUISITE: `curl -X POST https://mowgoapp.com/api/jobs/reorder -H 'Content-Type: application/json' -d '{}'` → JSON 400, not 404; drag-drop reorder works on the live site (pre-existing bug fixed)
9b. loadJobs/loadClients mappings include latitude/longitude (grep both allowlists)
9c. saveProfile persists preferred_nav_app across reload (real + demo mode)
9d. Demo mode: Optimize works offline with anchor from demo owner coords
10. Send route: chooser shows both options; Google URL contains anchor + stops in optimized order; cap truncation over ~10 stops
11. "Send one by one" sheet lists stops in optimized order; each row opens the preferred app single-stop link (incl. Waze); "Send all stops" hidden for Waze
12. Apple URL uses unified format (destination + waypoint params); preference persists; platform default applies until user picks

## Effort: 1.5-2.5 days (Claude Code + Mimo review). Landing order: reorder route port + migration + data layer (d1) → Today button + algorithm + nav links/preference (d1-2) → landing/i18n + review + deploy (d2-3).
