You are a senior code reviewer performing a READ-ONLY adversarial review. You MUST NOT edit any files. Do NOT run builds. Do NOT load brainstorming/spec-driven-development/tdd or any skill that gates on approval.

Scope: the uncommitted working-tree diff vs HEAD in /opt/data/mowgo for these paths only:
- client/src/pages/Landing.jsx, client/src/pages/Settings.jsx, client/src/lib/data.js, client/src/lib/csv.js, client/src/i18n/locales/en.json, client/src/i18n/locales/es.json
- ios-native/MowGo/Views/Settings/SettingsView.swift, ios-native/MowGo/Views/Settings/ExportService.swift
- client/android-native/app/src/main/java/com/mowgo/app/data/ExportRepository.kt, client/android-native/app/src/main/java/com/mowgo/app/ui/screens/more/MoreScreen.kt, client/android-native/app/src/main/java/com/mowgo/app/ui/screens/more/MoreViewModel.kt

Get the diff with: git diff HEAD -- <paths> and git diff HEAD --stat -- <paths>. Also read the new files in full.

What changed (context):
1. Landing page: hero microcopy line, Solo plan card gains a bonus kit (3 bonuses with value tags), a guarantee line, a scarcity line, and a full-width guarantee band under the pricing grid. All strings are i18n keys in landing namespace (en + es).
2. Web Settings: new "Export data" section with 4 CSV download buttons (clients/jobs/invoices/leads), backed by new fetch*ForExport functions in data.js and a csv.js helper (UTF-8 BOM, quoting, CRLF).
3. iOS: ExportService.swift builds CSVs from the DataStore in-memory arrays; SettingsView gains a "Data" section with 4 rows that write a temp file and present UIActivityViewController via .sheet(item:).
4. Android: ExportRepository reuses JobRepository/InvoiceRepository loads; MoreScreen gains 3 export rows using ActivityResultContracts.CreateDocument; MoreViewModel.exportData writes the CSV via ContentResolver.

Rubric — ONLY these dimensions, in priority order:
1. Logic/data-layer bugs: wrong data, wrong filtering, crew-role data leaks (crew must only export their assigned jobs / business clients; invoices owner-only), CSV correctness (escaping, BOM, headers matching rows), demo-mode behavior.
2. State management: race conditions (double-tap, stale state), loading flags, error paths that swallow failures or leave the UI stuck.
3. Security/privacy: data the export includes (photo URLs, Stripe IDs are fine; anything leaking other users' data is a HIGH), any new network calls or permissions.
4. Platform compile risks: Swift 6/Xcode 26 strictness (Task<Void,Never> annotations, actor-isolated access needs await, async-let shadowing), Kotlin compile gotchas (no labeled returns in non-inline lambdas, no top-level weight import, supabase-kt 3.0.1 API usage), JSX tag balance, i18n key presence in BOTH en.json and es.json (no missing keys, no leftover TODO_ES), import correctness (lucide icons exist, Swift/UIKit imports).
5. Consistency with existing code patterns (role branches in data.js, demo fallbacks, Material3/SwiftUI conventions).

Output format: for each finding, one line: SEVERITY (CRITICAL/HIGH/MED/LOW) | file:line | issue | one-line fix. Then a final verdict: count of CRITICAL/HIGH/MED/LOW and whether this is shippable. Do not invent findings — verify against the actual code you read. If you find a claimed issue that is actually fine, do not report it.
