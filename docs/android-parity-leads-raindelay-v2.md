# Android Parity — Leads v1 + Rain Delay v2 (Native Kotlin)

**Status:** 🆕 SCOPED — Aug 4, 2026
**Why:** Web shipped Leads v1 + Rain Delay v2; iOS parity landed + review round 1 fixed (commit 06c7a3c). Android native must reach full parity. Reference: iOS implementation in `ios-native/MowGo/` (Models.swift Lead, DataStore.swift lead methods + rainDelay/undoRainDelay + RainDelaySheet.swift) and web in `client/src/`.
**Owner:** Dev (Codex-assisted). CI = the compiler (`android-native-ci.yml` runs on push touching `client/android-native/**`). Do NOT attempt local builds (no JDK/SDK in this container).

## A. Leads (Android)

### Model + repository (`data/model/` + new `data/LeadRepository.kt`)
- `Lead.kt`: `@Serializable` data class with `@SerialName("snake_case")` (id, user_id, name, phone?, email?, address?, source="other", notes?, status="new", client_id?, created_at?, updated_at?). Mirror the iOS Lead fields.
- `LeadStatus` enum (NEW, CONTACTED, QUOTED, WON, LOST).
- `LeadRepository.kt` (mirror `InvoiceRepository`/`JobRepository` patterns, supabase-kt 3.0.1 query patterns from mowgo-dev skill):
  - `loadLeads(): List<Lead>` — select ordered by created_at desc; demo mode in-memory list
  - `createLead(...)`, `updateLeadStatus(id, status)`, `updateLead(id, patch)`, `deleteLead(id)`
  - `convertLeadToClient(lead)` — create client via existing client repo path, then update lead status won + client_id; on lead-update failure best-effort delete the created client (mirror iOS C2 fix)
  - demo mode: in-memory, mirror web demoData (2-3 leads, mixed statuses)

### UI (`ui/screens/clients/`)
- `ClientsScreen.kt` / `ClientsViewModel.kt`: add a segmented control (Material 3 `SegmentedButton` or `TabRow`) **Clients | Leads** at top.
- Leads segment: `LazyColumn` of lead cards — name, source chip, status (`ExposedDropdownMenu` or chips row for the 5 statuses), call/email icon buttons, **Convert** action (confirm dialog → convert → switch to Clients tab), delete via long-press or menu ONLY when status == LOST (confirm dialog).
- `NewLeadDialog` (mirror `ClientFormDialog` pattern): name required; phone/email/address/source/notes optional.
- Empty state text.

### Webhooks (`data/WebhookRepository.kt`, `data/WebhookService.kt`, `ui/screens/more/IntegrationsViewModel.kt`)
- Add `lead.created` and `lead.status.updated` to the available-events list in Integrations UI.
- Fire in `LeadRepository`/`WebhookService`: after lead create → `lead.created`; after status change → `lead.status.updated` (use the NEW status from the patch, not stale state — iOS H7 fix). Best-effort, errors swallowed (existing pattern).
- Canonical event list now: job.created, job.updated, job.completed, invoice.paid, customer.created, payment.failed, rain.delay.applied, job.skipped, lead.created, lead.status.updated.

## B. Rain Delay v2 (Android)

### Current state (read first)
`ui/screens/today/TodayViewModel.kt` — `showRainDelayDialog`, `rainDelayCount`, rain delay confirm flow exists. `data/JobRepository.kt` has job mutations.

### Changes
1. **Target picker**: rain delay dialog gains segmented choice: Tomorrow (default) | Pick a date (Material3 `DatePicker`, min = tomorrow). Confirm moves the selected jobs to the chosen date. Keep the existing per-job update flow (mirror iOS: `rainDelay(for:to:)` behavior — snapshot original dates, apply, on failure re-sync; network-queued? Android has no offline queue for jobs — keep Android's existing online-only mutation pattern; if a job update fails, stop and roll back the already-moved jobs by re-updating).
2. **History + undo**: `RainDelayHistoryStore` (mirror iOS RainDelayEntry: date, targetDate, jobIds, jobCount, createdAt, originalDates) persisted in DataStore preferences (SettingsRepository uses DataStore — add a key `rain_delay_history`; entries capped at 50). Undo restores original dates per job, verifying each job's current date still equals targetDate (skip + keep entry + surface partial on mismatch — iOS H9/M1 behavior). Buttons disabled while undoing (iOS M2).
3. **Weather plumbing (dormant)**: `WeatherRepository`/simple OkHttp call to Open-Meteo (https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&daily=precipitation_probability_max,temperature_2m_max&timezone=auto) — returns null when no coordinates. TodayScreen banner when ≥60% today/tomorrow (hidden in demo + no coordinates). No new Gradle deps beyond what's in the catalog (OkHttp/Retrofit already present).
4. **Webhook**: fire `rain.delay.applied` (payload count, date, target_date) after a successful rain delay (non-demo).

## C. Constraints (MANDATORY)
- Work ONLY in `client/android-native/`. Never touch `client/android/` (Capacitor legacy), `client/src/`, `ios-native/`, server, functions.
- supabase-kt 3.0.1 gotchas (mowgo-dev skill): `decodeList<T>().firstOrNull()` not decodeSingle; no `or` filter DSL (two queries + merge); `Map<String,String>` can't hold nulls (use @Serializable patch data class); no top-level `weight` import; no labeled returns in non-inline lambdas; explicit `import java.time.*` when needed; `PullToRefreshBox` needs `@OptIn(ExperimentalMaterial3Api::class)`.
- ViewModel pattern: `MutableStateFlow<UiState>` + `collectAsStateWithLifecycle()`; load-generation guard (capture `++loadGeneration` before launch, gate state writes); sign-out hygiene not needed here (no new prefs) but clear demo state in repositories per existing patterns.
- Do NOT build locally. CI compiles on push (`gh run list --workflow android-native-ci.yml`). Push to main and let CI verify; fix compile errors from `gh run view --log-failed`.
- No new Gradle dependencies unless strictly required (then add via `gradle/libs.versions.toml` catalog).
- Theme parity: MowGoColors (background #1a1a2e, surface #16213e, brand #4ade80, deep green #22c55e, rain blue #1e3a5f).

## D. Test plan (manual checklist for Aaron)
1. Clients → Leads segment: add lead, change status, convert to client (client appears, lead shows won)
2. Delete only works on lost leads
3. Rain delay: tomorrow + custom date, history entry, undo restores
4. Demo mode: full flows work offline

## E. Effort: 2-3 days (Codex-assisted). Landing order: model+repo (d1) → UI segment + dialogs (d2) → rain delay v2 + webhooks (d3).
