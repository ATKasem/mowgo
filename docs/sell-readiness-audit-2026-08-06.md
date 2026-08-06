# MowGo Sell-Readiness Audit — 2026-08-06 (Hormozi + Board + Claude line-by-line)

Method: 3 parallel Claude Code line-by-line reviews (web stack ~14K LOC incl. functions + 37 migrations; iOS 33 Swift files 10.4K LOC; Android 55 Kotlin files 8.8K LOC) + live-site walk (mowgoapp.com 200s) + live prod DB checks (PostgREST) + store API lookups (iTunes/Play) + launch-kit/leads-tracker audit. Board lanes per saas-advisory-board skill. Full raw reviews: `/opt/data/reviews/claude-web-review.md`, `claude-ios-review.md`, `claude-android-review.md`.

## VERDICT: NOT-YET — web is 1 fix-session from sellable; native apps are not; the selling hasn't started

Hormozi first word: the money model is textbook and the web money-path is genuinely solid — but with **1 account, 0 tier events, 0 route-audit leads** (live DB), you have zero proof. Proof over promise is the game. Rate limiter is not the code anymore — it's the 5-minute annual-checkout test + first 5-10 operators through the funnel.

## ✅ PASSES (verified — don't break it)
- Money model sequence Free → Solo $39 → Crew $79 → Premium $199 (2x/5.1x spread, in Hormozi §29 band) + annual 2-months-free + Rain-Proof Guarantee + capacity scarcity + $278 bonus stack
- Stripe money-path fundamentals solid (all 3 reviews independently confirmed): server-truth invoice amounts, idempotent create_invoice_for_job RPC, $100K cap DB-enforced, constant-time HMAC verification, no secrets in client bundle
- RLS is the real authz boundary (DROP-then-replace policies, revoked PUBLIC execute); free-tier 5-client cap double-enforced (DB trigger + pg_advisory_xact_lock, race closed); booking double-book closed at DB (partial unique index)
- Activation engine SHIPPED today and LIVE in prod: checklist (owner-only), concierge gate, day0/2/7 emails, first_client/job/invoice_at timestamps (columns verified in prod DB)
- Win-back + downsell shipped (webhook.js:302); booking link + leads v1 (quote mode) live; compare page fact-locked with today's verified competitor math
- Prod build passes; landing/signup/book all HTTP 200

## 🔴 BLOCKERS (ranked, all VERIFIED by Claude line-by-line unless noted)

### Money/trust (fix before any aggressive selling — negative WOM is 5-37x)
1. **CRITICAL — Referral "free month" is fake** (web). UI (Subscribe.jsx:73) + earn email promise a free month; `earn_referral_credit` only flips DB rows, `credit_applied` never set, zero Stripe coupon/balance code anywhere. First referrer gets charged full price. Fix: wire real Stripe credit or pull the feature.
2. **CRITICAL — Android never restores a session** (SplashScreen.kt:31). Comment says it: "auth check comes in Batch 2". Every process death = forced re-login. The app feels broken to any returning user.
3. **CRITICAL — iOS: Undo after Done leaves a stray uncollectible invoice** (DataStore.swift:1024-1066). Done auto-creates invoice; Undo doesn't void it; no delete/void path exists anywhere in the app. Fat-finger on the 3-state toggle = permanent bogus invoice.
4. **HIGH — iOS: fake 15-client cap on paid Solo** (NewClientFormView.swift:289-298). App tells $39 customers they're capped and pushes $79; backend + pricing page say Solo = unlimited. Direct chargeback/trust bug on the primary paid tier. One-line fix.
5. **HIGH — Stripe webhook dedups BEFORE processing** (webhook.js:35-113). Transient Stripe/Supabase failure after the dedup insert = event permanently dropped = paid customer stays on free tier forever, no recovery path.
### 6. HIGH — Annual Solo/Crew billing UNVERIFIED (suspected broken)** (checkout-subscription.js:49-57). `_ANNUAL` env vars absent from repo env, no guard checks them, zero references elsewhere, and no human has ever run a logged-in checkout (Day 22). UI markets "2 months free" annual hard. **5-min dashboard check + one real logged-in annual checkout = the gate.**

