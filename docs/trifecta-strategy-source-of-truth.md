# MowGo Trifecta Strategy & Copy Source of Truth

**Version:** 1.0 — 2026-08-09
**Scope:** Strategy, messaging, funnel, activation, retention, concierge, and founder-operating decisions. Translates the Dan Martell + Hormozi (three books: $100M Offers, $100M Leads, $100M Money Models) + Alex Becker trifecta into exact MowGo decisions. This is the single source of truth for all copy, pricing, funnel, and retention claims across Landing.jsx, Compare.jsx, Subscribe.jsx, and concierge docs.
**Pricing anchor (frozen):** Free (5 clients) / Solo $39 / Crew $79 / Premium $199. Annual = 2 months free (Solo $390, Crew $790, Premium $1,990).
**Non-negotiables:** Product-first. No fake claims. English + Spanish locale parity. Web-only in this pass.

---

## 1. OFFER STACK — The "Rain-Proof Launch" (Hormozi §100M Offers, Becker position flip)

### Value Equation (Hormozi §1)
> Value = (Dream Outcome × Perceived Likelihood) ÷ (Time Delay × Effort & Sacrifice)

| Variable | MowGo lever |
|---|---|
| **Dream Outcome** | "Every client shows up on time, invoices are automatic, rain delays handled in one tap." |
| **Perceived Likelihood** | Done-for-you 48h setup + Rain-Proof Guarantee + real operator testimonials (proof-first, §9) |
| **Time Delay** | 48h client import + first operating week prepared. Annual = instant value. |
| **Effort & Sacrifice** | Free tier = zero-risk trial. Concierge = zero setup effort. Solo = $39 flat, no per-user fees. |

### Offer Name (MAGIC framework: Magnetic + Avatar + Goal + Interval + Container)
**"The Rain-Proof Launch"** — hits all five: weather-pain magnetic hook, solo-crew avatar, rain-proof guarantee goal, 48h interval, done-for-you setup container.

### Core Offer Stack (Landing.jsx cards + FAQ)

**Free** — $0/forever, 5 clients
- Daily job scheduling, rain delay suggestions, invoice tracking, dark mode, PWA installable
- **Purpose:** attraction offer (Hormozi §23: "more ways to sell the same thing, not more things to sell"). Free tier IS the lead magnet.

**Solo** — $39/mo ($390/yr, 2 months free) — **highlighted card**
- Everything in Free + unlimited clients & jobs, recurring job automation, GPS route navigation, client notes/codes/pets, offline mode
- **Bonuses ($278 value):**
  1. Done-for-you setup on eligible paid plans: we import your clients and prepare your first operating week within 48h. ($150 value)
  2. "What to Charge in Your City" report: real mow prices from your market. ($49 value)
  3. Template pack: 15 ready-to-send scripts — invoices, reminders, price raises, no-show follow-ups. ($79 value)
- **Availability:** Concierge setup is available on active Solo, Crew, and Premium plans; no numeric scarcity claim is published because capacity is not enforced.
- **CTA:** "Start Free Trial"

**Crew** — $79/mo ($790/yr, 2 months free)
- Everything in Solo + job assignment & tracking, team progress dashboard
- **CTA:** "Start Free Trial"

**Premium** — $199/mo ($1,990/yr, 2 months free)
- Everything in Crew
- Premium concierge priority: active Premium requests are persisted with priority rank 100 and move ahead of standard paid requests in the operator setup queue. All eligible tiers retain the same 48-hour setup target; do not claim a shorter Premium SLA.
- Do not claim priority support or seasonal packs until those behaviors exist.
- **CTA:** "Start Premium"

### Guarantee (Hormozi §27 Win-Your-Money-Back)
**"Rain-Proof Guarantee"** — 30-day money-back. If Solo does not make you more organized in 30 days, we refund your first month in full. Usage-tied: 10 invoices + 5 recurring clients = qualifying threshold. (Ties to user actions to filter refund-abusers, per 100M Offers.)

