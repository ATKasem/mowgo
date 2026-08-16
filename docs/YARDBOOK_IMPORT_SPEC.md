# Yardbook Import Tool — Build Spec

## Problem
Lawn care operators want to switch from Yardbook to MowGo but the perceived migration cost (re-entering customers, schedules, invoices) blocks them. Greg Graham in Lawntrepreneurs confirmed this: "bonus points if free/cheap" = switching-cost-sensitive, not price-sensitive.

## Solution
A **one-click CSV import** in the MowGo web app that:
1. Accepts a Yardbook CSV export (customers)
2. Maps columns automatically (name, address, phone, email, notes)
3. Shows a preview with field confirmation
4. Bulk-inserts into `clients` table
5. After import, offers guided recurring-schedule setup

## Yardbook CSV Format (confirmed)
- Export via Customers → Export option
- Fields: name, email, phone, address, notes
- **Recurring schedules do NOT export** — must be recreated
- Equipment and invoice exports exist but are lower priority

## MowGo Schema (target)
### clients
| Field | Yardbook CSV | Auto? |
|-------|-------------|-------|
| name | matching column | yes |
| address | matching column | yes |
| phone | matching column | yes |
| email | matching column | yes |
| cleaning_notes | notes column | yes |
| key_code | not in CSV | skip |
| alarm_code | not in CSV | skip |
| rate | not in CSV | user sets default or per-client |
| pet_instructions | not in CSV | skip |
| user_id | from auth session | auto |

### recurring_jobs
| Field | How it's set |
|-------|-------------|
| user_id | from auth session |
| client_id | from imported client |
| title | "Lawn Care" (default, user can change) |
| scheduled_time | user picks |
| duration_minutes | 60 (default) |
| frequency | user picks: weekly/biweekly/monthly |
| days_of_week | user picks |
| is_active | true |
| start_date | today |

## Build Plan

### Phase 1 — CSV Import Wizard (IN PROGRESS)
- File: `client/src/utils/csvParser.js` — pure JS CSV parser with column detection
- File: `client/src/pages/ImportFromYardbook.jsx` — multi-step import wizard
- Route: `/import/yardbook` in App.jsx
- Link: Settings "Data" section → import link
- Client-side only using authenticated user's Supabase session

### Phase 2 — Recurring Schedule Setup (AFTER PHASE 1)
- After import, show a list of imported clients
- For each (or bulk), set: frequency (weekly/biweekly/monthly), day of week, time
- Bulk insert into `recurring_jobs` table
- Integrate as optional step 6 in the import flow

### Phase 3 — Settings Link (AFTER PHASE 1)
- Add import button/link in Settings.jsx "Data" section, next to existing CSV exports
- Or add a "Switch from Yardbook" card in the onboarding flow

## UI Pattern
- Follow existing page conventions (dark mode, Tailwind, mobile-first)
- Use existing `client/src/lib/supabase.js` for DB access
- Use `client/src/components/` patterns (cards, buttons, loading states)
- Import page goes under `RequireAuth` (logged-in users only)

## File Changes

### New files:
1. `client/src/pages/ImportFromYardbook.jsx` — the import wizard page
2. `client/src/utils/csvParser.js` — CSV parsing + column auto-detection

### Modified files:
1. `client/src/App.jsx` — add route `/import/yardbook` with lazy import
2. `client/src/pages/Settings.jsx` — add import link in Data section

## Test Plan
1. Create a mock Yardbook CSV with 3-5 customers
2. Paste into import page → verify preview shows correct column mapping
3. Confirm import → verify rows appear in Supabase clients table
4. Verify RLS: imported clients belong to the authenticated user
5. Edge cases: empty CSV, missing name field, duplicate names, special chars in address

## Success Criteria
- A Yardbook user can export their CSV, paste into MowGo, and have all clients imported in under 2 minutes
- Zero data loss (verified by count comparison)
- Clear next-step offer to set up recurring schedules