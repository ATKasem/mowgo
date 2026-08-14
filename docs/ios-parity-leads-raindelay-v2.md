# iOS Parity — Leads v1 + Rain Delay v2

**Status:** 🆕 SCOPED — Aug 4, 2026
**Why:** Web shipped Leads v1 (commit 98b0d5a) and Rain Delay v2 (commit 09ae53e). Native iOS must reach full parity per project rule. Reference the web implementation in `client/src/` for behavior.
**Owner:** Dev (Codex-assisted). CI = the compiler (ios-ci.yml, Xcode 16.4). Do NOT attempt local builds.

## A. Leads (iOS)

### Model (`MowGo/Models/Models.swift`)
- Add `struct Lead: Codable, Identifiable, Equatable` following the existing `Client` pattern (line ~162) with explicit snake_case CodingKeys:
  - `id: UUID`, `userId: UUID`, `name: String`, `phone: String?`, `email: String?`, `address: String?`, `source: String` (default "other"), `notes: String?`, `status: String` (default "new"), `clientId: UUID?`, `createdAt: Date?`, `updatedAt: Date?`
- `enum LeadStatus: String, CaseIterable` — new, contacted, quoted, won, lost (display names via rawValue capitalized)

### DataStore (`MowGo/Services/DataStore.swift`)
- `@Published var leads: [Lead] = []`
- `loadLeads()` — PostgREST select ordered by created_at desc; call from `loadAll()` alongside loadClients; demo mode: in-memory demo leads (2-3, mixed statuses, mirror web demoData)
- `createLead(...)`, `updateLeadStatus(id, status)`, `updateLead(id, patch)`, `deleteLead(id)` — follow the EXACT error/rollback/queue patterns of the existing client methods (updateJob/updateClient style: set error + re-throw, offline queue via enqueue where applicable, demo fallbacks)
- `convertLeadToClient(lead)` — creates a Client (reuse existing createClient server path), sets lead status won + clientId, fires `customer.created` + `lead.status.updated` webhooks; demo in-memory
- Fire webhook on lead creation: `lead.created`

### UI (`MowGo/Views/Clients/ClientsView.swift`)
- Top segmented `Picker` "Clients | Leads" (matches web segmented control)
- Leads segment: ScrollView rows — name, source chip (small capsule), status Menu (Picker inline) with the 5 statuses, call/email buttons (same compact HStack style as client cards: 📞 + ✉️), Convert button (calls convertLeadToClient, then switches segment to Clients), swipe/context delete ONLY when status == lost
- `NewLeadFormView.swift` in Views/Clients/ — copy NewClientFormView pattern (name required; phone/email/address/source/notes optional; source picker)
- Empty state text when no leads

### Webhooks (`MowGo/Services/WebhookService.swift`, `MowGo/Views/Settings/IntegrationsView.swift`)
- Add `leadCreated` and `leadStatusUpdated` fire methods (payload: lead id, name, status, source; snake_case keys)
- Add both events to `WebhookEventOption` list in IntegrationsView so users can subscribe (canonical list now: job.created, job.updated, job.completed, invoice.paid, customer.created, payment.failed, rain.delay.applied, job.skipped, lead.created, lead.status.updated)

## B. Rain Delay v2 (iOS)

### Current state (read first)
- `DataStore.rainDelay(for:)` line ~969: snapshots original dates, moves all scheduled jobs to tomorrow via updateJobSchedule, rollback on failure, fires push (firePushRainDelay)
- `TodayView.swift` line ~200: `.alert` confirm → store.rainDelay(for: dateString)

### Changes
1. **DataStore**: refactor to `rainDelay(for date: String, to targetDate: String)` — same snapshot/rollback/push logic, target date parameterized. Add `rainDelayHistory: [RainDelayEntry]` + `saveRainDelayEntry/loadRainDelayHistory` (UserDefaults, cap 50). Add `undoRainDelay(entry)` — restores originalDates via updateJobSchedule per job, removes entry.
2. **RainDelayEntry** (Models.swift or new file): `{date, targetDate, jobIds: [UUID], jobCount, createdAt, originalDates: [UUID: String]}` — Codable for UserDefaults.
3. **TodayView**: replace the `.alert` with a `RainDelaySheet` (sheet presentation, dark theme): affected count, target picker — segmented "Tomorrow" / "Pick a date" (DatePicker, minimum = tomorrow), note "Only today's jobs move. Your schedule stays intact.", Confirm + Cancel. After success: show the existing toast pattern with an **Undo** button (toast must support an action button; if the current toast doesn't, use a brief alert with Undo/Cancel instead). Add a small "History" button (clock icon) on the Today control bar → sheet listing past delays (date, count, target) with per-entry Undo.
4. **Weather plumbing** (dormant): new `WeatherService.swift` — `func forecast(latitude: Double?, longitude: Double?) async -> WeatherForecast?` calling Open-Meteo (https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&daily=precipitation_probability_max,temperature_2m_max&timezone=auto) via URLSession (NO new dependencies). Returns nil when coordinates are nil → TodayView shows NO banner in that case (and never in demo mode). If a future profile location exists, banner shows when today's or tomorrow's precipitation_probability_max >= 60: "🌧️ Rain {pct}% {day} — Rain delay?" → opens RainDelaySheet. Keep the banner code minimal and clearly gated so it stays dormant without coordinates.

## Constraints (MANDATORY)
- Follow every pattern in the skill notes: @MainActor DataStore, `await` for SupabaseService actor properties, `Task<Void, Never>` annotations on typed task properties, NO async-let same-name destructure, NO context.rollback(), NO @StateObject on singletons, [weak self] in closures, explicit `return` in `some View` funcs with let bindings
- iOS UI is English-only (no .strings/.xcstrings exist — do not create localization files)
- Do NOT touch web (client/src), Android (client/android*, client/android-native), or the server
- New Swift files are auto-included by xcodegen (project.yml globs MowGo/) — no project.yml edit needed unless a file is OUTSIDE MowGo/
- Do NOT build locally (no macOS toolchain). The repo's ios-ci.yml compiles on push. Make sure the code is correct by inspection.
- Demo mode: leads + rain delay history work in-memory/UserDefaults, weather returns nil

## Verification
- `git diff --check` clean
- Grep for known Codex artifacts: double backslashes in @Environment, `StateObject.*shared`, `context.rollback()`, `???????? UUID()`
- Report: files changed, compile risks, deviations
