# Day Conditions (Crew Weather) — v1 Scope (Web + iOS + Android)

**Status:** 🆕 SCOPED — Aug 8, 2026
**Why:** Blasian saw Brian Byrd's Lawn Dominators post (Lawn Dudes group) with a "DAY CONDITIONS" panel (weather temp/wind, soil temp, 7-day rain, spray GOOD/HOLD) and asked "should we mimic? I like the weather stuff but not sure." Hormozi + board verdict (Aug 8): **don't mimic the dashboard or the homeowner app — but the crew weather display is on-identity** (MowGo's whole positioning is "the rain delay company"; weather data is the input to that story). Rate limiter honesty: this is NOT the constraint (activation/distribution is) — it's a cheap, $0, on-identity retention/display feature. No landing-page promise exists (checked Landing.jsx: only Rain Delay/Route/Built-for-crews cards) → **no sunk commitment**, this is a like-it/build-it call. Verdict: build the crew weather panel, lean, all-tiers display (matches the existing free rain-delay banner which already shows rain %).

**Decision (Aug 8):** build DAY CONDITIONS on **all three platforms in one batch** (web is the reference implementation, iOS + Android parity follow the same Open-Meteo shape). Blasian: "Yes with Claude and Mimo" — Claude Code CLI builds, Mimo reviews. The homeowner app (My Lawn, army worm heat map, GDD, soil analyzer, Earn) is **NOT in scope** — that's a second product for a second avatar (Hormozi 111 rule). Invoice-diagnostic tagging parked separately (Crew-tier candidate).

## Goal (v1)

1. **Day Conditions card on Today** (all platforms): Weather (current temp + wind), Soil temp, 7-day rain (observed total), Spray (GOOD / HOLD OFF) — same visual language as the existing route-progress cards, dark + light themes.
2. **$0 APIs only** — Open-Meteo forecast + (optionally) archive endpoints, already the stack's weather provider. No keys, no new deps.
3. **Spray heuristic, not a claim** — constants: GOOD when temp ≤ 85°F AND wind ≤ 10 mph, else HOLD OFF. Sourced as common liquid-product label guidance; surfaced as a heuristic ("common label guidance — always follow the label"), never as a guarantee. Numbers in ONE named constant per platform so it's trivially adjustable.
4. **All tiers, display-only** — same class as the existing free rain banner; no automation, no gating. If Blasian later wants it as an upgrade lever, flip the gate (spec'd, not built).
5. **Fix the iOS dead stub** — `WeatherService.forecast()` currently hardcodes `latitude: nil, longitude: nil` → always returns nil → iOS weather has NEVER fired. Wire real profile coords.
6. **Native profile models must carry lat/lng** — the DB columns already exist (migration 013, Business Location on web); iOS `UserProfile` and Android `Profile`/`UserProfile` simply don't SELECT them → coords stripped on every read.

## Current state (verified Aug 8 — read first)

- **Web** — `client/src/lib/data.js:396` `getWeatherForLocation(lat, lng)` fetches ONLY `daily=precipitation_probability_max,temperature_2m_max` from Open-Meteo. Used by `Today.jsx:117` purely for the rain-delay banner (`weatherDays` → banner when today/tomorrow rain ≥ 60%, line 131-135). **No current temp, no wind, no soil temp, no 7-day rain, no spray panel anywhere.** Profile stores `latitude`/`longitude` (Settings.jsx:147-161, Open-Meteo geocoded, migration 013).
- **iOS** — `Services/WeatherService.swift` fetches `daily=precipitation_probability_max,temperature_2m_max`; `Views/Today/TodayView.swift:235` calls `forecast(latitude: nil, longitude: nil)` — **hardcoded nil, comment: "Coordinates are intentionally nil until profile location fields exist."** `TodayView.swift:656-660` uses `weatherForecast` only for the rain banner (≥60% today/tomorrow). `Models.swift:414 UserProfile` has **no latitude/longitude fields** → even if coords were set on web, iOS strips them.
- **Android** — `data/WeatherRepository.kt` fetches the same 2 daily fields; `ui/screens/today/TodayScreen.kt:158-164` renders ONE rain-chance alert card (`today_rain_chance`, RainBlue card). `data/model/Profile.kt` and `UserProfile.kt` have **no lat/lng fields**.
- **i18n** — zero day-conditions keys in `client/src/i18n/locales/en.json` / `es.json`.
- **Open-Meteo capability (free, no key, verified docs/shape):** `current=temperature_2m,wind_speed_10m` · `daily=precipitation_sum,soil_temperature_0cm,temperature_2m_max` · `past_days=7` for observed 7-day rain total. (Direct curl from this container hit the shared-IP daily limit — the app calls it client-side from user browsers, unaffected; keep the existing `forecast_days=3`-style short horizon and cache like the web hook does.)
- **Landing page** — `Landing.jsx` features array: Rain Delay Auto-Reschedule / Route Optimization / Built for Lawn Crews. No weather/forecast promise → no "Coming soon" pill to flip (unlike Route Optimization, which had a live promise).

## Changes

### 1. Web (reference implementation)

**`client/src/lib/data.js`**
- New `getDayConditions(lat, lng)` — Open-Meteo `v1/forecast`: `current=temperature_2m,wind_speed_10m`, `daily=precipitation_sum,soil_temperature_0cm,temperature_2m_max`, `past_days=7`, `timezone=auto`, `temperature_unit=fahrenheit`, `wind_speed_unit=mph`. Returns `{ currentTemp, windMph, soilTempF, rain7dInches }` or null (graceful failure, same try/catch pattern as `getWeatherForLocation`). Keep `getWeatherForLocation` untouched (rain banner depends on it).
- Spray rule helper `sprayStatus(currentTemp, windMph)` → `'good' | 'hold'` (constants: ≤85°F AND ≤10mph → good). One named constant object.

**`client/src/pages/Today.jsx`**
- Fetch `getDayConditions` alongside `getWeatherForLocation` (same `active` guard, same effect).
- **Day Conditions card** between the route-progress banner and the jobs list: 4 mini-metrics (Weather `73°`/`Wind 7 mph` · Soil temp `—` when null with "No station" fallback text · 7-day rain `0.00"` · Spray `GOOD` green / `HOLD OFF` amber). Reuses existing card styling (light sage / dark card), no new chrome, no new deps.
- No business location set → show card with "Set business location to see conditions" hint linking to the existing Settings Business Location control (don't invent a new settings surface).
- i18n: new keys in en.json + es.json (72-char slug rule; Spanish via Google Translate, never via the coding agent).

### 2. iOS (fix the stub + panel)

- `Models.swift` `UserProfile`: add `latitude: Double?` / `longitude: Double?` (CodingKeys already snake_case via decoder? — verify; the Supabase response has `latitude`/`longitude`). Profile load must SELECT them (check the query's select list — if it's `*` they arrive, if explicit, add).
- `Services/WeatherService.swift`: extend `WeatherForecast` with current temp, wind, soil temp, 7-day rain; fetch with `current` + `past_days=7` + `daily=precipitation_sum,soil_temperature_0cm`; add `sprayStatus` constant helper.
- `Views/Today/TodayView.swift:232-236`: pass `profile.latitude/longitude` instead of nil; no coords → nil forecast (card shows the set-location hint, same as web).
- Render the Day Conditions card (SwiftUI, `MowGoTheme` dark+light). Rain banner logic (656-660) unchanged.
- Follow the mowgo-ios skill gates: load `ios-swift-code-quality` + `doubt-driven-development` + `ios-review-loop` before the build; one logical unit per patch; `.overlay` after `.clipShape`; no `context.rollback()`; etc.

### 3. Android (alert → full panel)

- `data/model/Profile.kt` + `UserProfile.kt`: add `latitude`/`longitude` (`@SerialName`), default null.
- `data/WeatherRepository.kt`: extend `WeatherForecast` with current temp, wind, soil temp, 7-day rain; fetch `current` + `past_days=7` + `precipitation_sum,soil_temperature_0cm`; sprayStatus helper.
- `ui/screens/today/TodayViewModel.kt` + `TodayScreen.kt`: replace the single rain-chance card with the Day Conditions panel (same 4 metrics, Compose `MowGoColors`); keep the existing rain-chance behavior folded into the Weather metric (or drop the standalone card — the panel supersedes it). Keep the RainBlue card removal intentional, not silent.

### 4. Spec-scoped but NOT built (parked)
- Homeowner app (second avatar) — vetoed (Hormozi 111 / anti-diversification).
- Army worm heat map, GDD, soil analyzer, Premium soil tier, "Earn" — Lawn Dominators homeowner-side features; revisit only if the crew-side panel proves sticky.
- Invoice diagnostic tagging → separate Crew-tier candidate (dartboard).

## Files
- `client/src/lib/data.js` · `client/src/pages/Today.jsx` · `client/src/i18n/locales/en.json` · `es.json`
- `ios-native/MowGo/Models/Models.swift` · `ios-native/MowGo/Services/WeatherService.swift` · `ios-native/MowGo/Views/Today/TodayView.swift`
- `client/android-native/.../data/model/Profile.kt` · `UserProfile.kt` · `data/WeatherRepository.kt` · `ui/screens/today/TodayViewModel.kt` · `TodayScreen.kt`
- Docs: `docs/day-conditions-v1-scope.md` (this file)

## Constraints
- $0 (Open-Meteo only, no keys, no new npm/gradle/SwiftPM deps).
- No new DB migration (columns exist since migration 013) — verify with `supabase db query` before claiming.
- No invented numbers: spray thresholds are a labeled heuristic surfaced as such; no marketing stats added.
- i18n both locales (en/es) — Spanish via Google Translate API, never via the coding agent.
- Dark + light verified on all three platforms (screenshots/emulator + real device for iOS).
- `git diff --check` clean; stage specific files only (never `git add -A` — picks up cron/vault artifacts).
- Web deploys on `main` push (CF Pages). iOS/Android: Blasian builds locally (full commands in report).
- Native models must keep parity with DB `profiles.latitude/longitude` (verify via live query).

## Report
- Web: build passes, deploy verified (bundle hash + `grep` for a new string), day conditions visible with a real OKC location.
- iOS: Claude Code built, Mimo reviewed clean, Blasian builds via `cd mowgo && git pull origin main && cd ios-native && xcodegen generate && open MowGo.xcodeproj`.
- Android: in-container APK build passes (JDK /opt/data/tools/jdk17, --no-daemon -Xmx1536m).
- Mimo review: all findings fixed, PASS/FAIL per finding.
