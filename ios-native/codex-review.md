# MowFlow iOS code review

Scope: static review of `ios-native/MowFlow/`, with supporting checks against
`ios-native/Package.swift`, `ios-native/project.yml`, and the Supabase schema in
`supabase/migrations/001_initial_schema.sql`. Findings are ordered by severity.

## Findings

### Critical — Real-backend creates omit required ownership fields

`NewClientFormView.save()` and `NewJobFormView.save()` construct models without
`userId` (`Views/Clients/NewClientFormView.swift:115-126`,
`Views/Today/NewJobFormView.swift:70-79`). `DataStore.createClient` and
`createJob` then encode those models directly (`Services/DataStore.swift:60-71`,
`134-145`). Because nil optionals are omitted by `JSONEncoder`, the requests do
not contain `user_id`.

The database declares both `clients.user_id` and `jobs.user_id` as `NOT NULL`
and provides no default (`supabase/migrations/001_initial_schema.sql:13-16`,
`29-32`). Therefore creating a client or job against the real backend fails.
The job form also offers a “None” client (`NewJobFormView.swift:31-35`) although
`jobs.client_id` is `NOT NULL`, creating a second guaranteed failure path.

Resolve the authenticated user ID in the service/repository layer and send
dedicated insert DTOs containing `user_id`. Make client selection required (or
change the database contract deliberately). Do not rely on views to populate
ownership/security fields.

### Critical — Updates serialize joined relationship data as table columns

Fetched jobs and invoices contain embedded `clients` relationship objects.
`DataStore.updateJob` and `markInvoicePaid` pass those full domain models to the
generic update method (`Services/DataStore.swift:74-84`, `172-190`), which
encodes every non-nil property (`Services/SupabaseService.swift:294-297`).
For fetched records this sends a `clients` JSON key in a PATCH to `jobs` or
`invoices`; neither table has such a column. PostgREST will reject the update.
This breaks status toggling, rain delay, and potentially local payment updates.

Use operation-specific patch DTOs such as `JobStatusPatch`,
`JobSchedulePatch`, and `InvoicePaidPatch`. Network response models with joined
data should not double as mutation payloads.

### Critical — Payment success is recorded even when server confirmation fails

On PaymentSheet completion, both operations use `try?`
(`Views/Payments/PaymentView.swift:103-112`). A failed
`confirmPayment` is discarded and execution still attempts
`store.markInvoicePaid`, directly marking the invoice paid through PostgREST.
The second error is also discarded. The UI provides no indication that server
state may be wrong.

Only the trusted server/webhook should transition an invoice to paid. Await
confirmation, handle failure visibly, then reload the authoritative invoice.
Never perform the local/direct paid transition after a failed confirmation.

### High — Data loading races authentication and is not refreshed after sign-in

`MowFlowApp` creates `AuthService` and `DataStore` independently
(`MowFlowApp.swift:10-11`). Both start unstructured tasks in their initializers
(`Services/AuthService.swift:24-44`, `Services/DataStore.swift:21`). The store
can fetch before session restoration finishes. `fetchJobs`/`fetchInvoices`
then return empty arrays when no user ID is available, while generic client
fetch proceeds without an explicit user filter
(`Services/SupabaseService.swift:252-274`).

Successful sign-in changes the root view but never calls `store.loadAll()`
(`Services/AuthService.swift:47-58`, `Views/Auth/LoginView.swift:137-143`), so
the app can remain empty until manual pull-to-refresh.

Make authentication/session restoration the prerequisite for loading
user-scoped data. Trigger loading from a single lifecycle coordinator or a
`.task(id: auth.user/sessionID)` and clear the store on sign-out.

### High — Expired persisted sessions are not refreshed on launch

`restoreSession()` restores the refresh token but returns `isAuthenticated`,
which is false when the access token has expired
(`Services/SupabaseService.swift:182-210`). `AuthService` treats that as “no
session” and shows login (`Services/AuthService.swift:28-37`); it never attempts
the available refresh token. Returning users are unnecessarily logged out
after access-token expiry.

Make restoration async and refresh when the access token is expired. Only
report restoration failure after refresh fails, then clear invalid credentials.

### High — Token refresh can recursively await its own task

`refreshAccessToken()` stores its work in `refreshTask`
(`Services/SupabaseService.swift:218-247`). That task calls the shared
`request()` function for the refresh endpoint. If the endpoint returns 401,
`request()` calls `refreshAccessToken()` again (`SupabaseService.swift:342-347`).
The nested call sees the existing `refreshTask` and awaits it, but it is running
inside that same task. This self-await can hang indefinitely.

