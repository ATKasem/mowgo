# Leads v1 — Scope (Top of Funnel)

**Status:** 🆕 SCOPED — Aug 4, 2026
**Why:** MowGo has Estimates (quote → approve → job) but no way to capture and track inquiries BEFORE they become clients. Every competitor has a lead pipeline (Jobber, LawnPro, ProBase). The funnel is incomplete: inquiry → lead → estimate → job. Also: 91% of Oklahoma lawn businesses are single-owner ops that track leads in their phone today.
**Owner:** Dev (Codex-assisted). **Priority:** after this ships, Rain Delay v2 is next.

## Goal (v1)

Pros track every inquiry in the **Clients page** (segmented view: Clients | Leads). Leads have a status pipeline, source tracking, notes, and one-tap conversion to a client. The public booking page gets a "Request a quote" mode that creates leads instead of jobs.

## Data model (Supabase — new table `leads`)

| column | type | notes |
|---|---|---|
| id | uuid pk | default gen_random_uuid() |
| user_id | uuid fk auth.users | owner |
| name | text | required |
| phone | text | optional |
| email | text | optional |
| address | text | optional |
| source | text | `booking_link` / `phone` / `facebook` / `referral` / `walk_in` / `other`, default `other` |
| notes | text | optional |
| status | text | `new → contacted → quoted → won → lost`, default `new` |
| client_id | uuid fk clients | set when converted to client |
| created_at / updated_at | timestamptz | default now() |

RLS: `user_id = auth.uid()` for owner CRUD (select/insert/update/delete). **No public RLS insert** — public lead creation goes through a CF Function with the service key (same pattern as booking.js).

## Endpoints (CF Pages Functions — `functions/api/leads/`)

1. `POST /api/leads/public` (**NO auth**) — public "Request a quote" form: body `{name, phone, email, address, business_id}`. Validates: name + phone/email present, phone pattern (US), address max length, business_id is valid UUID and points at an existing profile. IP rate-limit 5/15min (reuse booking.js pattern). Creates lead with source=`booking_link`, status=`new`. Returns `{success: true}`. Fire webhook `lead.created` (best-effort, pattern from webhook-dispatch.js).
2. `POST /api/leads/webhook-fire` — NOT needed; client-side fireWebhook covers it (see data layer).

Owner CRUD goes through PostgREST directly (RLS), like clients — no CF function needed.

## Client (React — `client/src/`)

- **Clients.jsx**: top segmented control **Clients | Leads**. Leads segment: lead cards with name, source chip, phone/email/address lines, status chips, notes, created date. Actions per lead:
  - Status dropdown (new/contacted/quoted/won/lost) — persists immediately
  - 📞 call + ✉️ email buttons (mailto:)
  - **Convert to client** → modal (prefilled name/phone/email/address) → creates client via existing `createClient`, sets lead.status=`won`, links `client_id`, fires `customer.created` webhook (existing event)
  - **Create estimate** → only after convert; opens existing estimate modal with the new client preselected
  - Delete (only for lost/spam, confirm dialog)
- **Lead add modal**: name (required), phone, email, address, source select, notes. Also reachable from the "+" on Clients page header (segments share the header button; when Leads segment active, button adds a lead).
- **Booking.jsx**: add mode toggle at top: **Book now | Request a quote**. Default = Book now (existing behavior untouched). Quote mode shows name/phone/email/address form → POST `/api/leads/public` → success screen "Request sent — they'll get back to you." Add `?mode=quote` URL param support (deep-linkable).
- **Demo mode**: demo leads (2-3, mixed statuses, one booking_link source) mirroring the existing demoData pattern; convert works in-memory.

## Data layer (`client/src/lib/data.js`)

- `loadLeads()` — Supabase select ordered by created_at desc; demo fallback
- `createLead({name, phone, email, address, source, notes})` — insert, status=new; demo fallback
- `updateLeadStatus(id, status)` — partial update; fire `lead.status.updated` webhook (new event)
- `updateLead(id, patch)` — general update (notes etc.)
- `deleteLead(id)`
- `convertLeadToClient(lead)` — createClient + updateLead(client_id, status=won) + fire `customer.created`; return new client
- Add `lead.created` + `lead.status.updated` to `AVAILABLE_EVENTS` in `WebhookSettings.jsx` (web) — iOS/Android event lists updated in parity batches.

## Migration

`supabase/migrations/012_leads.sql` — create table + RLS policies (owner CRUD via `auth.uid()`). No public policies. Apply via Management API if `db push` has issues (see mowgo-dev supabase repair pattern); commit file regardless.

## Edge cases (v1 scope cuts)

- ❌ No lead kanban/drag-drop, no lead scoring, no bulk import UI, no SMS, no assignment to crew
- ❌ No auto-capture on booking abandonment (explicit quote mode only)
- ✅ Duplicate detection: warn (not block) when same phone exists in leads/clients
- ✅ Rate limit on public endpoint (5/15min/IP)
- ✅ Lead status guard: convert only from new/contacted/quoted (not lost)
- ✅ Public endpoint returns 400 with clear field errors, no PII leakage in errors

## Platform order

1. **Web** (this batch) — data layer + migration + CF function + Clients page segment + booking quote mode + webhooks
2. **iOS** (parity batch) — ClientsView segment, LeadStore, quote mode n/a (booking is web), webhook events
3. **Android** (parity batch) — same as iOS

## Test plan

1. Create lead manually → appears in Leads segment, status chips work
2. Public quote mode: valid submit → lead appears under owner's account; rate limit 429 on 6th; bad business_id → 400
3. Convert lead → client created, lead shows won + client_id, webhook fired
4. Delete lead → gone; lost lead cannot convert
5. Demo mode: full flow works offline

## Effort: 2-3 days (Codex-assisted). Landing order: migration+table (d1) → data layer + CF function (d1) → Clients segment + modals (d2) → booking quote mode + webhooks + polish (d3).
