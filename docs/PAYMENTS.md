# Payments

MowGo takes card payments through **Rise Concepts** (MX Merchant platform),
behind a swappable provider layer. Stripe has been removed completely: code,
SDKs, keys and database columns. Until the Rise provider is implemented, card
payments are off and every client shows "Card payments are coming soon."
The 14-day no-card trial and Zelle / Venmo / Cash App payment requests keep
working.

## Two money flows

| Flow | Who pays whom | Settles to |
|---|---|---|
| **Subscriptions** | A lawn-care business pays MowGo (Solo / Crew / Premium, crew seats) | MowGo's platform merchant account |
| **Invoice payments** | A business's customer pays that business | **The business's own merchant account** (`merchant_accounts` row) |

Invoice money must never land in MowGo's account. The provider has to support
onboarding each business as its own (sub-)merchant.

## Architecture

```
web / iOS / Android ──► /api/payments/*  (Cloudflare Pages Functions)
                              │
                              ▼
            functions/api/_shared/payments/
              registry.js        PAYMENTS_PROVIDER (default 'rise') → provider instance (or null)
              contract.js        the interface every provider implements
              providers/rise.js  Rise Concepts — stub, not implemented
              billing-events.js  provider-neutral webhook handling
              http.js            auth, origin check, return URLs, error mapping
```

Rules:

- Nothing outside `providers/` calls a processor's API.
- Apps never handle card data and bundle no payment SDK. They open the
  provider's **hosted pages** (Safari sheet on iOS, browser on Android).
- An invoice is marked paid **only** by the provider's webhook
  (`invoice_payment.succeeded`), after the invoice id, user id, payment id and
  amount all match. Clients never mark card payments paid.
- Hosted-page URLs are checked against the provider's own hosts before they're
  returned to clients.

## Endpoints

All are `POST` with `Authorization: Bearer <supabase access token>` except
`config` and `webhook`. When no provider is live they return
`503 { code: "payments_unavailable" }`.

| Endpoint | Purpose |
|---|---|
| `GET /api/payments/config` | `{ provider, subscriptions, invoicePayments }`, so clients can show "coming soon" |
| `/api/payments/subscription-checkout` | `{ plan, interval, platform? }` → hosted checkout URL. Refuses if already subscribed. No second trial after the in-app trial |
| `/api/payments/billing-portal` | Hosted page to manage card / plan |
| `/api/payments/cancel-subscription` | Cancel at period end (the tier drops when the webhook says so) |
| `/api/payments/merchant-onboarding` | Owner only → hosted page where the business applies for its own merchant account. Creates/refreshes its `merchant_accounts` row (`pending`); approval arrives as a `merchant.updated` webhook event |
| `/api/payments/invoice-link` | `{ invoice_id }` → hosted payment link for the business's customer. One live link per invoice; a new link only if the amount changed, and the provider must cancel the old one |
| `/api/payments/webhook` | Provider webhook. Signature verified by the provider class; dedup via `webhook_events` (`<provider>:<event id>`), recorded only after processing succeeds |

Return pages: web goes back to `/#/subscribe?checkout=success` and `/#/settings`;
native apps go through `/#/portal-return?result=…`, which deep-links into
`mowgo://settings`. Invoice payers land on `/#/payment-complete`.

## Database

Apply both migrations, in order, with `npx supabase db query --linked --file …`.
Both are safe to re-run.

`20261009120000_payment_provider_neutral.sql`:

- `profiles.billing_provider`, `billing_customer_id`, `billing_subscription_id`.
  These are server-only: users can't write them, and the old user-writable
  `stripe_customer_id` grant is revoked.
- `invoices.payment_provider`, `provider_payment_id`, `payment_link_url`,
  `payment_link_amount_cents`
- `webhook_events.provider`
- `merchant_accounts` (one per business). The owner can read their own row;
  only the server writes.
- `get_conversion_kpi()` now uses `billing_customer_id`.

`20261010120000_drop_stripe_columns.sql` drops `profiles.stripe_customer_id` and
`invoices.stripe_payment_intent_id` / `stripe_invoice_id`. It refuses to run if
any value wasn't copied by the first migration.

`20261010130000_merchant_accounts_lookup.sql` makes each provider merchant id
belong to exactly one business (webhook lookups stay unambiguous).

## Merchant onboarding (card payments for each business)

1. Owner taps **Set up card payments** (web Settings, iOS Billing, Android
   Billing). Crew members and demo mode don't see it.
2. `merchant-onboarding` calls `provider.createMerchantOnboarding` and opens
   the provider's hosted application page; the row starts as `pending`.
3. The provider's webhook sends `merchant.updated` (`pending` → `active`,
   `restricted` or `disabled`). Only a row created by step 2 for that provider
   is updated — webhooks can't create rows for arbitrary users.
4. Apps read the status straight from `merchant_accounts` (RLS: own row,
   read-only). Invoice links work only while it's `active`.

## Wiring in Rise Concepts

Ask Rise for:

1. **API docs + sandbox credentials.** Rise runs on Priority's MX Merchant
   platform. Its public developer hub describes a REST "Checkout API" v3
   (Basic auth or OAuth 1.0a; Sandbox and Production environments), recurring
   billing via "contracts" (requires the Invoice App in the MX Merchant
   portal), and webhook notifications. Confirm this is the API for your
   account. **Ask how webhook callbacks are authenticated** — the public docs
   don't say, and the webhook must reject unsigned calls.
2. **Sub-merchant onboarding** so each lawn business is its own merchant and
   invoice payments are paid out to them (fixes the money-routing problem).
3. **Hosted payment page / payment links** with success and cancel redirect
   URLs, and the ability to cancel or expire a link.
4. **Signed webhooks** for payment succeeded/failed and recurring-billing
   events (activated, updated, canceled, payment failed).
5. **Recurring billing:** plans for Solo / Crew / Premium × monthly / yearly,
   seat quantity (Crew add-on), cancel at period end, customer credit
   (referral reward).

Then:

1. Fill in each method in `providers/rise.js`. The plumbing is done:
   `this.request()` (Basic auth, https-only, pinned to `RISE_API_BASE_URL`,
   15 s timeout, errors that never echo response bodies) and
   `planId()` / `planFor()` (MowGo plan ↔ `RISE_PLAN_*`). Each method's
   comment says exactly what it must do and return. `parseWebhook` must
   authenticate the callback and map payloads to the normalized event types,
   including `merchant.updated`.
2. Add sandbox tests to `providers/rise.test.js` (it already covers the
   plumbing with an injected `fetch`).
3. Flip `IMPLEMENTED = true` in `rise.js`.
4. In Cloudflare Pages (Preview + Production) set the `RISE_*` variables
   listed at the top of `rise.js` (`PAYMENTS_PROVIDER` defaults to `rise`). Point Rise's webhook
   at `https://mowgoapp.com/api/payments/webhook`.

Tests: `node --test functions/api/_shared/payments/*.test.js functions/api/_shared/payments/providers/*.test.js`
runs the endpoints,
webhook handling and merchant onboarding against a fake provider, plus the
Rise plumbing.

## App Store note

Selling a digital subscription inside an iOS app normally requires Apple
In-App Purchase. MowGo's review note argues the B2B multi-platform exemption.
Confirm this still holds before re-enabling the iOS Upgrade button with a live
provider. Invoice payments for real-world lawn services are not affected.
