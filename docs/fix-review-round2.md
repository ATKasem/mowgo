# MowGo Review Fix Round 2 — final gate fixes

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement the fixes below directly, immediately, in one pass. Do NOT run builds. Do NOT git commit or push. For es.json, add/replace values with the literal `TODO_ES` — the coordinator translates after you finish. Do NOT write real Spanish.

Repo root: /opt/data/mowgo. Six fixes only.

## Fix 1 — Web CSV: leading-whitespace formula guard (client/src/lib/csv.js)
Current guard: `/^[=+\-@]/.test(normalized)`. Spreadsheets strip leading whitespace/control characters before interpreting formulas, so `\t=cmd()` bypasses it. Change the test to match an optional run of whitespace/control chars before the formula char: `/^[\s\u0000-\u001F]*[=+\-@]/.test(normalized)` (or equivalent). Keep everything else identical.

## Fix 2 — iOS CSV: leading-whitespace formula guard (ios-native/MowGo/Views/Settings/ExportService.swift)
Current guard checks only `flattened.first`. Fix: find the first non-whitespace character (use `flattened.trimmingCharacters(in: .whitespacesAndNewlines).first` — this is only a TEST, do not trim the stored value) and if it is in `"=+-@"`, prefix the ORIGINAL `flattened` with `'`.

## Fix 3 — Android CSV: leading-whitespace formula guard (client/android-native/app/src/main/java/com/mowgo/app/data/ExportRepository.kt)
Current guard checks `flattened.firstOrNull()`. Fix: `if (flattened.trimStart().firstOrNull() in setOf('=', '+', '-', '@')) flattened = "'$flattened"` (trimStart only for the test; prefix the original).

## Fix 4 — Web: profile lookup failure must throw (client/src/lib/data.js)
In `fetchJobsForExport()`, the profile fetch failure currently logs and defaults to the owner query (`if (profileError) console.error(...)`), which silently yields an empty CSV for crew. Make it throw, exactly like `fetchClientsForExport()` does: `if (profileError) throw new Error('Failed to load profile: ' + (profileError.message || 'Unknown error'));`.

## Fix 5 — Landing copy: remove the "AI receptionist" reference (client/src/pages/Landing.jsx + en.json + es.json)
The pricing section microcopy (currently around line 258/274 in Landing.jsx) contains: `Solo costs {{price}} and is built for the 1,140+ Oklahoma crews who don't need a {{competitorPrice}} AI receptionist.` Replace the English text with: `Solo costs {{price}} and is built for the 1,140+ Oklahoma crews who don't need a {{competitorPrice}} enterprise system.` Update the SAME key in `client/src/i18n/locales/en.json` (find the key whose value contains "AI receptionist") and set the corresponding key in `es.json` to `TODO_ES`. Do NOT touch any other copy. (Note: this line is referenced with `{{price}}` and `{{competitorPrice}}` interpolation — preserve both placeholders exactly.)

## Fix 6 — Landing guarantee band: scope to Solo (client/src/pages/Landing.jsx + en.json + es.json)
The guarantee band footer currently reads `Applies to Solo and Crew. No setup fees. No contracts. Cancel anytime.` Change to `Applies to Solo. No setup fees. No contracts. Cancel anytime.` Update the same key in en.json and set the es.json key to `TODO_ES`. The band body ("Use Solo for 30 days...") stays as-is.

## Done criteria
Exactly these six fixes. No other files touched. No builds, commits, pushes, no real Spanish (es.json new values = TODO_ES).
