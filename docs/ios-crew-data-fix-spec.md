# MowGo iOS Crew Data Fix — role-aware job loading

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement the spec below directly, immediately, in one pass. Do NOT run builds or compilers. Do NOT git commit or push. Do NOT write Spanish.

Repo root: /opt/data/mowgo. Scope: `ios-native/` ONLY.

## Problem
iOS crew members (profiles.role == "crew", business_id set) see empty data app-wide. Root cause: `SupabaseService.fetchJobs()` (ios-native/MowGo/Services/SupabaseService.swift, around line 395) queries `/rest/v1/jobs?select=*,clients!left(*)&user_id=eq.<uid>&order=scheduled_date.asc`. Jobs are created by the OWNER with user_id = owner id, so a crew member filtering by their own uid gets zero rows. RLS permits crew to read jobs where `auth.uid() = assigned_to` (migration 002: "Jobs: crew read assigned"). Web (`client/src/lib/data.js` loadJobs) and Android (Batch 7.1) already branch by role — iOS is the only platform that never got it.

Note: clients fetch on iOS has NO user filter and relies on RLS (crew policy: `user_id = current_business_id()`), so clients already work for crew. Invoices are owner-only by RLS and query `user_id=eq.<uid>` — crew correctly gets []. ONLY fetchJobs needs the role branch.

## Fix
In `SupabaseService.fetchJobs()`:
1. After getting `uid`, fetch the caller's profile to determine role. Use the existing `fetchProfile()` method: `let profile = try? await fetchProfile()` — `try?` is intentional: a transient profile failure falls back to the owner branch (empty-for-crew on a transient error is acceptable; the next load fixes it; never crash).
2. Choose the filter:
   - `profile?.role == "crew"` → `assigned_to=eq.<uid.uuidString>`
   - otherwise (owner, nil profile, nil role) → `user_id=eq.<uid.uuidString>` (current behavior)
3. Build the same path as today: `/rest/v1/jobs?select=*,clients!left(*)&<filter>&order=scheduled_date.asc` — identical to the current query except the filter segment.

Do NOT change: fetchClients, fetchInvoices, fetchProfile, DataStore, or any other file. Do NOT add new methods (the export role-aware methods `fetchExportJobs/Clients/Invoices` already exist and stay as-is — they are used by Settings export only).

## Swift 6 / Xcode 26 strictness
- No new Task properties needed (fetchJobs is a plain async method). No async-let changes.
- `SupabaseService` is an actor — everything stays inside the actor so no `await` issues.
- Match the existing style: `guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }`, then the existing `request("GET", path)` + decode pattern.

## Done criteria
- `fetchJobs()` branches by role with the exact queries above.
- `git diff` shows ONLY ios-native/MowGo/Services/SupabaseService.swift changed.
- No builds, no commits, no pushes.