### 6b. 🔴 NEW (verified 2026-08-06 evening) — Stripe key lacks `customer_write`: first-ever checkout will 500
Live API test with the prod key in server/.env: `POST /v1/customers` → **`more_permissions_required` — "Enabling 'Customers Write' ('customer_write') permissions on this key would allow this request to continue"** (dashboard link in the error: dashboard.stripe.com → API keys → edit permissions). Checkout creates the customer on a user's FIRST checkout (checkout-subscription.js:77-90) → 403 → "Could not create Stripe customer" → 500. Since 0 users exist, this has never surfaced; the "Stripe health check" (probe_stripe.py) only verifies endpoints return 401 for anonymous calls — it cannot catch this. Mobile payments (create-payment-intent) don't use customers — unaffected. Referral credit fix is also gated on this permission (fail-closed code shipped). **Fix: enable customer_write (+ customer balance transactions) on the key, then run the logged-in checkout test. 5 minutes, highest-value action on the list.**

### Broken promises / parity
7. **HIGH — iOS "Route" mode promises drag-to-reorder that doesn't exist** (TodayView.swift:516-524). No DragGesture/onMove anywhere; only auto-alphabetize. Either implement or remove the banner.
8. **HIGH — Android light mode broken on Today/Invoices/Clients/job dialogs** (246 hardcoded MowGoColors.*Dark vs 96 theme-aware). Half-themed app.
9. **HIGH — Zero Spanish on BOTH native apps** (web is fully bilingual en/es). Lawn crews skew Spanish-speaking. Android: no values-es, all hardcoded English; iOS: no .lproj anywhere.
10. **HIGH — Android debug builds default to LIVE Stripe key** (build.gradle.kts:30). Debug build from git can process real charges. Fail loudly instead.
11. **MED — Webhook events `payment.failed` + `rain.delay.applied` are selectable but never fire** (both platforms). Zapier customer configures it, silently gets nothing.
12. **MED — SMS inbound routes by phone number only, single shared Twilio number** (sms-inbound/index.ts:187-229) — cross-tenant misdelivery risk, code acknowledges it. Owner go/no-go.
13. **MED/LOW — Android rain-delay not atomic (partial-failure leaves mixed state, no undo entry); iOS gate/alarm codes cached plaintext in SwiftData (duplicated in jsonData); 1.1MB unsplit bundle on cold-traffic pages; DNS-rebinding TOCTOU (defense-in-depth, caveated).**

## 📊 Selling state (hard numbers, verified)
- Prod DB: **1 profile · 0 tier events · 0 route_audits** — nobody has ever used it
- Outreach: 5 emails, **0 replies** (Day 11); 10 Day-1 SMS drafted, **0 sent** (Twilio A2P in review)
- Launch kit: every submission row "📝 Drafted / Who Submits: Blasian" — **zero executed (Day 26)**; copy is STALE (retired mowgo.pages.dev URL, removed "AI" feature, outdated Jobber math)
- Stores: **iOS lookup = 0 results, Play = 404** — native apps never published; CI only compiles (simulator/artifact), no TestFlight/Play upload step
- Reddit first post: **tomorrow Fri Aug 7 22:21Z** (gated) — the first real launch act
- Concierge e2e: pipeline wired, never carried a real request

