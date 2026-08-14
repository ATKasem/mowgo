# MowGo Hormozi Product Audit — 2026-08-06

Method: live-site walk (mowgoapp.com — landing, pricing, guarantees, compare table, Jobber live pricing re-verified) + full codebase audit (client funnel + money-model/backend, two read-only passes) + every finding mapped to the hormozi skill section.

---

## Verdict: STRONG BONES, THREE BROKEN JOINTS

The offer stack and guarantee are textbook. The funnel has no activation engine. Annual billing is broken in production for the two main tiers. Fix those three and the model runs.

---

## ✅ What PASSES (don't break it)

| Finding | Evidence | Hormozi § |
|---|---|---|
| Money-model sequence exists: Free (attraction) → Solo $39 → Crew $79 → Premium $199 | Landing.jsx plans array | §23 |
| Route-audit lead magnet LIVE (anonymous, captures name/email/ZIP/lawn count, branded report email via Resend, stored in route_audits) | functions/api/route-audit.js | §26 Problem-Solution Bridge |
| Rain-Proof Guarantee = Win-Your-Money-Back, verbatim mechanics ("30 days, 10 invoices, 5 recurring clients → refund first month") | Landing.jsx:463 | §23/§27 |
| Real capacity scarcity ("Concierge setup limited to 20 new businesses per week") | Landing.jsx:38 | §26 |
| Annual = 2 months free (16.7% off — in Hormozi's 16-17% band) + "unused months refunded" risk reversal | Landing.jsx annualPrice fields | §3/§24 |
| $278 launch kit bonus stack — math VERIFIED ($150 done-for-you + $49 pricing report + $79 template pack) | Landing.jsx:33-37 | §23 bonuses |
| Tier spread 39 → 79 (2x) → 199 (5.1x) — in the 5-11x guidance band | Landing.jsx:24-58 | §29 |
| Invoice money-flow is solid: server-side rate truth (client cannot set amounts), idempotent, SECURITY DEFINER RPC | migrations/023_*.sql | §23 continuity backbone |
| H1 = pain hook in the operator's words ("Rain on Tuesday. Eight clients to rebook. One tap fixes it.") | mowgoapp.com live | §9 |
| Concierge = the hands-on onboarding play, exists | functions/api/concierge*, admin/concierge.js | §24 |

---

## 🔴 CRITICAL (revenue-critical, fix first)

### 1. SOLO/CREW ANNUAL BILLING IS BROKEN IN PRODUCTION
`STRIPE_PRICE_SOLO_ANNUAL` and `STRIPE_PRICE_CREW_ANNUAL` are referenced in checkout (`checkout-subscription.js:50-51`), the webhook (`webhook.js:188-189`), and `server/index.js:49-50` — but **missing from server/.env**. Checkout returns **500 "Price ID not configured"** if empty (line 56). The annual plan is the primary CAC-recovery + retention tool (§3 annual-plan tactic, §42 30-day payback rule) and it's dead for the two tiers that matter.
**Fix:** create the two Stripe price objects (or find them — see bottom of this doc) and add the env vars. 5 minutes.

### 2. ZERO ACTIVATION ENGINE (the #1 lever, unused)
Hormozi's SaaS playbook: onboarding is THE lever — "your next step: book your onboarding call" as an atomic bomb, hands-on setup, watch over their shoulder, activation = first job scheduled + first invoice. MowGo has:
- **No onboarding wizard/checklist** — new user lands on a Dashboard of four $0/0 stat cards, no CTAs (Dashboard.jsx:111-117)
- **No welcome/activation emails** — no day-1, day-3, day-7 sequence anywhere (only route-audit + invite-crew emails exist)
- **No "book your onboarding call"** — concierge is opt-in, buried in Settings (Settings.jsx:330-336), free users never see it
- **Client form = 10 fields** for the first-ever client (constants.js:70) — progressive disclosure missing
- **Job form requires an existing client** — circular dependency: can't schedule a job until a client exists, client lives on another tab, no inline "create client" (NewJobForm.jsx:19-22)
- **No demo data for real users** — demoData.js only fires in demo mode
- **No activation tracking** — first client / first job / first invoice are not timestamped anywhere; §24 says verify activation correlates with retention; you can't optimize what isn't measured
**Fix:** 3-step first-run overlay (add client → schedule job → mark complete) + concierge CTA on first login + 3-email activation sequence + first-client form trimmed to 3 fields + inline client creation in job form + activation timestamp columns.

### 3. NO DOWNSEL — EVERY CANCEL GOES TO $0
`customer.subscription.deleted` → tier = 'free', instantly (webhook.js:66-71). No Crew→Solo path, no pause, no reduced winter tier, no win-back. §23: downsell is the third leg of the money model ("change terms or features, never just lower value"); a churning $79 crew should be offered $39 solo before they vanish; a cancelled user should get a win-back sequence (§6 reactivation: 20-30% of revenue is reactivation money).
**Fix:** cancellation → offer downgrade to Solo + 90-day pause (seasonal); cancelled → 2-email win-back (Hormozi framing: "we made a mistake" / "I owe you").

---

## 🟡 HIGH (revenue leakage)

### 4. FREE-TIER 5-CLIENT CAP IS CLIENT-SIDE ONLY
data.js:544,569 checks the cap; **Supabase RLS allows unlimited inserts** — a savvy user bypasses it, and the "Upgrade to Solo" prompt is a raw error with no upgrade modal at the moment of the cap (§23 upsell at the moment of pain).
**Fix:** DB trigger/RPC check + upgrade modal on the 6th client attempt.

### 5. PREMIUM "PRIORITY" CONCIERGE IS FAKE
Premium promises "priority concierge setup" (Landing.jsx:49) but all tiers share one pending queue (admin/concierge.js:62) — no priority logic. Premium is the anchor tier (§29: go high enough); a fake promise on it poisons trust → negative WOM (5-37x). Either make the queue real (Premium jumps the line, 48h SLA) or drop the word "priority."

### 6. NO REFERRAL PROGRAM
Zero referral code. For a hyper-local service business this is the #1 acquisition channel (§49: "customers ask at the moment of purchase, three-way intro"; §27: zero-cost upsells). The partner-bonus outreach spec exists; in-app referral (free month per referral) is unbuilt.

### 7. NO SEASONAL BILLING FLEXIBILITY
Monthly-only billing fights the lawn calendar (§24: align billing cycle with value cycle; add quarterly/annual; test removing monthly). Annual is broken (#1); no winter pause. Oklahoma crews will cancel in November rather than pause.

---

## 🟢 MEDIUM (credibility + measurement)

### 8. TRIAL / GUARANTEE NUMBER MISMATCH
Code: 14-day trial (checkout-subscription.js:59). Marketing: "30 days" appears in guarantee copy. Different things (trial vs money-back), but the numbers must not blur (§41: state the facts). Make the FAQ say "14-day free trial + 30-day money-back guarantee" explicitly.

### 9. COMPARE TABLE LABELS JOBBER GROW AS "CONNECT"
Live Jobber pricing (verified 2026-08-06): Grow 1-user = **$139/mo**, +$29/user; Connect ≈ $99. The table says "Jobber Connect $139" — the $139/$197 math is right, the plan name is wrong. Fix label → "Jobber Grow" (and the reel/fb content wording "Jobber charges $29/mo per extra crew member" stays true).

### 10. "<1% of your revenue" STAT HAS NO PUBLISHED MATH
Solo $39 < 1% implies ≥$3,900/mo revenue. Probably true for a full-schedule crew — but the suffix should show the math (fact-lock rule).

### 11. NO ACTIVATION ANALYTICS
tier_events logging exists (great) but zero product analytics on top; no first-client/job/invoice timestamps. §42: track LVR weekly, segment by channel and avatar.

### 12. REVIEW ASK FIRES ONLY AT 10 JOBS
§9: ask mid-value after wins — first invoice paid, 3rd job, rain-save moment. ReviewPrompt is well-built (10-job trigger, once-only, dismissible) — add earlier touchpoints + referral ask.

### 13. ROUTE-AUDIT NURTURE NOT WIRED
Route-audit report email fires; the nurture sequence (route-audit-nurture-sequence.md spec) — verify follow-up emails are deployed.

---

## 📋 TOP 10 FIX LIST (ranked)

| # | Fix | Effort | § |
|---|---|---|---|
| 1 | Add Solo/Crew annual Stripe price IDs to server/.env | 5 min | §42 |
| 2 | First-run 3-step activation overlay + concierge CTA on first login | ½ day | §24 |
| 3 | Activation email sequence (day 0/3/7) via Resend | ½ day | §24 |
| 4 | Upgrade modal on 6th client + server-side cap enforcement | ½ day | §23 |
| 5 | Crew→Solo downsell + 90-day pause on cancel | ½ day | §23 |
| 6 | 2-email win-back on cancellation | 2h | §6 |
| 7 | In-app referral (free month per referral) | 1 day | §49 |
| 8 | Real premium priority queue + seasonal pack content | ½ day | §29 |
| 9 | Activation timestamps (first_client_at, first_job_at, first_invoice_at) | 2h | §24/§42 |
| 10 | Fact-locks: Jobber "Grow" label, <1% math, 14-day trial wording | 1h | §41 |

---

## Stripe price check (annual IDs)
server/.env confirmed to contain: STRIPE_PRICE_SOLO, STRIPE_PRICE_CREW, STRIPE_PRICE_PREMIUM, STRIPE_PRICE_PREMIUM_ANNUAL, STRIPE_TRIAL_DAYS. **Missing: STRIPE_PRICE_SOLO_ANNUAL, STRIPE_PRICE_CREW_ANNUAL** (the checkout 500s on annual for Solo/Crew).
The API key is restricted (no price-list permission) so existence of the price objects couldn't be verified remotely — check the Stripe dashboard:
1. Open https://dashboard.stripe.com/products — search "Solo" and "Crew"
2. If a **yearly/390** price object exists for Solo and a **yearly/790** for Crew, copy their `price_...` IDs
3. If they don't exist: Products → Solo → Add price → one-time/annual $390/yr; same for Crew $790/yr
4. Paste into /opt/data/mowgo/server/.env:
```
STRIPE_PRICE_SOLO_ANNUAL=price_xxx
STRIPE_PRICE_CREW_ANNUAL=price_xxx
```
5. Redeploy functions (functions/api/stripe/checkout-subscription.js reads it) — annual checkout then works.

