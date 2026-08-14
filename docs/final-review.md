You are a senior code reviewer performing a READ-ONLY final cumulative review. You MUST NOT edit files, run builds, or load approval-gating skills.

Scope: the FULL uncommitted working-tree diff vs HEAD in /opt/data/mowgo for:
- client/src/pages/Landing.jsx, client/src/pages/Settings.jsx, client/src/lib/data.js, client/src/lib/csv.js, client/src/i18n/locales/en.json, client/src/i18n/locales/es.json
- ios-native/MowGo/Views/Settings/SettingsView.swift, ios-native/MowGo/Views/Settings/ExportService.swift, ios-native/MowGo/Services/SupabaseService.swift
- client/android-native/app/src/main/java/com/mowgo/app/data/ExportRepository.kt, client/android-native/app/src/main/java/com/mowgo/app/ui/screens/more/MoreScreen.kt, client/android-native/app/src/main/java/com/mowgo/app/ui/screens/more/MoreViewModel.kt

Get the diff: git diff HEAD -- <paths> (and read new files in full).

Feature summary: (1) Landing page offer copy (hero guarantee line, Solo card bonus kit + guarantee + scarcity, guarantee band under pricing grid, en/es i18n). (2) Data export: web Settings CSV downloads (clients/jobs/invoices/leads) with role-aware queries (crew: assigned_to jobs, business_id clients, no invoices) and CSV injection/BOM/header handling; iOS role-aware export via SupabaseService fetchExport* with DataStore demo fallback, share sheet; Android export via ExportRepository (reuses role-aware repos) + SAF CreateDocument.

This is the FINAL gate before shipping. Focus ONLY on:
1. Correctness of the role-aware data paths (crew vs owner) across all three platforms — verify against the RLS policies in supabase/migrations/002_crew_features.sql (crew read: jobs auth.uid()=assigned_to, clients user_id=current_business_id(); invoices owner-only).
2. CSV correctness: BOM, escaping, formula injection guards, headers on empty rows, no [object Object].
3. State/UX: loading flags, disabled states, error surfaces, no stuck UI, demo-mode behavior.
4. Platform compile risks: Swift 6/Xcode 26 (Task<Void,Never>, actor awaits, @MainActor), Kotlin gotchas (no labeled returns, no top-level weight import, supabase-kt 3.0.1), JSX balance, lucide imports, i18n keys present in BOTH en.json and es.json with no TODO_ES, JSON validity.
5. The landing copy matches the offer intent: bonuses (3 items, $278 total), guarantee tied to usage actions, honest scarcity, no AI mentions, no pricing changes.

Output: one line per finding: SEVERITY | file:line | issue | one-line fix. Then verdict: counts + SHIPPABLE / NOT SHIPPABLE. Only report verified findings.
