# MowGo Nightly Vault Sync — 2026-08-01

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Past 24 hours (Jul 31, 02:00 – Aug 1, 02:00 UTC)
> **Total messages synced:** 123 (100 mowgo — 15 new since last sync + 23 outreach — 0 new + 0 cowork — 0 new)

---

## 📊 Decisions

- **💰 PRICING: Recommendation flips to "HOLD $39 flat, skip a free tier"** — Day 7 of the Solo-price debate. New intel resolves it: (1) Grassly.pro's free tier now matches MowGo's moats (rain-flag, bilingual, PWA, portal, route opt) but charges **2% of every payment** — MowGo's durable wedge is now **"flat price, no cut of your revenue"**; (2) MowStack proves $49.99 all-in is viable (speed > price); (3) QuoteIQ's $29.99 is confirmed as entry bait — the real lawn-care tier is **Pro $149.99**, making MowGo $39-79 flat a strong, truthful comparison. **Decision still needs Aaron's sign-off, but intel now recommends: keep $39, add "no % of revenue" messaging, don't race to the bottom.**
- **🌧️ RAIN-DELAY IS NO LONGER A UNIQUE DIFFERENTIATOR** — MowStack ships weather-aware rescheduling TODAY, and Servinix ships automated rain-delay SMS (beta Aug 17, launch Sept 14). Two competitors now claim the feature that was MowGo's #1 edge. The intel engine fixed the false "nobody else has rain delay" claims in `competitor-comparison.md`. **Surviving edge: one-button simplicity + no demo call / no onboarding for 1-3 person crews — market that angle harder.**
- **✅ CORRECTION TO PRIOR INTEL: "MowGo has zero AI" was WRONG** — verified in code: AI Autopilot (14 function-calling tools: schedule, rain delay, invoices, revenue, webhooks) + **full Spanish i18n** (846-line parity) are shipped. The real gap is narrower than reported. **New decision: give Autopilot a public face (landing-page chat widget + booking flow) — no new AI build needed.** 5th AI-front-office competitor launched this month (TurfHop Orbit AI), so visibility is urgent.
- **📝 Copy flag: "no per-user fees" is no longer unique** (QuoteIQ markets it; MowStack too). Durable positioning line: **"flat + no per-user + no % of revenue."**
- **⚠️ Roadmap claim "AI estimates & measurements ✅ shipped" contradicts intel** — worth 5 min verification; if real it's an unmarketed feature, if not the roadmap is feeding false claims to /compare.

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **Send Emerge Lawns follow-up — DUE TODAY (Sat Aug 1), manual send** — Sat is outside the bot's Mon-Fri 12:00-20:00 window. Draft ready at `/opt/data/mowgo/marketing/emerge-lawns-followup-2026-07-30.md`. Emailed Jul 29, no response. **Also due today (manual): Metro Green, Bigfoot, Simply follow-ups — 4 total.**
2. **Fire the "Jobber promo just ended" campaign** — Jobber's "Save up to $3,900 — Offer ends July 31" promo is CONFIRMED ended midnight ET. Aug 1 opens the switching window. Drafts A/B/D ready in `jobber-promo-expiration-2026-07-29.md`. Sat/Sun outside bot window → post manually or Monday.
3. **Delete or redirect `mowflow.pages.dev` (OLD domain) — STILL LIVE WITH WORKING LIVE STRIPE** — 🚨 New finding from the Jul 31 health check: the old MowFlow domain was never deleted and its checkout function returns real `cs_live_` Stripe sessions (live secret key survived the rebrand). Users hitting the old domain can create real Stripe sessions under the old brand. Either redirect to mowgo or delete deployments + project.
4. **Fix production Stripe on mowgo.pages.dev (Day 17)** — Still 🔴 BROKEN: `POST /api/stripe/checkout-subscription` → 405 (Pages Functions not deployed, `functions_enabled: None`), 0 of 9 env vars set. Client code is fully wired. Fix = set 4 env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_KEY`, `OPENROUTER_API_KEY`) via `wrangler pages secret put` (wrangler is now authed — **~5 min**), redeploy so `functions/` ships. Also: remove "Coming soon: Stripe payments" stale landing copy; archive old $49 price `price_1TwFiD...`.
5. **SoftwareWorld / comparison-site submissions (Day 17-18)** — Still absent from ALL 5+ "best of 2026" lists. SERP crowding accelerating: Fieldproxy, HelloMateAI, QuantumByte, GreenRoute, Fieldwork, Contractor+, RealGreen all publishing comparison content.
6. **Build CSV import — "Switch in 10 min" (NEW, highest-leverage build this month)** — Two open churn pools: QuoteIQ free-tier refugees (free edition discontinued ~2 months ago) + Jobber promo ending. Pair with a QuoteIQ-alternative page.

### 🟡 Medium

7. **Ship the online booking link (P0, Day 9)** — Now verified table-stakes: QuoteIQ InstaQuote/InstaSchedule, HCP booking portal, AutoRev 24/7 booking. 1-2 days estimated.
8. **Autopilot public face (NEW)** — landing-page chat widget + booking flow; 5 AI front-office players now (AutoRev, Jobber AI Receptionist, CTM AskCTM, QuoteIQ Virtual Call Team, TurfHop Orbit AI).
9. **Rain-delay auto-SMS to clients (NEW, parity play)** — pull forward from roadmap; highest stickiness-per-effort, Resend channel exists. Servinix ships it pre-launch.
10. **One-tap route sequencing (NEW)** — ~0.5 day build; kills Grassly/QuoteIQ/Fieldproxy route-opt talking points.
11. **Post ONE Reddit reply — `1v6ce6e` never posted, now ~9 days old (deprioritized)** — Week 2, Day 6 of 403-block, 28 drafts 0 posted. Thread expired; queue aging out. Reddit dead from this IP without API access or human posting.
12. **Verify roadmap's "AI estimates & measurements shipped" claim** — 5 min, gates /compare copy accuracy.

### 🟢 Low

13. **Watch new entrants** — AutoRev (AI agents, Jul 27), HelloMateAI, QuantumByte, GreenRoute, Fieldwork, Contractor+, RealGreen. Servinix runway: ~6 weeks (beta Aug 17, commercial Sept 14, "beat your invoice by 50%" campaign).
14. **Blasian silent** — no human messages in #🌱mowgo this window (last: "hello" Jul 29 15:39). 2+ days without follow-up.

---

## 🔬 Research Findings

### 🚨 TurfHop is now MowGo's most direct threat (at the $49 tier)
- Identical price ladder **$49/$79/$129** with MORE features: Truck $49 includes route optimization, asset tracking, POs, marketing tools, 25 Orbit AI credits.
- **Orbit AI launched** (Pro-only AI copilot: forecasting, smart quotes, schedule assist, credit-based) — 5th AI-front-office player this month.

### 🆕 MowStack — product-twin baseline (mowstack.com)
- **$49.99/mo flat ($39.99 annual)**, unlimited team, no per-user fees, every feature.
- Ships **weather-aware rescheduling** (MowGo's claimed #1 differentiator), gate codes/pet notes, customer portal, photo proof, time cards, equipment tracking, Stripe auto-pay. Demo UI dated today — actively iterating.
- Threat: **HIGH** at the $49 tier specifically.

### 🆕 QuoteIQ verified — $29.99 is entry bait
- 5-tier ladder verified: Essentials $29.99 → **Pro $149.99** (real lawn-care tier) → Max $399.99. Their "no per-user fees" headline is marketing; the capable tier is 5x the entry price.
- 3 NEW features shipped this week: AI Smart Import (Jobber/HCP CSV migration), Consumer Financing (Affirm/Klarna, $30K/job), AI Virtual Call Team (24/7 receptionist). 50+ features total.
- Free edition discontinued ~2 months ago = **churn pool** for MowGo's CSV-import play.

### 🆕 Servinix — launch slipped, but ships rain-delay SMS
- Beta Aug 17, commercial Sept 14; "show us your invoice, we'll beat it by 50%" campaign. Watches forecast per zip, auto-texts + reschedules clients. ~6 weeks runway.

### 🆕 Grassly.pro — free tier now matches MowGo's moats, with a catch
- $0/mo: rain-flag scheduling, bilingual EN/ES, PWA, portal, route opt (100-customer cap) — BUT **2% of every payment** on top of Stripe fees. MowGo's wedge: **"flat price, no cut of your revenue."**

### 🆕 Jobber — promo ended midnight ET
- "Starting at $29/Month" headline (Core $29/mo annual after yr 1, +$29/user explicit). AI Receptionist bundled. Post-promo math win: Jobber 2 users = $50-58/mo → **MowGo $39 Solo beats it for every 2+ user crew.**

### 🆕 Housecall Pro — entry cut to $59/mo (annual)
- Bundled "AI team members" into every plan + $50 gift card demo bribe.

### 📊 Industry Data (NALP/Aspire 2026 + market)
- **Cash flow is the industry's #1 wound:** 76% bill within 4 days but only **39% get paid on time**; 60% paid ≥1 wk late; 7% 2-3 months late. Marketing hook: *"Only 39% of landscapers get paid on time. MowGo auto-invoices so you're not one of them."*
- **Tool sprawl:** 62% of contractors run 7+ software systems; #1 reason for switching = automate workflows (58%).
- Lawn software market **$1.2B → $3.2B by 2033 (~10.4% CAGR)**; robot mowers commoditizing mowing → multi-service scheduling (MowGo strength) is the pivot.
- KaamCam compare-table math flawed: claims "Jobber ~$169 for 5 users" — actual $105-149. Ammo if MowGo publishes comparisons.

### 🔌 Stripe Infrastructure — NEW: the old domain still works
| Component | mowgo.pages.dev (current) | mowflow.pages.dev (old!) |
|-----------|---------------------------|--------------------------|
| Checkout function | ❌ 405 — NOT deployed | ✅ **ALIVE — real `cs_live_` sessions** |
| Env vars | ❌ 0 of 9 set | ✅ Live secret key present |
| verify-session | ❌ fallthrough | ✅ Deployed (gated) |
| create-portal-session | ❌ | ❌ 405 (old build) |
- iOS native: PaymentSheet correctly configured (`PaymentView.swift`, SPM product wired, `[weak self]` capture fix applied). Live publishable key `pk_live_51TwFQhGwXKVLlr2I...` matches account `acct_1TwFQhGwXKVLlr2I`. ✅ Valid.
- Web: no publishable key in JS bundle **by design** (server-side checkout — correct).

---

## 📝 Notes / Context

### Channel Activity (last 24h)
- **#🌱mowgo** — 15 new messages (14 with content + 1 footer trailer): 6 Intel Engine runs (02:57, 07:13, 11:17, 15:20, 19:24, 23:28 — full 4-lane cycle completed twice) + 1 Stripe health check (09:12, 3 parts). **No human messages — Blasian silent since "hello" Jul 29 15:39.**
- **#🌱mowgo-outreach** — No new activity. Last message Jul 26 14:12 UTC. Dormant 6 days.
- **🤝mowgo-cowork** — Still empty.

### Reddit Status
- Day 6 of 403-block (www/old.reddit, API, mirrors all blocked; search indexes return only tracked URLs). 28 drafts, **0 posted** (Week 2). `1v6ce6e` reply never posted — thread ~9 days old, deprioritized. Dead channel without API access or human posting.

### Escalation Timeline (execution gap)
| Blocker | Flagged | Now |
|---------|:-------:|:---:|
| SoftwareWorld / comparison site submission | Day 1 (Jul 17) | **Day 17-18** ❌ |
| Production Stripe env vars (now: + old domain live) | Day 1 (Jul 17) | **Day 17** ❌ (wrangler authed — 5 min fix) |
| Online booking link | Jul 23 | **Day 9** ❌ |
| Reddit replies (28 drafts) | Week 1 | **Week 2, 0 posted** ❌ |
| Cold outreach (22 leads) | Jul 24 | Untouched ❌ |
| Solo pricing debate | Jul 30 | **Day 7** — intel recommends HOLD $39 |

### Key Takeaway
The window's biggest news: **(1) the pricing question effectively resolved itself** — intel now recommends holding $39 flat with "no % of revenue" messaging (Grassly's 2% fee and QuoteIQ's bait pricing make MowGo's flat+no-fees story the strongest it's been); **(2) rain-delay is no longer unique** — MowStack ships it now, Servinix pre-launch, so the moat has moved to speed (CSV import, booking link, Autopilot visibility) and the simplicity story; **(3) a live Stripe key is sitting on the WRONG domain** — the fastest real win available: delete/redirect mowflow.pages.dev and set the 4 env vars on mowgo (wrangler authed, ~5 min). Human actions due today (Sat, outside bot window): Emerge Lawns + 3 other follow-ups, and the Jobber "promo just ended" posts. **The execution gap remains the dominant risk — Day 17 on the two longest-standing blockers with zero action.**

---

*Generated by MowGo nightly vault sync — 2026-08-01 02:00 UTC*