### Fact-Locks (Hormozi §41 — "state the facts, tell the truth")
1. **Jobber pricing (verified 2026-08-06):** Grow 1-user = $139/mo, +$29/user. Table header must say "Jobber Grow $139/mo" NOT "Jobber Connect."
2. **<1% math:** Solo $39 < 1% implies ≥$3,900/mo revenue. Suffix: "Solo is $39/mo — under 1% for any crew billing over $3,900/mo."
3. **Trial wording:** "14-day free trial. 30-day money-back guarantee." (Two different things — trial is 14 days in code, guarantee is 30 days.)
4. **Annual savings:** "Two months free ($78 off Solo, $158 off Crew)." Math: $39 × 12 = $468; $468 - $390 = $78. Verified.
5. **No "AI" in copy.** Product rule: no AI involvement in the product.
6. **No "pages.dev" in copy.** Only mowgoapp.com.
7. **Concierge capacity:** Do not publish a numeric weekly scarcity claim unless the queue enforces it.
8. **Revenue claim (stats block):** "<1% of your revenue" — verified math above.
9. **556k+ landscaping businesses** — IBISWorld 2026.
10. **Zero per-user fees** — verified against Jobber's $29/user model.

---

## 2. FUNNEL — Outcome-Led, Proof-First (Hormozi §23-24, §49 Core Four, Becker offer-first)

### Primary Hook (Hormozi §9: "pain is the pitch, in their language")
**H1:** "Rain on Tuesday. Eight clients to rebook. One tap fixes it."
**Subhead:** "MowGo — scheduling for lawn crews who'd rather mow than manage."

Becker position flip: Don't sell "scheduling software." Sell **"never miss another double-booked job"** — same product, completely different conversion (Becker Fay52JFEeZ4 formula: NEW + RESULTS + NO EFFORT + PROVEN + GUARANTEED).

### Buyer Awareness Continuum (Hormozi §49 → §30)
1. **Unaware** (most traffic): problem-aware first → category-labeled ("lawn scheduling app")
2. **Problem-aware** → solution-aware ("rain delay in one tap, not a spreadsheet")
3. **Solution-aware** → product-aware ("$39/mo, no per-user fees, works offline")
4. **Most-aware** (returning visitors): direct CTA, comparison page, guarantee

### CTA Path (Landing-page review rubric #7)
Every "Start Free" CTA → `/login?mode=signup` preserving plan intent (sessionStorage → auto-checkout after auth). No dead-end CTAs.

### Competitor Pages as Support (Becker: "funnel simplicity wins")
Compare page is SUPPORTING, not LEADING. One "Compare" nav link. Deep-cut competitor links ("vs Ruunly") waste nav slots. Landing page leads; compare page closes the deal for comparison shoppers.

### Core Four Acquisition (Hormozi §49)
1. **Warm outreach** (past clients/network) — "who do you know?" not "buy"
2. **Cold outreach** — 100 operator DMs/day. "How I run my OKC lawn crew" operator voice beats "How to manage a lawn business" (Hormozi §8: "for you" > "for us")
3. **Free content** — 400+ long-form pieces (Hormozi §30: "think in decades"). Operator stories, pricing reports, scheduling tips. Capture not manufacture.
4. **Paid ads** — never start with ads (Hormozi §49: "ads amplify what already converts"). Master one channel 90 consecutive profitable days. FB/IG first. Rule of 100: 100 min content OR 100 operator DMs OR $100/day ads × 100 days.

### Lead Magnet (Hormozi §26 Problem-Solution Bridge)
**"Free Route Optimizer" / "Free Revenue Calculator"** — reveals scheduling waste. Name formula: Number + Outcome + Timeframe → "3 scheduling mistakes costing lawn crews $500/week." Qualify via jobs-per-week dropdown. CTA with real capacity scarcity: "50 new crews this month, spots filling."

### Seasonal Timing (Hormozi §50: "seasonality = profit opportunity")
- **Spring push** (Mar-Apr): peak acquisition. Ramp ad spend. Launch kit.
- **Summer** (May-Aug): retention + proof-gathering. First case studies.
- **Fall** (Sep-Oct): win-back + downsell. Seasonal billing push.
- **Winter** (Nov-Feb): build systems (concierge SOPs, content library). No seasonal pivots (Hormozi §50: "don't launch snow removal mode").

### Retargeting (Becker: "40-60% of sales come from retargeting")
$1.50 to retarget vs $10 to acquire (Becker 2-GilmsesOo). Six angles:
1. Back to main sales video
2. ROI case numbers
3. "Lawn Scheduling Bootcamp" self-select
4. Brand awareness
5. FAQ/objections
6. "Book a demo" with proof

---

## 3. ACTIVATION — The #1 Lever (Hormozi §24 SaaS AMA, Dan Martell first-run)

