# Quotes v1 — Scope (Minimal Viable Quotes)

**Status:** 🆕 SCOPED — Aug 1, 2026 (8am action)
**Why:** MowGo has ZERO lead-conversion artifact. Every competitor (Jobber, ServiceTitan, Housecall Pro, MowStack, QuoteIQ) has quote → one-click Approve. This is the biggest structural gap (3–5 days).
**Owner:** Dev (Codex-assisted). **Priority:** after Booking Link (P0) + competitor import; photo proof can ride along.

## Goal (v1)
Owner creates a quote (line items + price) for a client → client gets a public Approve link → approved quote auto-creates a **job** (and optionally an invoice).

## Data model (Supabase — new table `quotes`)
| column | type | notes |
|---|---|---|
| id | uuid pk | default gen_random_uuid() |
| user_id | uuid fk auth.users | owner |
| client_id | uuid fk clients | required |
| title | text | e.g. "Spring cleanup — Emerald Ave" |
| line_items | jsonb | `[{description, qty, rate}]` |
| total | numeric | computed server-side from line_items (never trust client) |
| status | text | `draft → sent → approved → declined → converted` |
| approve_token | text | random 32-hex, URL-safe; the "one-click" key |
| sent_at / approved_at / converted_at | timestamptz | |
| created_at | timestamptz | default now() |

RLS: `user_id = auth.uid()` for owner CRUD. **Public read**: only `id + total + line_items + status` via `approve_token` — implement as a CF Function with the token, NOT an RLS bypass (keep RLS closed).

## Endpoints (CF Pages Functions — new dir `functions/api/quotes/`)
1. `POST /api/quotes` (auth) — create quote; body: client_id, title, line_items. Server computes total, generates approve_token, status=draft. Returns quote.
2. `GET /api/quotes/:id` (auth) — owner view.
3. `POST /api/quotes/:id/send` (auth) — sets status=sent; emails client via Resend (pattern from `server/index.js` invoice email; sender `invoices@mowgo.app`, subject `Quote from MowGo — $X`). Link: `{APP_URL}/quote/{id}?t={approve_token}`.
4. `POST /api/quotes/:id/approve` (**NO auth** — token in body: `{token}`) — validates token, status approved→converted, **creates job** (title, client_id, status `scheduled`, notes = "From quote"), creates invoice (amount=total, status unpaid) and fires the existing invoice email. Idempotent: second approve returns 200 without duplicating.
5. `GET /api/quotes/:id/status` (NO auth + token) — for the public page poll.

## Client (React, `client/src/`)
- New route `/quotes` — list (status chips), create modal (client select + dynamic line items rows), "Send" button.
- Public route `/quote/:id?t=` — read-only quote display + big **Approve ✓** button → success state. No auth needed (token in URL).
- After approve: toast "Job created — find it on your schedule".

## Edge cases (v1 scope cuts)
- ❌ No PDFs, no deposit collection, no signatures, no revisions UI (owner can edit draft only).
- ❌ No quote templates.
- ✅ Approve token: one-time use; regenerate on re-send.
- ✅ Amount math: server-side only; round to 2dp.
- ✅ Allowed origins: reuse `ALLOWED_ORIGINS` pattern (mowgo.pages.dev / mowgo.app).

## Test plan
1. Create quote → total computed correctly (incl. 0-line-item guard).
2. Approve with wrong token → 403; with right token → job + invoice created, idempotent re-approve.
3. Public page renders without auth; owner page 401s without login.
4. Resend after approve → blocked (status guard).

## Effort: 3–5 days (Codex-assisted). Landing order: table+functions (d1) → client list/create (d2) → public approve page (d3) → send email + polish (d4).
