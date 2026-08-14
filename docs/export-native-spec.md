# MowGo Native Batch: Data Export in Settings (iOS + Android) — v1

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement the spec below directly, immediately, in one pass. Do NOT attempt any local build or compile (no xcodebuild, no gradle — CI compiles after the coordinator pushes). Do NOT git commit or push. Do NOT write any Spanish. Native apps are English-only.

Repo root: /opt/data/mowgo.
- iOS: `ios-native/MowGo/` (SwiftUI, xcodegen project). Settings screen: `ios-native/MowGo/Views/Settings/SettingsView.swift`.
- Android: `client/android-native/` (Kotlin + Jetpack Compose, Material 3). More screen: `client/android-native/app/src/main/java/com/mowgo/app/ui/screens/more/MoreScreen.kt`.

Feature: a "Data" / "Export data" section in Settings (iOS) and More (Android) letting the user export their business data (clients, jobs, invoices; also leads on iOS where leads exist) as CSV files. This is client-side data from the local store/repositories — NO new edge functions, NO new dependencies, NO new permissions beyond standard file saving.

## iOS implementation

### Files
1. NEW `ios-native/MowGo/Views/Settings/ExportService.swift` — a small `enum ExportService` (or struct) with static CSV-building functions:
   - `static func csv(from clients: [Client]) -> String`, same for jobs, invoices, leads. Read the actual model types in the codebase (`Client`, `Job`, `Invoice`, and the leads model from the Leads v1 parity work — check `DataStore.swift` for the property names: `store.clients`, `store.jobs`, `store.invoices`, and the leads array; use the EXACT model/property names that exist).
   - Header row = the model's field labels (human-readable English: e.g. for clients: id, name, address, phone, email, rate, notes, key code, pet instructions — match the fields that exist on the model). Escape: wrap fields in double quotes, double embedded quotes, strip newlines inside fields. `\r\n` row endings. No BOM needed on iOS (ShareSheet handles it; UTF-8 is fine).
2. EDIT `SettingsView.swift`:
   - Add a `SectionHeader("Data")` + rows block between the Booking section and the About section (match existing row styling, e.g. `BookingLinkRow`-style rows or `settingsLinks`-style navigation rows; use plain button rows with a Label + chevron/share icon).
   - Four rows: "Export Clients", "Export Jobs", "Export Invoices", "Export Leads" (leads row only if the leads store exists; check the codebase — if leads exist on iOS, include the row).
   - Each row: build the CSV synchronously from `DataStore` (access via the environment object the view already has — check how SettingsView accesses the store; it may need `@EnvironmentObject var store: DataStore` added if not present), write to a temp file (`FileManager.default.temporaryDirectory.appendingPathComponent("mowgo-clients.csv")` etc., overwriting), and present a share sheet via `ShareLink(item: fileURL)` (SwiftUI, iOS 16+) — or if ShareLink with a file URL is awkward inside a Button, use a `.sheet` with a `UIActivityViewController` wrapper (standard `ActivityView: UIViewControllerRepresentable`). Either is acceptable; prefer ShareLink.
   - IMPORTANT Swift 6 / Xcode 26 strictness (the user's local toolchain is NEWER than CI — CI is Xcode 16): (a) any `Task` property assignment MUST be annotated `Task<Void, Never>` (unannotated `Task { }` infers `Task<(), Never>` and fails on the user's machine); (b) never destructure an awaited `async let` tuple with names that shadow existing locals; (c) actor-isolated property access needs `await` (e.g. `await SupabaseService.shared...`). Keep this code simple: CSV building is synchronous, no new Tasks unless unavoidable.

## Android implementation

### Files
1. NEW `client/android-native/app/src/main/java/com/mowgo/app/data/ExportRepository.kt`:
   - `suspend fun exportClients(): List<Client>` / `exportJobs(): List<Job>` / `exportInvoices(): List<Invoice>` — reuse the EXISTING repository load methods (read `JobRepository`, `InvoiceRepository`, `ClientRepository`/wherever CRUD lives — per project notes, client CRUD is in `InvoiceRepository.kt` and `JobRepository` has `loadClients()`; check the actual code and reuse the real methods). MUST mirror the web role branches: crew users query jobs by `assigned_to = user.id` and clients by `user_id = business_id` (see `client/src/lib/data.js` loadJobs/loadClients role logic) — the same filtering rules apply; crew sees no invoices (RLS owner-only) so an empty list is fine.
   - Demo mode: return the same in-memory demo lists the existing repos return when `SupabaseClientProvider.isConfigured` is false.
   - A `fun toCsv(rows: List<Any>...)`-style helper OR per-type CSV builders: header row + escaped cells (quote fields, double embedded quotes, strip newlines). `\r\n` endings.
2. EDIT `MoreScreen.kt`:
   - Add an "Export data" section (match the existing section style used for Billing/Integrations/About rows) with three rows: "Export Clients", "Export Jobs", "Export Invoices".
   - Each row launches Android's Storage Access Framework: `rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri -> ... }` with filename `mowgo-clients.csv` / `mowgo-jobs.csv` / `mowgo-invoices.csv`. On URI result: `viewModelScope.launch` (or the screen's ViewModel) fetches rows via ExportRepository, builds CSV, writes via `contentResolver.openOutputStream(uri)?.use { it.write(csv.toByteArray()) }`, then show a brief confirmation (Toast or snackbar: "Exported").
   - Loading state per row (disable the row + show a spinner while exporting). Errors: Toast with a message.
   - If MoreScreen has a ViewModel (`MoreViewModel`), put the export logic there; otherwise a small ViewModel or direct coroutine in the composable via `rememberCoroutineScope` — match the existing architecture of the screen.

### Kotlin compile gotchas (ALL of these have broken CI before — respect them)
- No labeled returns inside non-inline lambdas (`return@launch` is a compile error — `launch` is NOT inline). Use if/else.
- NEVER top-level import `androidx.compose.foundation.layout.weight` — `Modifier.weight()` is a RowScope/ColumnScope member; delete such imports.
- `java.time.Instant` needs an explicit import if used.
- Mutable nullable demo lists: wrap with `(demoList ?: emptyList())` before `.map { }`.
- supabase-kt 3.0.1: use `client.from("jobs").select { filter { eq(...) } }.decodeList<T>()` patterns exactly like existing repos; `auth.currentSessionOrNull()?.user?.id` for the user id.

## Done criteria
- iOS: SettingsView gains a Data section; CSV generation is synchronous from the local store; share sheet presents the file; compiles under Swift 6 strict concurrency (Task annotations where needed).
- Android: MoreScreen gains an Export data section; SAF create-document flow; repos reused, no new dependencies added to `libs.versions.toml` (unless truly required — it should NOT be).
- No builds run, no commits, no pushes, no Spanish.