### Activation Definition (Hormozi §24)
> "Verify activation correlates with retention before optimizing it."
Activation = first client + first job scheduled + first invoice sent.

### Activation Sequence (from hormozi-fixes-spec — SHIPPED)
1. **Onboarding Checklist** (Dashboard): "Start in 3 steps" — add client → schedule job → mark complete. + "Get set up for you — free concierge" for paid tiers.
2. **Concierge CTA on first login** (paid tiers): auto-book the onboarding call — "your next step: book your onboarding call" = Hormozi's atomic bomb (§24).
3. **Activation emails** (Day 0/3/7 via Resend):
   - Day 0: "Add your first client in 2 minutes" + concierge mention
   - Day 3: Nudge if still no clients
   - Day 7: "We'll set it up for you (free concierge)"
4. **Activation timestamps** (shipped): `first_client_at`, `first_job_at`, `first_invoice_at` — powers analytics.
5. **Upgrade modal on 6th client** (shipped): "You've hit the free limit (5 clients) — unlimited starts at $39/mo."

### Activation Metrics (Hormozi §42: "track LVR weekly, segment by channel and avatar")
- **Activation rate:** % of signups who reach first_client + first_job within 7 days
- **Time-to-first-client:** hours from signup to first client added
- **Concierge conversion:** % of paid users who claim done-for-you setup
- **Retention proxy:** "did they complete both activation boxes?" (§24: use as proxy if churn data is delayed)

### Founder Handoff Boundary (Dan Martell: "Shadow → Supervise → Support")
- **Shadow:** Founder personally runs first 5-10 concierge setups (learn the friction)
- **Supervise:** Document SOPs, hand to agent-assisted tooling
- **Support:** Operate the published 48h turnaround through the existing queue; do not publish a numeric weekly cap until it is enforced.

---

## 4. CONCIERGE — Done-for-You as Competitive Moat (Hormozi §24, Dan Martell onboarding)

### What We Promise (live copy, Landing.jsx)
- "On eligible paid plans, we import your clients and prepare your first operating week within 48 hours."
- "Premium concierge priority — your request moves to the front of the setup queue."
- Concierge is available to active Solo, Crew, and Premium customers.
- No founder-review or numeric weekly-cap claim is published.

### Reality Check (concierge-onboarding-v1-scope.md)
- "We" = Aaron + agent-assisted tooling. Not automated software.
- Software's role: intake, import, tracking (queue), communication.
- Aaron's role: CSV parsing, client import, first-week scheduling, confirmation.

### Turnaround & Queue
- **48h turnaround promise** from submission to setup preparation.
- The `concierge_requests` queue tracks work, but does not enforce a numeric weekly cap.
- Premium requests receive priority rank 100 and sort ahead of active Solo/Crew requests (rank 0); requests are FIFO by creation time within each rank.
- Solo, Crew, and Premium currently share the same 48-hour SLA. Premium priority changes queue order, not the promised turnaround.

### Operating Checklist (concierge-onboarding-v1-scope.md)
1. Intake: capture request + client list (CSV upload or paste, Excel-compatible, tab-aware)
2. Import: bulk insert clients under user's account via existing createClient path
3. Schedule first week: auto-create first job (today + next 6 days, staggered times, with Undo)
4. Mark done → confirmation email to customer

### Concierge Promise ↔ Capacity Audit
| Promise | Capacity | Gap |
|---|---|---|
| "48h turnaround" | Existing intake and admin queue support manual fulfillment | Monitor actual capacity; do not publish a numeric cap |
| "Prepare first operating week" | Admin tooling imports clients and creates first-week jobs | Supported |
| "Premium concierge priority — your request moves to the front of the setup queue" | Submission snapshots the tier/rank; the admin queue sorts active Premium requests ahead of active Solo/Crew requests | Supported; do not claim a faster Premium SLA |

### Premium Positioning
Premium has one verified backend-backed differentiator beyond Crew features: concierge queue priority. Public plan copy may state exactly that a Premium request moves to the front of the setup queue. Do not claim priority support, seasonal packs, a shorter Premium SLA, or a guaranteed completion position relative to other Premium requests.

---

## 5. RETENTION & MONEY MODEL — Continuity Sequence (Hormozi §23 Money Models, §24 SaaS AMA)

