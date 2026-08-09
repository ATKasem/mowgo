# MowGo Concierge Organizer — auto-cleaner layer (v1, deterministic rules)

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement directly, immediately, in one pass. Do NOT run builds. Do NOT git commit or push. For es.json new keys: value `TODO_ES` (coordinator translates after).

Repo root: /opt/data/mowgo. Add a deterministic "organizer" cleaning layer on top of the existing CSV parser, in BOTH copies (client + server), and surface what it fixed in the previews and import results.

## 1. Client — `client/src/lib/csv-import.js`
Add and export `export function cleanClientRows(rows)` (rows = the parser's `{name, address, phone, email, rate}` objects). Returns `{ rows, cleaned, duplicates }`:
- `rows`: the cleaned array (same shape, all strings; `rate` stays a string here).
- `cleaned`: count of rows where at least one cell was changed by rules below.
- `duplicates`: count of rows removed as duplicates.
Rules, applied per row in order:
1. **Trim/collapse** every cell (trim + collapse internal whitespace runs to one space).
2. **Placeholder removal:** if a cell (case-insensitive, trimmed) matches `^(n\/?a|n\/?a\/?n|unknown|\?|none|-+|tbd|missing|not sure)$` → set to `''`.
3. **Phone normalization:** strip all non-digits from the phone cell. If 10 digits → format `(XXX) XXX-XXXX`. If 11 digits starting with `1` → drop the leading 1, then format. Otherwise keep the raw stripped digits as-is (do not drop the value).
4. **Rate parsing:** if rate is non-empty and not purely numeric, extract the first number: `String(rate).match(/\d+(?:\.\d+)?/)` → that number string; if no match → `''`. (Keeps "$45.00/wk" → "45", "45" → "45".)
5. **Email sanity:** if the email cell is non-empty and fails `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, leave it but do NOT count as cleaned (reporting comes from the parser errors path — do not invent emails).
6. **Split name+address:** if `address` is empty AND `name` contains a comma → split on the FIRST comma: name = left part, address = right part (both trimmed). Count as cleaned.
7. **Phone embedded in name:** if `phone` is empty AND the name cell contains a 10-digit run (regex `\b\d{10}\b` or an 11-digit run starting with 1) → extract it as the phone (normalized per rule 3) and remove it from the name. Count as cleaned.
8. **Dedup:** key = `name.toLowerCase() + '|' + address.toLowerCase()`; if key seen before, drop the row (count as duplicate). Second key: if phone is non-empty, also drop a later row with the same normalized phone AND same name (case-insensitive). Keep first occurrence.
Do NOT modify `parseClientCsv` behavior or its exports. Keep the new function pure.

## 2. Server — `functions/api/admin/concierge.js`
- Add the SAME cleaner (identical rules — copy the logic; keep it as a local function next to `parseCsv`).
- In the `import` action: after `parseCsv`, run the cleaner. Import `cleaned.rows`. Response gains `cleaned` (count) and `duplicates` (count) alongside the existing `created`, `clients`, `skipped`.
- The 500-row cap applies to the PARSED rows (before cleaning) — unchanged.

## 3. Client preview — `client/src/components/ConciergeSetup.jsx`
- The preview table + valid-row count should reflect the CLEANED rows (run `cleanClientRows` after `parseClientCsv`).
- Add a small green line under the preview when `cleaned > 0` or `duplicates > 0`: `We'll organize your list automatically: <N> rows tidied up, <M> duplicates removed.` (i18n key, en + es TODO_ES).
- The submitted `csv_content` stays the RAW text (the server cleans authoritatively).

## 4. Admin tool — `client/src/pages/AdminConcierge.jsx`
- In the import result line, add the organizer stats: `Created X clients. Skipped Y rows. Organized Z rows. Removed W duplicates.` (English literals, admin page has no i18n).

## 5. i18n
Add the preview line key(s) to the `concierge` namespace in `en.json` + `es.json` (es = `TODO_ES`).

## Done criteria
Exactly: `client/src/lib/csv-import.js`, `functions/api/admin/concierge.js`, `client/src/components/ConciergeSetup.jsx`, `client/src/pages/AdminConcierge.jsx`, `en.json`, `es.json`. No builds, no commits, no pushes, no real Spanish.
