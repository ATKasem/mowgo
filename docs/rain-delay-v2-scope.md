# Rain Delay v2 — Scope (Flesh Out the Differentiator)

**Status:** 🆕 SCOPED — Aug 4, 2026
**Why:** Rain delay is MowGo's #1 differentiator (no competitor has one-button). Current implementation (Today.jsx ~line 374): confirm dialog → move all non-done jobs to tomorrow. v2 makes it best-in-class: weather awareness, smart reschedule, recurring-series handling, history + undo.
**Owner:** Dev (Codex-assisted). **Priority:** after Leads v1 lands.

## Goal (v2)

1. **Weather integration** — Open-Meteo (free, NO API key, no deps): rain probability today/tomorrow for the business location. Show a banner/indicator on the Today screen ("Rain 80% tomorrow").
2. **Smart reschedule** — rain delay can move jobs to tomorrow (current) OR to a specific date (picker) OR auto-suggest the next dry day. Works for all jobs or a selected subset.
3. **Recurring series** — jobs have no explicit recurrence model today; treat "series" as: jobs with the same client_id + same route pattern. v2 scope: rain-delay moves ONE day's jobs only (current behavior, series untouched). Note in the delay dialog: "Only today's jobs move. Your schedule stays intact." Document as v2.1 for true series shifting.
4. **History + undo** — every rain delay logged locally (localStorage, keyed by date + user) and server-side optional (scope cut: localStorage only in v2). Undo restores original dates.

## Current implementation (read first)

`client/src/pages/Today.jsx` ~lines 370-415: confirm dialog "Move {{count}} job to tomorrow?", builds next date, updates jobs (updateJob per job via data.js), toast "{{count}} job moved to tomorrow". Uses existing `updateJob` in `client/src/lib/data.js`.

## Changes

### Data layer (`client/src/lib/data.js`)
- `rainDelayJobs(jobIds, targetDate)` — sets scheduled_date = targetDate for given jobs (replaces inline logic; keep per-job updateJob or batch). Demo mode: in-memory.
- `loadRainDelayHistory()` / `saveRainDelayEntry(entry)` — localStorage key `mowgo_rain_delay_history_{userId}`: entries `{date, targetDate, jobIds, jobCount, createdAt}` (cap 50).
- `getWeatherForLocation(lat, lng)` — fetch Open-Meteo forecast (https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&daily=precipitation_probability_max,temperature_2m_max&timezone=auto). NO new npm deps. Handle fetch failure gracefully (silent, banner hides).

### Today.jsx
- Rain banner: if weather fetched and today's or tomorrow's precipitation_probability_max >= 60%, show slim banner: "🌧️ Rain {pct}% tomorrow — Rain delay?" → opens the Rain Delay dialog.
- Rain Delay dialog (replaces confirm()):
  - Shows affected count (non-done jobs on selected date)
  - Target picker: "Tomorrow" (default) | "Pick a date" (date input, must be >= tomorrow)
  - Note: "Only {count} jobs move. Your schedule stays intact."
  - Confirm → rainDelayJobs() → history entry saved → toast (existing style)
- Undo: toast gains "Undo" action → restore original dates (re-run rainDelayJobs with original dates, remove history entry).
- History: small "History" link in the dialog or Today header → modal listing past rain delays (date, count, target) with per-entry Undo.

### i18n
- All new strings in en.json + es.json (Spanish via Google Translate API — see mowgo-dev i18n pattern, NEVER Codex Spanish).

### Out of scope (v2)
- ❌ No SMS/email client notifications (phase 2 — needs client contact channel)
- ❌ No server-side delay log table (localStorage only)
- ❌ No true recurring-series shifting (document only)
- ❌ No weather map/radar; text % only
- ❌ No per-job weather (all jobs on same day treated equally; business location comes from profile if available, else no weather and banner hidden)

## Test plan
1. Weather fetch: banner shows at >=60%, hides below, hides on fetch failure (offline/demo)
2. Rain delay to tomorrow: dates update, toast + undo restores
3. Pick-a-date: custom date works, validation rejects past dates
4. History: entries persist across reload (localStorage), undo from history works
5. Demo mode: full flow works in-memory (no weather, banner hidden)

## Effort: 2-3 days (Codex-assisted). Landing order: data layer + dialog (d1) → weather banner (d2) → history/undo + i18n (d3).