### Offer Sequence (Hormozi §23)
| Type | MowGo offer | Status |
|---|---|---|
| **Attraction** | Free tier (5 clients, no card) | Live |
| **Upsell** | Solo $39 / Crew $79 / Premium $199 | Live |
| **Downsell** | Crew → Solo ($79 → $39, change terms not value) | Shipped (webhook.js) |
| **Continuity** | Annual plan (2 months free, unused months refunded) | Code exists, Stripe IDs **UNVERIFIED** |

### 30-Day Profit Rule (Hormozi §23)
> "Gross profit from a customer must cover CAC within 30 days."
- Solo monthly LTV ≈ $39 ÷ 5% churn ≈ $780 gross × ~0.9 margin ≈ $700 → **CAC must stay ≤ ~$230**
- Annual ($390 upfront) pays CAC in one shot, clears 30-day rule trivially.
- Free tier = blended CAC reducer (free→paid conversion is its own KPI).

### Downsell Mechanics (shipped in webhook.js:302)
On `customer.subscription.deleted`:
1. Read user's tier BEFORE setting free (pre-state matters)
2. Set `profiles.cancelled_at = now` + tier='free'
3. If pre-state was 'crew' or 'solo': fire win-back email #1 via Resend
   - **Crew pre-state → downsell framing:** "Don't lose your crew setup — Solo keeps you running at $39/mo"
   - **Solo pre-state → win-back framing:** "We made it easy to come back"
   - **Premium pre-state → same as solo win-back**

### Win-Back Sequence
1. **Immediate (on cancel):** Downsell offer (Crew→Solo) or win-back link
2. **Day 7:** Second email — "Your data is still here. Re-activate anytime."
3. **Day 30:** Third email — "We owe you one" (Hormozi §24: "we made a mistake" framing; 20-30% of revenue is reactivation money)

### Seasonal Pause (Hormozi §24: "align billing cycle with value cycle")
- Oklahoma lawn crews: peak Apr-Oct, slow Nov-Feb.
- **Current gap:** No winter pause. Crews cancel in November rather than pause.
- **Planned:** 90-day seasonal pause option on cancellation (downsell spec, not yet shipped).
- **Annual plan** already addresses this: one payment covers the whole season, no card hits in winter.

### Referral Program
- **Current state:** Referral code generation and earning are wired. The Stripe webhook calls `earn_referral_credit`, atomically claims the earned referral through `claim_referral_credit`, and applies a real Stripe customer-balance credit for one month of the referrer's current paid tier.
- **Operational dependency:** Stripe customer-balance credit application still depends on valid production credentials and webhook delivery; do not describe the credit as applied until the webhook succeeds.
- **Hormozi §49:** "Ask at the moment of purchase, three-way intro." Referral ask fires post-checkout (shipped in Subscribe.jsx).

### ICP Segmentation (Hormozi §24)
- **ICP:** Solo operators, 5-30 clients, Oklahoma/similar markets, $1-3K/mo revenue, no current software or spreadsheet-only.
- **Non-ICP:** 20+ person crews (need enterprise features), already on Jobber with 100+ clients (switching cost too high).
- **MowGo already says "for solo crews, not 20-person ops"** — make this the whole funnel. Segment churn ICP vs non-ICP, target <3-5% monthly.

---

## 6. FOUNDER-OPERATING DECISIONS (Dan Martell "Business That Runs Itself," Hormozi §17)

### Daily Operating Rhythm (Dan Martell: "4-4-4 split = 4h promote, 4h deliver, 4h build")
- **4h promote:** content, outreach, partnerships (Core Four)
- **4h deliver:** concierge setups, customer support, onboarding calls
- **4h build:** product, features, technical debt

### 15-Minute Time Study (Dan Martell §17)
Every recurring decision → if-this-then-that rule + financial authority boxes (under $X act alone, review monthly). Bottom half of time study = delegate.

### Shadow → Supervise → Support Handoff (Dan Martell §17)
1. **Shadow:** Founder runs every concierge setup personally (first 5-10)
2. **Supervise:** Document SOPs, hand to agent-assisted tooling
3. **Support:** Operate the 48h turnaround through the queue dashboard; measure capacity before publishing a cap or SLA.

### Rate Limiter Diagnosis (Hormozi §29)
> "Every business has ONE constraint; direct 100% of effort there."
**MowGo's rate limiter: activation (signup → first scheduled job).** 100% of engineering toward that friction. Not pricing. Not features. Not ads. Activation.

### "It's My Fault" (Hormozi §22)
Whatever you cast blame to is where you cast power to. Zero proof = zero marketing claims. Rate limiter is the annual checkout test + first 5-10 operators through the funnel. That's days, not weeks.

