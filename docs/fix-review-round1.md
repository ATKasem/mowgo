# MowGo Review Fix Round 1 — export + landing fixes

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement the fixes below directly, immediately, in one pass. Do NOT run builds or compilers. Do NOT git commit or push. Do NOT write Spanish.

Repo root: /opt/data/mowgo. Fix exactly the findings below — nothing else. Read the current files first (they contain the code from the previous batch).

## Fix 1 — Web CSV: formula injection, empty-rows headers (client/src/lib/csv.js + client/src/pages/Settings.jsx)

Current `toCsv(rows)` derives headers from `Object.keys(rows[0])` and returns only a BOM when rows is empty. Change to:
- Signature: `toCsv(rows, fallbackHeaders = [])`. `headers = rows.length ? Object.keys(rows[0]) : fallbackHeaders`. ALWAYS emit the header line (even when rows is empty — the file must contain a usable schema).
- In the cell escaper, guard against spreadsheet formula injection: if the string value's first character is `=`, `+`, `-`, or `@`, prefix it with a single quote `'` BEFORE quote-escaping. (Note: `-` only when the whole cell starts with it — a plain `-` alone or a negative number like `-5` should still be prefixed per the standard mitigation; keep it simple and prefix any cell whose first char is in that set.)
- Keep the UTF-8 BOM prefix and `\r\n` line endings.

In `Settings.jsx` `handleExport`, pass per-type fallback headers so empty datasets still export with a schema:
- clients: `['id','user_id','name','address','phone','email','rate','created_at']`
- jobs: `['id','user_id','client_id','client_name','assigned_to','title','scheduled_date','scheduled_time','status','notes','route_order','created_at']`
- invoices: `['id','user_id','client_id','client_name','job_id','amount','status','paid_at','created_at']`
- leads: `['id','user_id','name','phone','email','address','source','notes','status','client_id','created_at','updated_at']`

## Fix 2 — Web: flatten nested objects in export fetches (client/src/lib/data.js)

`fetchJobsForExport()` and `fetchInvoicesForExport()` select with `clients!left(*)`, so each row has a nested `clients` object that serializes as `"[object Object]"` in the CSV. Map rows to flat scalar objects (apply the same mapping to BOTH the demo-mode return and the Supabase return):
- Jobs: `{ id, user_id, client_id, client_name: <nested clients.name or ''>, assigned_to: <or ''>, title: <or ''>, scheduled_date, scheduled_time, status, notes: <or ''>, route_order: <or ''>, created_at }`
- Invoices: `{ id, user_id, client_id, client_name: <nested clients.name or ''>, job_id: <or ''>, amount, status, paid_at: <or ''>, created_at }`
Check the demo data shapes in data.js and map them through the same mapper (demo jobs may already be flat — the mapper must handle both). Do not change loadJobs/loadInvoices/loadClients/loadLeads (the non-export functions).

## Fix 3 — iOS: formula guard + BOM (ios-native/MowGo/Views/Settings/ExportService.swift)

- In `makeCSV`, return `"\u{FEFF}" + <current output>` (UTF-8 BOM so Excel decodes accents).
- In `escaped(_:)`, after flattening newlines, if the value's first character is `=`, `+`, `-`, or `@`, prefix with `'` before doubling quotes.

## Fix 4 — iOS: role-aware export data (ios-native/MowGo/Services/SupabaseService.swift + ios-native/MowGo/Views/Settings/SettingsView.swift)

Current behavior: SettingsView exports `store.clients` / `store.jobs` / `store.invoices` / `store.leads` from DataStore. Problem: DataStore loads jobs with `user_id=eq.<uid>` and clients without business filtering, so a REAL crew member (role == "crew", business_id set) exports empty/wrong data. RLS permits crew to read business clients (`user_id = current_business_id()`) and their assigned jobs (`auth.uid() = assigned_to`); crew cannot read invoices (owner-only).

Fix:
1. Add to `SupabaseService` (actor, uses the existing `request("GET", path)` helper — mirror `fetchJobs()` at line ~395):
   - `func fetchExportProfile() async throws -> UserProfile?` — `profiles?select=*&id=eq.<uid>` (reuse the existing fetchProfile if it already returns the full profile including role + businessId — check first; if it does, skip this).
   - `func fetchExportJobs() async throws -> [Job]` — fetch profile; if `role == "crew"`, query `/rest/v1/jobs?select=*,clients!left(*)&assigned_to=eq.<uid>&order=scheduled_date.asc`, else `user_id=eq.<uid>` (current behavior).
   - `func fetchExportClients() async throws -> [Client]` — fetch profile; if crew, use `businessId` from the profile: `/rest/v1/clients?select=*&user_id=eq.<businessId>&order=name.asc`; else `user_id=eq.<uid>`.
   - `func fetchExportInvoices() async throws -> [Invoice]` — if crew, return `[]` (owner-only data); else current behavior.
2. In `SettingsView.swift`, change the export rows so data comes from these role-aware fetches, with the local store as DEMO/OFFLINE fallback:
   - Keep `ExportService.csv(from:)` pure (CSV building from model arrays — no network).
   - Add an async path: on row tap, run `Task { ... }`; inside: if `SupabaseService.shared.isConfigured` (check how existing code detects demo mode — e.g. `await SupabaseService.shared.isConfigured` or the same guard `loadAll` uses), fetch via the new `fetchExport*` methods and build CSV from the fetched arrays; otherwise (demo/offline) build CSV from the DataStore arrays as today.
   - Loading UX: add `@State private var exporting: String?` (nil = idle, else the row title). While non-nil, disable the export rows; show a small `ProgressView` in the trailing position of the row being exported (extend `ExportRow` with a `loading: Bool` param). On error set `exportError` (existing alert) instead of crashing.
   - Swift 6/Xcode 26 strictness: any `Task` must be annotated `Task<Void, Never>` when assigned; `SupabaseService.shared` is an actor — `await` all its property/method access. The Task body is a good place for `defer { exporting = nil }` but note `exporting` is `@State` — set it back on the main actor (the Task closure inherits MainActor context from the view body; if the compiler complains, wrap the state writes in `await MainActor.run { }`).
   - Keep the same filenames and the same `.sheet(item:)` share flow.

## Fix 5 — Android: formula guard + BOM (client/android-native/app/src/main/java/com/mowgo/app/data/ExportRepository.kt)

- In `csv(...)`, prefix the result with `"\uFEFF"`.
- In `escape(...)`, after flattening newlines, if the value's first character is `=`, `+`, `-`, or `@`, prefix with `'` before quote-escaping.
- Do NOT change the repository data sources (Android repos are already role-aware via the Batch 7.1 fixes).

## Done criteria
- All five fixes applied. No other files touched. No builds, no commits, no pushes, no Spanish.
