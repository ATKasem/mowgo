# SPEC: Premium tier visibility in native apps (iOS + Android) — parity fix

**Goal:** Make the $199 Premium tier visible and purchasable from the native apps (the surfaces solo operators actually live in), so the take-rate probe measures all three surfaces — not just web signups.

**Why now (Hormozi §29):** 20% of customers buying a 5x tier doubles revenue. The offer is invisible on 2 of 3 surfaces today → probe has a blind spot.

## Ground truth (verified — do not re-litigate)
- **Natives call the SUPABASE edge function** `supabase/functions/create-checkout-session` (NOT the CF function). It currently maps only `solo`→STRIPE_PRICE_SOLO(+_ANNUAL), `crew`→STRIPE_PRICE_CREW(+_ANNUAL); rejects other tiers with 400 `tier must be 'solo' or 'crew'` (line ~81). `free` is coerced to `solo` (line 77).
- **Web premium used the CF function** `functions/api/stripe/checkout-subscription.js` (already supports premium). The Supabase function was NOT updated — premium via natives would 400 today.
- **Stripe prices (live, verified):** premium monthly `price_1U0pZpGwXKVLlr2IxRZn2vpS` ($199), premium annual `price_1U0paRGwXKVLlr2I4T2qobGQ` ($1,990). SOLO_ANNUAL/CREW_ANNUAL env vars already exist in Supabase secrets (set previously for the native annual toggle).
- **iOS plan picker:** `ios-native/MowGo/Views/Settings/SettingsView.swift` — `SubscriptionView` (line 642), shows `SubscriptionPlanCard`s (Free hidden when paid via `showFreeCard`, then Solo, then Crew). Cards call the existing checkout flow (StripeService.createCheckoutSession(tier, interval) → opens Stripe Checkout).
- **Android plan picker:** `client/android-native/.../ui/screens/more/MoreScreen.kt` — `BillingSettingsScreen` (line ~270) renders `BillingPlanCard`s (free/solo/crew) with `subscribe = startCheckout` → `PaymentRepository.createCheckoutSession(tier, interval)`.
- Tier strings are lowercase (`solo`/`crew`/`free`); profile tier is lowercase.
- Native apps have no i18n layer — hardcoded English strings are the established pattern (do not add an i18n system).

## Changes

### 1. Supabase edge function — `supabase/functions/create-checkout-session/index.ts`
- Add `premium: "STRIPE_PRICE_PREMIUM"` to `tierToEnvKey` and `premium: "STRIPE_PRICE_PREMIUM_ANNUAL"` to `tierToEnvKeyAnnual`.
- Update the 400 error message: `tier must be 'solo', 'crew' or 'premium'`.
- Update the header comment block to mention premium env vars.
- No other changes to the function (checkout creation, metadata tier=premium, portal, etc. all reuse existing paths).

### 2. iOS — `SettingsView.swift` SubscriptionView
- Add a **Premium card after Crew** in the plan list:
  - name "Premium", price `$199/mo` (month) / `$1,990/yr` (year), tier `premium`
  - features (fact-locked, exactly these): "Everything in Crew", "Priority concierge setup — clients imported + first 30 days pre-scheduled in 48h", "Seasonal packs: spring pricing benchmarks, route templates", "Priority text-first support"
  - isCurrent = normalizedCurrentTier == "premium" (shows the current-plan state; checkout button disabled/hidden when current)
- The card must use the SAME `SubscriptionPlanCard` component and the same checkout wiring as Solo/Crew (billingInterval state, createCheckoutSession → Stripe URL → open).
- Do NOT add "AI", "marketplace", or any feature that doesn't exist. Do NOT mention the route audit.

### 3. Android — `MoreScreen.kt` BillingSettingsScreen
- Add a **Premium card after Crew** in the plan list:
  - name "Premium", price `$199/mo` / `$1,990/yr`, tier `premium`
  - same 4 features as iOS
  - `currentTier = tier` handling identical to Solo/Crew (current-state + subscribe via startCheckout)
- Same `BillingPlanCard` component + existing checkout wiring. No new dependencies.

### 4. Env vars (NOT code — manual step for Blasian, but document it)
- Supabase Edge Functions secrets need `STRIPE_PRICE_PREMIUM` and `STRIPE_PRICE_PREMIUM_ANNUAL` set (dashboard → Edge Functions → Secrets), same as SOLO_ANNUAL was. The function reads them at runtime; if unset, checkout for premium returns a config error (acceptable fail state — the UI still shows the card).

## Constraints
- No new Gradle deps, no new SPM deps, no new files unless strictly needed (reuse SubscriptionPlanCard/BillingPlanCard).
- iOS: only touch `ios-native/MowGo/Views/Settings/SettingsView.swift` (and StripeService only if the checkout flow needs a premium-specific change — it shouldn't).
- Android: only touch `client/android-native/app/src/main/java/com/mowgo/app/ui/screens/more/MoreScreen.kt`.
- No changes to web, CF functions, server, or migrations.
- Fact-lock: the 4 features listed above are the ONLY premium features that exist (concierge setup + seasonal packs + priority support + everything in crew). No AI quoting, no marketplace, no AI assistant.
- Keep English strings (native pattern). Dark/light theme via existing theme objects.

## Verification
- `git diff --check` clean.
- Swift compiles in the iOS CI workflow ("iOS CI"); Kotlin compiles in "Android Native Build" (CI is the compiler — no local builds).
- Brace/paren balance sweep on edited files.
- Stage ONLY the touched files (unrelated pre-existing working-tree changes stay unstaged).
