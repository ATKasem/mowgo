# Useful Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the web Dashboard into an actionable morning command center with a permanent weather banner, Today command card, attention queue, money-to-collect summary, and upcoming jobs.

**Architecture:** Keep Dashboard as the orchestration page. Add small pure derivation helpers to `dashboard-metrics.js` for deterministic Today/attention/money/upcoming view models, and reuse existing data/weather loaders and routes. Keep owner and crew branches separate so revenue and invoice data never appear in the crew view.

**Tech Stack:** React 19, React Router, Tailwind v4, Supabase data helpers, Open-Meteo weather, existing i18n and Vite build.

## Global Constraints

- Web Dashboard only; do not modify iOS or Android.
- Permanent weather banner remains visible in loading, no-location, unavailable, and loaded states.
- Weather failure must not block dashboard data.
- Reuse existing routes and loaders; no new backend endpoint unless source inspection proves one is required.
- Preserve owner revenue privacy and assigned-work-only crew dashboard.
- Preserve English/Spanish parity for every new string.
- Use local calendar dates.
- No charts, lead scoring, kanban, SMS, or unrelated refactors.
- Do not stage unrelated working-tree artifacts.

---

### Task 1: Add deterministic dashboard view-model helpers and tests

**Files:**
- Modify: `client/src/lib/dashboard-metrics.js`
- Test: the repository's existing dashboard metrics test file, or create `client/src/lib/dashboard-metrics.test.js` if no focused test exists

**Interfaces:**
- `summarizeDashboard(jobs, invoices, now)` remains backward-compatible.
- Add pure helpers with explicit return shapes for the Dashboard page: Today summary/next job, unpaid money summary, upcoming jobs, and attention items. Helpers must accept loaded arrays and optional leads/weather facts rather than querying Supabase.

- [ ] Inspect the existing test runner and data shapes before editing.
- [ ] Add failing tests for: empty day, next job ordering, completed revenue, unpaid totals, available invoice date fields, upcoming jobs excluding completed jobs when appropriate, new-lead attention count, rain attention only when affected jobs exist, and deterministic local-date boundaries.
- [ ] Run the focused test command and confirm the new tests fail for the expected missing helper behavior.
- [ ] Implement only the helpers required by Dashboard, handling null/undefined arrays and malformed optional fields without throwing.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Build the permanent weather banner

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`
- Modify: the existing weather/data helper file only if Dashboard cannot reuse an existing helper
- Modify: `client/src/i18n/locales/en.json`
- Modify: `client/src/i18n/locales/es.json`

**Interfaces:**
- Consume existing business location/weather loader or existing Open-Meteo pattern.
- Produce a weather banner with explicit `loading`, `no_location`, `unavailable`, and `loaded` states.

- [ ] Read the existing Home/Today weather implementations and choose the sharedest safe loader without touching unrelated pages.
- [ ] Render the banner permanently above the operational content. Loading shows a skeleton/label, no location links to Settings, unavailable shows a retry action, and loaded shows current temperature/condition plus forecast strip when data exists.
- [ ] Add rain-risk details only when the forecast and today's jobs support a real affected-job decision; link to the existing Today rain-delay route/action.
- [ ] Add exact English and Spanish locale keys and run the locale parity check.
- [ ] Verify the banner does not prevent stats/jobs from rendering if weather fetch fails.

### Task 3: Replace metric-first owner layout with actionable content

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`
- Modify: `client/src/lib/dashboard-metrics.js` only for missing view-model behavior
- Modify: locale files if needed

**Interfaces:**
- Owner branch consumes the view models from Task 1 and weather state from Task 2.
- Crew branch remains assigned-work-only and keeps its direct Today action.

- [ ] Add Today command card with local date, job counts, completed revenue, next scheduled job, and direct Today link; empty state must offer Add a job or Today.
- [ ] Add Needs Attention queue with direct links/actions for rain decisions, unpaid/overdue invoices, new leads, and other facts available in existing data. Empty state must say nothing needs attention.
- [ ] Add Money to collect with only date/aging facts actually present in invoice records; link to invoice workflow.
- [ ] Add Upcoming jobs preview with local date/time, client, status, and direct Today/job action.
- [ ] Demote existing weekly/supporting metrics below actionable sections and rename any metric whose calculation is narrower than its label.
- [ ] Ensure number/status cards are links only when they lead to a useful workflow.
- [ ] Run focused tests after each coherent section and inspect mobile layout classes for overflow/truncation.

### Task 4: Verification and adversarial review

**Files:**
- No new production files unless findings require fixes.

- [ ] Run focused dashboard tests.
- [ ] Run locale parity validation for EN/ES.
- [ ] Run `npm run build` from `/opt/data/mowgo/client`.
- [ ] Review `git diff` and `git status`; confirm only intended web/spec files are changed and unrelated artifacts are not staged.
- [ ] Run an adversarial review of owner privacy, crew privacy, weather failure, empty data, date boundaries, invoice date assumptions, and mobile overflow.
- [ ] Fix every finding, rerun verification, and report only evidence-backed results.

### Task 5: Commit only the approved dashboard changes

**Files:**
- Only files belonging to this dashboard batch.

- [ ] Stage the exact intended dashboard source, locale, test, and spec/plan files; do not use `git add .`.
- [ ] Commit with a focused message: `feat: make dashboard actionable`.
- [ ] Verify the commit diff and working-tree status. Do not push until the user explicitly asks to push or the prior standing instruction is confirmed for this batch.
