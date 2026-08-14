# Business Location in Profile — Web (unlocks Rain Delay weather banner)

**Status:** 🆕 SCOPED — Aug 4, 2026
**Why:** Rain Delay v2 weather banner reads `profile.latitude ?? profile.lat` / `profile.longitude ?? profile.lng` (Today.jsx lines 99-100) but nothing stores coordinates, so the banner can never render on real accounts. Add an optional Business Location field to the Business Profile form with clear user-facing copy explaining WHY location is collected.
**Owner:** Dev (Codex-assisted). iOS/Android location fields land in their parity batches.

## Migration — `supabase/migrations/013_profile_location.sql`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
GRANT UPDATE (latitude, longitude) ON profiles TO authenticated;
```

(Do NOT apply via CLI — coordinator handles deployment. Column-level grant is REQUIRED: migration 002 did `REVOKE UPDATE ON profiles FROM authenticated` + `GRANT UPDATE (business_name, phone)`; without the new grant the upsert silently fails.)

## Data layer (`client/src/lib/data.js`)

- `loadProfile()` already does `select('*')` — no change needed (returns lat/lng once columns exist).
- `saveProfile(profile)`: extend the upsert to include `latitude` and `longitude`. Validate before sending: if present, must be finite numbers, lat in [-90,90], lng in [-180,180]; null/empty clears the value (send null). Keep demo-mode branch working (add lat/lng to the in-memory team member update).

## Settings form (`client/src/pages/Settings.jsx` — Business Profile section)

- Add a **"Business location"** field below the phone field:
  - Text input (placeholder: "City, State or ZIP — e.g. Oklahoma City, OK")
  - On blur/button click: geocode via Open-Meteo geocoding API (free, NO key):
    `https://geocoding-api.open-meteo.com/v1/search?name=<query>&count=1&language=en&format=json`
  - On success: store `latitude`/`longitude` in the profile state, show resolved place name in muted text (e.g. "📍 Oklahoma City, Oklahoma, United States"). On failure: show a small inline error, do NOT block saving the rest of the profile.
  - A "Remove location" affordance (small × or clear button) that nulls lat/lng.
- **User-facing copy (REQUIRED — user must know why we ask):**
  - Field helper text: "Used to show your local weather so Rain Delay knows when rain is coming at your location. Never shared with anyone."
  - Above the field, small header: "Why do we ask? Rain Delay uses your location for accurate local forecasts."
- Keep existing dark-first Tailwind styling (CSS vars, brand green).

## Today screen hint (`client/src/pages/Today.jsx`)

- When NO location is set (profile lat/lng missing) AND the rain delay sheet is opened, show a one-line hint inside the sheet: "Add your business location in Settings to see local rain forecasts."
- (The weather banner itself is already implemented and dormant — no changes to the banner logic.)

## i18n

- Add ALL new user-facing strings to `client/src/i18n/locales/en.json` (Settings section + today section).
- For `es.json`: add the SAME keys with the English text as a placeholder value (coordinator translates via Google Translate API afterward). Keep JSON valid.
- Do NOT attempt Google Translate from the sandbox (network blocked) — placeholder only.

## Out of scope

- ❌ No map picker, no GPS, no auto-detect (typed city/zip geocode only)
- ❌ No change to demo mode weather behavior (weather stays disabled in demo)
- ❌ No iOS/Android changes (their parity batches)

## Test plan

1. Save profile with location → upsert succeeds (no RLS/column error) → reload → lat/lng present
2. Geocode "Oklahoma City" → resolves to ~35.47/-97.52, place name shown
3. Clear location → save → nulls stored
4. Invalid input (e.g. "zzzzzz") → inline error, profile still saves
5. Rain delay sheet with no location → hint line visible
6. `npx vite build` passes

## Verification

- `git diff --check` clean
- Report: files changed, build status, deviations