---

## 7. CONTENT STRATEGY — Capture, Don't Manufacture (Hormozi §8, §30, §49)

### Content Principles
- **"How I" beats "How to"** (Hormozi §49: operator voice, not guru voice)
- **Proof over promise** (100 pieces of proof + bad offer beats great offer + no proof)
- **Clear not clever** — grade-level copy, one idea per sentence (Hormozi §8)
- **Content IS the targeting** (interest media: algorithm matches topic → interested viewers)
- **Longs >> shorts** (2h long-form = 480 shorts of reinforcement)

### Content Calendar
- **Daily:** 100 min content OR 100 operator DMs OR $100/day ads (Rule of 100)
- **Weekly:** 1 long-form piece (operator story, scheduling tip, pricing report)
- **Monthly:** 1 case study or before/after revenue screenshot
- **Seasonal:** Spring Blitz, Fall Cleanup campaigns to existing users (98% margin)

### Review Ask Timing (Hormozi §9: "ask mid-value after wins")
- First invoice paid → ask for review
- 3rd job → ask for review
- Rain-delay save moment → ask for review
- 10th invoice → ask for review (existing trigger — add earlier touchpoints)
- **Never ask at signup** — ask after a win.

---

## 8. COPY CORRECTIONS — Contradictions Found in Current Code

### Landing.jsx (Landing.jsx)
| Line | Current | Issue | Fix |
|---|---|---|---|
| 34 | Concierge wording differed between founder review, 30-day scheduling, and first-week preparation. | Resolved: public copy now uses first operating week preparation within 48 hours and identifies it as an eligible-paid-plan benefit where shown to anonymous visitors. | **Resolved in current copy slice.** |
| 49 | Premium: "Priority concierge setup" | All tiers share one pending queue. | **Resolved:** Premium concierge differentiation removed from public plan copy. |
| 62 | Stats: "556k+" with "IBISWorld, 2026" | Verified. No issue. | Keep. |
| 63 | Stats: "<1% of your revenue" | **Audit finding #10: Math not shown.** | Append: "Solo is $39/mo — under 1% for any crew billing over $3,900/mo." |
| 73 | FAQ: "Cancel anytime. 14-day free trial. 30-day money-back guarantee." | **Correct.** Both numbers true. Trial = 14 days in code, guarantee = 30 days. | Already correct after fact-lock fix. Verify it's deployed. |
| 67 | ReferralAsk: "Your next month is on us" | Stripe webhook now earns, claims, and applies a customer-balance credit for one month of the referrer's current paid tier. | **Resolved in code; monitor webhook failures operationally.** |

### Compare.jsx (Compare.jsx)
| Line | Current | Issue | Fix |
|---|---|---|---|
| 12 | Jobber price: "$49–$249/mo" | Verified range. | Keep. |
| 43-58 | Feature matrix | Route optimization marked ✅ for QuoteIQ, Jobber, Yardbook, etc. | Verify each claim against current competitor data (Aug 2026 audit). Route optimization research notes are in the code comments (line 57). |

### Subscribe.jsx (Subscribe.jsx)
| Line | Current | Issue | Fix |
|---|---|---|---|
| 60 | "Your next month is on us" (ReferralAsk) | Stripe customer-balance credit is wired in the webhook; operational delivery still needs monitoring. | Keep the claim only while webhook success and credit application are monitored. |

### Cross-Page Consistency
| Claim | Landing | Compare | Subscribe | Status |
|---|---|---|---|---|
| Solo $39 | ✅ | ✅ ($39/mo) | ✅ | Consistent |
| Crew $79 | ✅ | ✅ ($79/mo) | ✅ | Consistent |
| Premium $199 | ✅ | ✅ ($199/mo) | ✅ | Consistent |
| Annual 2 months free | ✅ ($78 Solo) | ✅ ($790/yr) | — | Consistent |
| Free 5 clients | ✅ | ✅ | — | Consistent |
| No per-user fees | ✅ (stat) | ✅ (feature row) | — | Consistent |
| "Premium concierge priority — your request moves to the front of the setup queue" | ✅ | ✅ | ✅ | Consistent with the rank-backed admin queue; same 48h SLA for every eligible tier |
| "Done-for-you setup" | ✅ (Solo bonus) | — | ✅ (post-checkout) | Consistent |
| "14-day trial" | ✅ (FAQ) | — | — | Consistent with code |
| "30-day guarantee" | ✅ (FAQ) | — | — | Consistent with code |

