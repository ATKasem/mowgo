# Zone-Based Routing — Implementation Spec

## Problem
The email copy claims we "group stops by zone" but the current optimizer only does nearest-neighbor + 2-opt across the whole day. Adding zone support makes the product match the marketing.

## Data Model

### New table: `zones`
- `id` (uuid, PK)
- `business_id` (uuid, FK → profiles)
- `name` (text, e.g. "North OKC", "South OKC")
- `color` (text, hex color for UI)
- `created_at` (timestamp)

### New column on `jobs`: `zone_id` (uuid, nullable, FK → zones)
- null = unassigned / no zone

## Optimizer Changes (`src/lib/optimizeRoute.js`)

### New function: `optimizeRouteByZone(jobs, anchor, zoneMap)`
1. Group jobs by `zone_id` (null = "unzoned" group)
2. Sort zones by distance from anchor (closest zone first)
3. Within each zone, run `nearestNeighborTour` + `twoOpt`
4. Concatenate zone tours in zone-distance order
5. Unzoned jobs go last (or at the end of the closest zone)

### Modified: `optimizeRoute(jobs, anchor)`
- Keep existing signature for backward compat
- Add optional `zoneMap` parameter (Map of zone_id → {name, color})
- When zoneMap is provided, delegate to `optimizeRouteByZone`

## Today.jsx Changes

### Zone picker on job cards
- Add a zone dropdown to each job card in the Today view
- Show zone color dot + name
- "No zone" option for unassigned

### Zone management UI
- Add a "Manage Zones" button in the toolbar
- Modal/panel to create/edit/delete zones
- Color picker for each zone

### Route display
- Color-code job cards by zone
- Zone summary: "Zone: North OKC (3 stops) · South OKC (5 stops)"

## Route Audit Tool Changes

The route audit calculator at `public/seo/route-audit/index.html` should show:
- Without zones: total distance
- With zones: distance saved by zone grouping
- This demonstrates the value we claim in emails

## Files to Change

1. `src/lib/optimizeRoute.js` - Add `optimizeRouteByZone` + `zoneMap` parameter
2. `src/lib/optimizeRoute.test.js` - Add zone routing tests
3. `src/pages/Today.jsx` - Zone picker, zone management, color-coded display
4. `src/components/ZoneManager.jsx` - New component for zone CRUD
5. `src/i18n/locales/en.json` - Zone-related translations
6. Supabase migration - `zones` table + `zone_id` column on jobs
7. `public/seo/route-audit/index.html` - Updated calculator

## Priority
1. Optimizer logic (no UI needed to test)
2. Zone picker on job cards
3. Zone management UI
4. Route audit tool update
5. Supabase migration