Disable automatic refresh for auth/refresh requests (or pass `isRetry: true`
for the refresh request), and implement one explicit refresh-and-retry path.
Also do not swallow the refresh error at line 345 before retrying the original
request with an unchanged token.

### High — The Swift package manifest is missing a used product

`Views/Payments/PaymentView.swift:10` imports `StripePaymentSheet`, but
`ios-native/Package.swift:13-15` declares only `StripePayments` as a target
dependency. The XcodeGen file includes both products
(`ios-native/project.yml:30-34`), so builds differ depending on the documented
setup path; using the local package as described in the README can fail with
“no such module StripePaymentSheet.”

Add `.product(name: "StripePaymentSheet", package: "stripe-ios")` to the Swift
package target dependencies and keep one canonical project configuration.

### Medium — Payment submission has no effective reentrancy guard

The Pay button is disabled by `stripe.isLoading`
(`Views/Payments/PaymentView.swift:40-58`), but no `StripeService` method ever
sets `isLoading` (`Services/StripeService.swift:16`, `49-83`). Repeated taps can
create multiple PaymentIntents and attempt multiple sheet presentations.

Own payment state in `PaymentView` (or consistently in `StripeService`), set it
before the first suspension point, clear it with `defer`, and guard against
duplicate submissions.

### Medium — Form errors are collected but never displayed

Both new-item forms assign a local `error` on failure
(`NewClientFormView.swift:25`, `127-135`; `NewJobFormView.swift:21`, `80-88`)
but neither view renders that state. Given the create failures above, users see
an indefinitely open form with no explanation.

Render an alert or inline error and preserve retryable input. Trim required
text before validation; currently whitespace-only names/titles pass.

### Medium — Subscription UI hard-codes the wrong current plan

`SubscriptionView` always marks Free current and Solo/Crew not current
(`Views/Settings/SettingsView.swift:147-180`), regardless of
`auth.user?.tier`. Paid users therefore see inaccurate state and can be offered
an “upgrade” to their existing tier.

Pass the current tier into the sheet and derive each card’s `isCurrent` value.
After checkout, handle the return/deep link and refresh the profile.

### Medium — Currency handling remains inconsistent

Although `Invoice.amountCents` attempts to create integer cents, totals and
several displays still use `Double` and truncate with `Int`
(`Views/Invoices/InvoicesView.swift:16-18`, `74-79`, `118`;
`Views/Components/ReusableViews.swift:23-25`; `JobCardView.swift:40-43`).
Values such as 45.99 display as `$45`, and summing `Double` values can introduce
rounding error. `amountCents` itself constructs a `NumberFormatter` on every
access (`Models/Models.swift:97-105`) and is locale-sensitive despite formatting
an invariant decimal string.

Represent money as integer minor units or decode the database numeric value
into `Decimal`. Use `FormatStyle.currency` for display and a single consistent
type for arithmetic.

### Low — Date-only values do not follow their documented UTC contract

`Job.scheduledDate` claims a UTC date-only contract
(`Models/Models.swift:19-23`), but helpers use `Calendar.current` and
`DateFormatter` without a fixed calendar, locale, or time zone
(`Services/DataStore.swift:195-199`, `231-242`;
`Views/Today/TodayView.swift:13-27`). Around time-zone/daylight-saving
boundaries, “today” and “tomorrow” can disagree with the stated UTC semantics.
The comment is also conceptually misleading: a PostgreSQL `date` has no time
zone.

Choose either a user-local calendar-day contract or a UTC contract, document
it once, and centralize parsing/formatting with a fixed Gregorian calendar and
locale/time zone appropriate to that choice.

## Concurrency and memory notes

The use of `@MainActor` for observable UI services and an `actor` for
`SupabaseService` is a sound baseline: published state is isolated to the main
actor and token state is serialized. No definite permanent retain cycle was
found in this static review.

The initializer-created `Task` instances are nevertheless unstructured and
strongly capture their owners until completion. That is currently bounded by
the requests/timeouts, but lifecycle-driven `.task` work or explicitly owned
tasks canceled on teardown would provide clearer cancellation semantics.
`ChatService.send` is actor-safe, but its public API permits overlapping sends;
the view currently prevents this only through transient UI state. Enforce the
single-flight invariant in the service if other call sites may be added.

## Verification limits

This was a static review. An iOS/Stripe build could not be executed in the
non-macOS review environment. The repository contains no iOS test target in
`ios-native/Package.swift`; focused tests are especially warranted for session
restoration/refresh, mutation DTO encoding, date boundaries, and currency
conversion.