---

## 9. COMPETITOR POSITIONING — "Best in a Puddle, Not the World" (Hormozi §8)

### Who We Are NOT For
- 20+ person crews (need enterprise features, multi-location management)
- Companies already on Jobber with 100+ clients (switching cost too high, not ICP)
- Companies needing AI features (we don't do AI)

### Who We ARE For
- Solo operators, 5-30 clients
- Oklahoma / similar markets (weather-dependent, rural cell service)
- $1-3K/mo revenue, no current software or spreadsheet-only
- "Built in OKC, not Silicon Valley" (differentiator, Landing.jsx)

### Competitive Moats (Hormozi §8: "negative WOM is 5-37x stronger")
1. **Rain delay** — no competitor has one-tap reschedule with weather-aware suggestions
2. **Offline mode** — works without cell service (rural Oklahoma)
3. **No per-user fees** — Jobber charges $29/user, we charge once
4. **Zero-fee payments** — Venmo/Zelle/Cash App, no card processing
5. **Done-for-you setup** — 48h import + first week review (competitors make you self-serve)

---

## 10. PRICING STRATEGY — Premium Anchor (Hormozi §29, Becker "breakage")

### Tier Spread (Hormozi §29: "jump 5-11x")
- Free → Solo: infinite (free to $39)
- Solo → Crew: 2x ($39 → $79)
- Crew → Premium: 2.5x ($79 → $199)
- **Status:** Tier spread 39 → 79 (2x) → 199 (5.1x from Free) — in the 5-11x guidance band from Hormozi §29.

### Pricing Philosophy (Becker: "never discount, value-add instead")
- **Never discount $39/$79** — value-add instead (free setup call, route template, onboarding help).
- **5-to-5-to-5 test:** bump $39 → $46.80 after 5 customers until conversion drops. Data-driven, not guessing.
- **Wider tiers if data supports it:** $399-799 premium tier targeting the 15-20% who'd upgrade (Hermes lens: premature without proof).

### Billing Cycle Alignment (Hormozi §24)
- **Monthly:** fast churn feedback ("keeps you honest")
- **Annual:** 2 months free (16.7% off, in Hormozi's 16-17% band). Primary CAC-recovery + retention tool.
- **Quarterly:** not yet — add if seasonal data shows monthly cancel spikes in Nov-Feb.
- **Test removing monthly entirely** (Hormozi §24: "easiest test in the world — you're not changing price, just removing an option").

---

## 11. GUARANTEE & RISK REVERSAL (Hormozi §27, Becker "or you don't pay")

### Guarantee Stack
1. **Rain-Proof Guarantee:** 30-day money-back. Usage-tied: 10 invoices + 5 recurring clients = qualifying. Refund first month in full.
2. **Unused months refunded:** Annual plan = unused months returned if you cancel mid-year.
3. **No credit card on free tier:** Zero-risk entry.

### Becker "Or You Don't Pay" Frame
Apply to marketing copy: "You won't miss another double-booked job, or you don't pay." The "or you don't pay" challenge hook is directly transferable (Becker WCicDquPAR8).

---

## 12. PROOF STRATEGY — "Proof Over Promise" (Hormozi §8, §29, Becker)

### Current Proof State (verified 2026-08-06)
- **1 profile, 0 tier events, 0 route-audits** — zero real users
- **0 store listings** — iOS/Android never published
- **5 outreach emails, 0 replies**
- **Testimonials section:** hidden until real approved quotes exist (never fabricated — Landing.jsx:66)

### Proof Ladder (Hormozi §29 hierarchy, §25 4-stage customer ladder)
1. **Homies (free work for proof):** First 5-10 free/demo operators → testimonials + screenshots
2. **Referrals:** First real paying users → "went from 12 to 22 jobs/week" case studies
3. **Reviews:** 10th invoice / rain-delay save → in-app review ask
4. **Public proof:** Operator stories, revenue screenshots, "before MowGo / after MowGo"

### Proof Dosage (Hormozi §8: "11k reviews beat a bigger promise")
- **Goal:** 10+ verified testimonials before any paid advertising
- **Format:** real screenshots from live demo app (not AI mockups which render gibberish)
- **Avatar coverage:** male/female, solo/crew, different revenue levels

---

## 13. RETENTION MECHANICS — "Get Them Past Day 90" (Hormozi §3)

### Churn Benchmarks (Hormozi §3: School/Sam Ovens data)
| Period | Expected churn | Target |
|---|---|---|
| Months 1-3 | 20%+ | Fix activation |
| Past day 90 | ~10% | Deliver an outcome |
| Past month 6 | ~2% | Connect with others |

### Retention Tactics
1. **Month 1 = activation:** Onboarding checklist + concierge CTA + day 0/3/7 emails
2. **Day 90 = deliver an outcome:** First rain-delay save, first invoice milestone, route optimization win
3. **Month 6 = connect:** Community features (future), operator stories, "10 regulars + matchmaking" (Hormozi §3)
4. **Overwhelm is #1 non-price churn driver** (Hormozi §3): "delete everything, what would you fight for?" → value per second, one valuable action/week
5. **Ask leavers why** (Hormozi §3): tag reasons, fix top 1-2 per 20 cancels
6. **Ask best members why they stay** (Hormozi §3): that's your retention engine; fix by subtraction

### Downsell / Pause / Win-Back Sequence (Hormozi §23 Money Models)
| Trigger | Action | Copy |
|---|---|---|
| Cancel (Crew→Solo) | Downsell email | "Don't lose your crew setup — Solo keeps you running at $39/mo" |
| Cancel (Solo) | Win-back email #1 | "We made it easy to come back" |
| Cancel + 7 days | Win-back email #2 | "Your data is still here. Re-activate anytime." |
| Cancel + 30 days | Win-back email #3 | "We owe you one" |
| Winter (Nov) | Seasonal pause offer | "Pause for 90 days, resume in spring" (not yet shipped) |

---

## 14. AD STRATEGY — Becker Ads Lens (Becker: "nothing in the ad account matters, the offer is everything")

### Ad Hook Formula (Becker Fay52JFEeZ4)
**NEW** (never heard before) + **RESULTS** (clear, specific) + **WITHOUT EFFORT** + **PROVEN** (testimonials) + **GUARANTEED** + handle objections.

### Hooks to Test (pain-first, in operator language)
1. "Still using spreadsheets to schedule your lawn crews?"
2. "Rain on Tuesday. Eight clients to rebook. One tap fixes it."
3. "Get 30% more jobs per week without hiring office staff, guaranteed"
4. "Jobber charges $29/mo per extra crew member. We charge once."
5. "3 scheduling mistakes costing lawn crews $500/week"

### First 5 Seconds (Becker: "432% ROI swing")
1. Call out target customer: "You run a lawn crew in Oklahoma..."
2. Present immediate benefit: "...and you're tired of double-booked jobs"
3. Bold hook: "...or you don't pay"

### Ad Budget (Hormozi §49: "never start with ads")
- **Phase 1 (now):** $0 ads. Master organic (Rule of 100, content, outreach).
- **Phase 2 (100+ users):** FB/IG ads, $100/day, lookalikes from customer list.
- **Phase 3 (1000+ users):** Scale what works, kill what doesn't. $1.50 retarget vs $10 acquire.

---

## 15. OPEN ITEMS — Blockers Before Aggressive Selling

| # | Item | Owner | Status | Blocker? |
|---|---|---|---|---|
| 1 | Annual Solo/Crew Stripe price IDs | Aaron | **UNVERIFIED** | YES — annual checkout may 500 |
| 2 | Stripe key `customer_write` permission | Aaron | **MISSING** | YES — first checkout will 500 |
| 3 | Referral free-month credit | Code | **WIRED** | NO — monitor Stripe/webhook operations |
| 4 | Premium priority queue | Code/copy | **IMPLEMENTED** — rank-backed active queue and copy restored | NO — monitor fulfillment and keep the 48h SLA tier-neutral |
| 5 | iOS/Android store publishing | Aaron | **NOT PUBLISHED** | YES — no mobile distribution |
| 6 | First 5-10 real operators | Aaron | **NOT STARTED** | YES — zero proof |
| 7 | 10+ verified testimonials | Aaron | **NOT STARTED** | YES — proof-first before ads |
| 8 | Winter seasonal pause | Code | **SPEC ONLY** | NO — can sell without it |

---

*This document is the single source of truth. Any copy on Landing.jsx, Compare.jsx, Subscribe.jsx, or marketing materials that contradicts this document is wrong and must be corrected. Review quarterly or after any pricing/feature change.*