## Board lanes (one member per lane; Hormozi first/final word)
- **Nathan Barry (onboarding)** — engine now exists ✓; next: auto-book the concierge call at signup (the atomic bomb), demo data for real users, watch-over-shoulder. 49.4% "training/implementation is the #1 blocker" stat = the wedge.
- **Patrick Campbell (pricing/churn)** — tier spread ✓; annual = the CAC-recovery lever but unverified (#6); no winter pause yet — OK crews will cancel in November rather than pause. Fix annual + add pause before winter.
- **Rob Walling (roadmap)** — core loop complete for solo crews. Next builds: auto-pay card-on-file + review-request text (cheap wins). Do NOT add features until the 13 findings are fixed.
- **Noah Kagan (launch)** — zero launch execution. Rule of 100 is running but the conversion surface is broken (apps unpublished, kit stale/unsent). Reddit tomorrow = first real act; stores + directories = highest-leverage ops.
- **Jason Lemkin (scale)** — deferred, <$1M ARR. **Sam Ovens (community)** — deferred, later stage.

## Hormozi final word
"You're not ready to sell — you're ready to test. The web app is one fix-session from sellable; the native apps are not. With zero customers you have zero proof, and proof is the whole game. Your rate limiter is the annual checkout test and the first 5-10 operators through free — mine them for testimonials while Claude fixes the findings. That's days, not weeks."

## Ranked action list
Build (Claude Code — est. 1-2 days for all): #1 referral credit (fix or pull) → #2 Android session → #4 iOS Solo cap → #3 iOS invoice void → #5 webhook dedup → #7 iOS route text → #10 debug key guard → #11 webhook events → #8 light mode/Spanish (scope) → #12/#13 hardening.
Ops (Aaron, 10-30 min each): annual env check + one logged-in annual checkout → publish apps (TestFlight + Play) → re-fact-lock + execute launch kit → Reddit Fri 22:21Z → SMS after A2P → first free/demo operators for testimonials.

---

# FIX BATCH — SHIPPED 2026-08-06 evening (all 13 findings + verification-pass findings)

All fixes implemented via 5 parallel Claude Code runs (worktree branches), merged to main, deployed. Commits: 83cbcf8, 0141ca0, 5681532, 2d3c0bd, 82351bc, a06dfa6, fa39a0f, 6023e7e.

## Shipped (verified live)
- **Web**: referral credit real (claim-first, fail-closed — gated on Stripe key permission), webhook dedup-after-success, payment.failed dispatch, SMS inbound business scoping, DNS-rebinding dual-resolve, env guards + .env.example, main bundle 1118kB→295kB (route-level lazy), rain.delay.applied fires, functions import-check added to build (caught the missing dispatch-webhook.js CRITICAL before it could ship silently).
- **Migrations applied to prod (verified)**: referrals.applied_at, winback_sent_at, claim_referral_credit, rain_delay_entries table, apply_rain_delay, void_invoice — all live.
- **Edge fn**: sms-inbound redeployed.
- **iOS**: void invoice on undo + Void action + offline queue replay, solo:15 cap removed, real drag-to-reorder, es.lproj 332 keys, gate/alarm codes on-demand + NSFileProtectionComplete, rain sheet respects appearance.
- **Android**: session restore, light-mode theming (0 hardcoded Dark literals), 322/322 es strings, no live key default, atomic rain delay RPC, free-tier upgrade prompt, nudge SMS arg order fixed (verification HIGH).
- **Content**: launch-kit + store copy fact-locked (canonical domain, no AI, verified Jobber/HCP math, native Android, Jobber 3-crew math corrected).

## Verification passes (2nd review loop)
- Web: PASS after fixes → SHIP. Native: NO-SHIP → 4 findings fixed (Android nudge arg order HIGH, iOS offline void queue MEDIUM, 7 iOS es keys LOW, Android snackbar l10n LOW) → pushed 6023e7e.

## 🔴 REMAINING — needs Blasian (15-30 min, THE gate)
1. **Stripe key permissions** (dashboard.stripe.com → API keys → edit): enable **customer_write** (+ customer balance transactions) and **webhook_endpoints** (to add `invoice.payment_failed` to the webhook subscription). Verified: key currently returns `more_permissions_required` on customer create — first-ever checkout would 500. Referral credit is gated on this too (fail-closed until enabled).
2. **Annual price IDs**: confirm STRIPE_PRICE_SOLO_ANNUAL / STRIPE_PRICE_CREW_ANNUAL exist in the CF Pages dashboard (create Stripe yearly prices $390/$790 if missing) — code now logs a named warning if missing.
3. **One logged-in checkout test** (monthly AND annual, real card): the only unproven link (Day 22).
4. **GitHub Actions instant-fail** (all runs fail in 3-5s, two weeks of history): check repo Settings → Actions → General (third-party action policy / runner billing) so iOS/Android CI can compile-verify.
5. Apps publishing (TestFlight + Play) — separate session, needs his Apple/Google accounts.
