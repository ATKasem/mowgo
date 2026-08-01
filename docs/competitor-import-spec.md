# Competitor Import (CSV) — Spec v1

**Status:** 🆕 SCOPED — Aug 1, 2026 (8am action). **Highest-leverage build this month.**
**Why (verified):** Jobber's "Save up to $3,900" promo ENDED Jul 31 (verified on live page Aug 1 07:39Z). QuoteIQ discontinued its free edition ~2 months ago. Both pools of switchers are open NOW. Every competitor exports CSV; MowGo is the only one that can say "switch in 10 minutes."
**Owner:** Dev (Codex-assisted). **Effort:** ~1 day. **Priority:** P0 alongside Booking Link.

## Goal
"New to MowGo? Import your customers in 10 minutes" — upload Jobber/QuoteIQ/Yardbook/Generic CSV → preview mapping → creates clients + optional open jobs + optional invoices.

## CSV columns we accept (auto-detect by header alias)
| canonical | aliases |
|---|---|
| name | client_name, customer, name, full_name |
| email | email, client_email, e-mail |
| phone | phone, phone_number, mobile, cell |
| address | address, street, service_address, address_line1 |
| city | city |
| state | state, province |
| zip | zip, postal, zip_code, postal_code |
| rate | rate, price, service_rate |
| notes | notes, service_notes, instructions, gate_code (merge into notes) |
| next_service_date | next_service, next_visit, scheduled_date, next_job_date |
| job_frequency | frequency, schedule, cadence (weekly/biweekly/monthly → recurrence_rule) |

Unknown columns → ignored with a warning list.

## Endpoints
1. `POST /api/import/preview` (auth) — body: raw CSV text. Returns: detected mapping, row count, first 3 rows rendered, errors (missing name column, >1000 rows cap).
2. `POST /api/import/confirm` (auth) — body: mapping override + CSV. Inserts clients (upsert on email when present), then for rows with next_service_date creates jobs (status scheduled, recurrence from frequency), then optional unpaid invoices (amount = rate) — **default: skip invoices** (money first = friction; invoice on first completion).
3. Returns per-row result summary: `{clients: n, jobs: n, skipped: [{row, reason}]}` — client-side renders "X imported, Y skipped" + download of skipped rows.

## Client
- Route `/import` (from dashboard empty-state + nav: "Import customers").
- Step 1: drag-drop / paste CSV (client-side parse with PapaParse — already in Vite ecosystem; ~1 MB max).
- Step 2: column mapping UI (auto-detected, user-adjustable dropdowns).
- Step 3: confirm → progress → result screen.
- Marketing copy on page: "Switching from Jobber? Bring your customers with you. No data lock-in."

## Guardrails
- Auth required (owner only). RLS unchanged (inserts via CF function with service key, `user_id` stamped from verified JWT — same pattern as checkout-subscription.js).
- Hard cap 1,000 rows / 5 MB per import; batch inserts (100/req).
- Name column required; email optional (dedupe key when present).
- All inserts in one Supabase transaction per batch; on failure, report row index + error and continue (no partial silent loss).

## Go-to-market (parallel, Aug 3–7)
- Post A/B/D from `marketing/jobber-promo-expiration-2026-07-29.md` (manual, blocked on Aaron).
- `/switch` landing page: "Jobber promo over? Flat $39. Import in 10 min." (1 page, static, links to /import after login).
- QuoteIQ-alternative angle for free-tier refugees.

## Test plan
1. Fixture CSVs: Jobber export, QuoteIQ export, hand-made generic (with/without email, missing name rows, dates in mm/dd/yyyy and yyyy-mm-dd).
2. Idempotency: re-running same CSV with emails → upsert, no dupes.
3. Cap enforcement: 1,001 rows → rejected with clear message.
