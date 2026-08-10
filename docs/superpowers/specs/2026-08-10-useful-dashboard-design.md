# Useful Dashboard Design

## Goal
Turn the authenticated web Dashboard into a small lawn-care operator's morning command center: show today's work, permanent local weather context, risks, money to collect, and direct next actions.

## Scope
Web Dashboard only. Do not modify iOS or Android. Reuse existing Today, Clients/Leads, Invoices, rain-delay, and job-edit routes and loaders.

## Layout
1. Header: Dashboard title and local date.
2. Permanent weather banner: current temperature/condition plus a compact multi-day forecast when available. It remains visible in loading, unavailable, no-location, and loaded states. It must explain the state and link to Settings when business location is missing. Rain-risk action content is conditional and links to the existing Today rain-delay flow.
3. Today command card: today's job count, completed/in-progress counts, completed revenue, next scheduled job, client/address/time, and primary link to Today. Empty state offers Add a job and Today.
4. Needs Attention queue: only actionable items, in priority order: rain decision, overdue invoices, new leads, jobs needing confirmation if that state exists, and unfinished work. Each item has a direct route/action. If empty, show a positive "Nothing needs attention" state.
5. Money to collect: total unpaid, overdue amount/count, due-this-week amount/count, and link to Invoices. Do not invent aging if invoice dates are unavailable; show only facts derivable from existing fields.
6. Upcoming jobs: next few scheduled jobs with date/time/client/status and link to Today or the job workflow.
7. Compact supporting metrics: weekly scheduled jobs/revenue and clients serviced/recurring clients, demoted below actionable content. Rename metrics when the underlying calculation is narrower than the label.

## Behavior
- Permanent weather banner is never hidden merely because the forecast is clear.
- Weather failure must not block the rest of Dashboard. Show a useful unavailable state and retry/settings action.
- Dashboard data errors remain visible with Retry.
- All cards containing a number or status must have a meaningful destination or explicit non-interactive treatment.
- Owner dashboard retains revenue and business data privacy. Crew dashboard remains assigned-work-only.
- Preserve existing dark-first theme and English/Spanish locale parity.
- Use local calendar dates consistently.
- No charts, lead scoring, kanban, SMS, or unrelated refactors in this batch.

## Acceptance criteria
- An owner can identify the next job and open today's route without navigating through a metric card.
- Weather context is always visible with correct loading/no-location/unavailable/loaded states.
- A rain-risk day exposes affected-job count and a direct Review rain delay action.
- Unpaid invoices expose amount and a direct invoice workflow.
- New leads expose count and a direct Leads workflow when leads are available.
- Upcoming jobs are visible without opening Today.
- Empty states explain the next useful action.
- Crew users do not see revenue, invoices, or owner-only business metrics.
- Focused tests cover dashboard metric/action derivation and key empty/error states; Vite build passes.

## Files likely involved
- `client/src/pages/Dashboard.jsx`
- `client/src/lib/dashboard-metrics.js`
- Existing weather/data helpers and locale files as needed
- Focused dashboard tests under the existing client test convention

## Verification
Run focused dashboard tests, locale parity validation if locale copy changes, and `npm run build` from `client/`. Review the final diff for scope and privacy regressions before deployment.
