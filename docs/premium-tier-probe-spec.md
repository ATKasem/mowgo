# SPEC: MowGo Premium tier ($199/mo) — probe rollout (v2, fact-checked)

**Status:** PROBE — pricing + copy only. NO new features, NO backend schema changes, NO billing logic rewrite. We validate take rate first; feature build-out happens only if ≥10% of eligible signups choose it.

## Verified current state (2026-08-04, checked in code)
- **Stripe:** Solo $39 (price_1TwmrGGwXKVLlr2I2aLpMVHN), Crew $79 (price_1TwFiUGwXKVLlr2InMLdsc6T), Solo annual $390 (price_1U0mp7GwXKVLlr2IJvgQwRF4), Crew annual $790 (price_1U0mqDGwXKVLlr2IWxfgRwTR). No premium product exists.
- **Env:** STRIPE_PRICE_SOLO/CREW in server/.env + Supabase; annual vars in Supabase only. Client reads price IDs from env (lib/payments.js), not hardcoded.
- **Concierge setup ALREADY EXISTS and ships for solo+crew:** Settings.jsx:309-314 — gated `['solo','crew'].includes(profile?.tier)`, "Free setup: we import your clients and pre-schedule your first 30 days", submit → `/api/concierge-submit` → `concierge_requests` table → admin queue (`AdminConcierge.jsx` + `functions/api/admin/concierge.js` CSV parser). Landing.jsx:37 scarcity: "Concierge setup is limited to 20 new businesses per week."
- **Free-trial landing bundle already lists:** "$49 value" What-to-Charge report, "$79 value" template pack (Landing.jsx:34-35).
- **NO AI quoting feature exists** (QuoteIQAlternative.jsx is a comparison page only). **NO marketplace exists** (MowGo positions AGAINST marketplaces — ProBaseComparison.jsx). **AI assistant was REMOVED** — no page may advertise it (en.json has stale "ai_assistant" i18n key — do not use).
- Web = React HashRouter (routes under /#/). Webhook maps price IDs → tiers (webhook.js:149-150).

## What to build (exactly this, nothing more)

### 1. Stripe: new Premium product + price (manual, done by Aaron — Codex does NOT touch Stripe)
- Product "Premium", $199/month recurring. Annual $1,990/yr ($166/mo effective, 2 months free — buy-10-get-2 convention).
- Set env: STRIPE_PRICE_PREMIUM + STRIPE_PRICE_PREMIUM_ANNUAL in Supabase env + server/.env.
- Spec documents price IDs after creation.

### 2. Edge function `functions/api/stripe/checkout-subscription.js` — premium tier mapping
- Extend plan→priceId: `premium` → STRIPE_PRICE_PREMIUM / STRIPE_PRICE_PREMIUM_ANNUAL.
- Validate plan ∈ {'solo','crew','premium'}. Nothing else changes.

### 3. Webhook `functions/api/stripe/webhook.js` — recognize premium price IDs
- Add premium price IDs to known-prices set → tier 'premium' (superset of crew for now; feature gating unchanged).

### 4. Web pricing page (`client/src/pages/Subscribe.jsx`) + landing pricing section
- Add Premium card at $199/mo (annual $1,990 — "2 months free"), positioned ABOVE Crew.
- **Fact-locked copy (ONLY these claims — all verified to exist):**
  - "Everything in Crew"
  - "Priority concierge setup — your clients imported + first 30 days pre-scheduled in 48h" (leverages the EXISTING concierge; premium = priority queue + 48h SLA vs the free 20/wk queue)
  - "Seasonal packs: spring pricing benchmarks, route templates" (existing template pack asset)
  - "Priority text-first support"
  - **DO NOT advertise:** AI quoting (doesn't exist), marketplace (doesn't exist + anti-marketplace positioning), AI assistant (removed).
- CTA: "Start Premium" → same checkout flow, tier=premium.
- NO discounts / no "% off launch" (Chick-fil-A rule). Value-adds only.
- If the free concierge is currently unlimited-ish, do NOT change its gating in this batch — just note premium gets a priority lane/48h SLA.

### 5. Compare page (`client/src/pages/Compare.jsx`) — add Premium column
- Same fact-locked feature set, Premium column added.

### 6. Native apps — DO NOT TOUCH
- iOS/Android keep Free/Solo/Crew. Premium is web-only for the probe.

## Constraints
- Work ONLY in: `client/src/pages/Subscribe.jsx`, `client/src/pages/Compare.jsx`, `client/src/pages/Landing.jsx` (pricing section only), `functions/api/stripe/checkout-subscription.js`, `functions/api/stripe/webhook.js`, `server/` (env fallbacks only). No changes to ios-native/, client/android-native/, supabase/migrations, concierge flow, or tier gating logic.
- No new features implemented. If a copy line can't be verified against existing product, the line is DROPPED, not built.
- No pricing changes to Solo/Crew. No discount mechanics.
- `git diff --check` clean. Brace-balanced. No new deps.
- Report: files changed, per-file notes, price IDs referenced, copy lines used, compile risks, deviations.

## Verification (before commit)
- grep: no "AI assistant" / "AI quoting" / "marketplace" in any touched file's NEW copy.
- grep: premium price IDs referenced via env (STRIPE_PRICE_PREMIUM*), client still reads from env.
- Checkout flow accepts tier=premium end-to-end (web → edge function → Stripe session).
