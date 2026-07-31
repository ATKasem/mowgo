# MowGo Nightly Vault Sync — 2026-07-31

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Past 24 hours (Jul 30, 02:00 – Jul 31, 02:00 UTC)
> **Total messages synced:** 123 (100 mowgo — 17 new since last sync + 23 outreach — 0 new + 0 cowork — 0 new)

---

## 📊 Decisions

- **🚨 The $49 Solo tier is now "indefensible" (Intel Engine recommendation)** — QuoteIQ's confirmed 5-tier pricing ($29.99 Essentials) undercuts MowGo Solo by 40% with 5x the features. Recommendation: **drop Solo to $29/mo to match QuoteIQ Essentials, or add serious feature value immediately.** Unresolved — decision pending.
- **Lead with Crew pricing story, not Solo (strategic recommendation)** — The flat-rate math only wins for 2+ person crews ($79 flat vs Jobber Connect $119-169 / HCP Essentials $149-189 = **34-47% cheaper**). Suggested message: "MowGo Crew: $79 flat for your whole team. No per-user fees. Period." Double down on features for 2-5 person crews (route opt + self-booking).
- **New differentiator proposed: "Built for micro-crews (1-3 people), not everyone."** — QuoteIQ has stolen the "flat-rate, no per-user fees" narrative (ranked #1 on Service Business Academy's Top 10 CRMs with exactly that messaging). MowGo needs a fresh angle beyond flat-rate.
- **"Nobody knows we exist" is now the #1 threat** — declared bigger than any single competitor after Day 14-16 of zero comparison-site presence.

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **Post ONE Reddit reply — still zero posted (Week 2)** — 28+ drafts sitting unposted. Freshest thread: r/LawnCarePros `1v6ce6e` "What apps/software do you recommend for managing customers and payments?" (~4-5 days old, exact ICP). Suggested angle: "2-person crew on MowGo $79 flat. No per-user fees. 14-day free trial no card." New thread also found: r/lawncare `1puyfcn` "Anyone using a CRM built for lawn care?" (fresh, comparing Jobber/SA/LMN/HCP).
2. **Submit MowGo to comparison sites — Day 14-16 of absence** — SoftwareWorld updated AGAIN Jul 30 (4 AI lawn care products), Briostack updated Jul 30 (10 platforms), AIMadeFor (5 products). **Zero of 5+ active "best of 2026" lists include MowGo.** Highest-leverage 30-minute task available. softwareworld.co → Submit Listing.
3. **Fix production Stripe — audit confirms total failure** — 0 of 9 required env vars set on CF Pages (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_KEY, OPENROUTER_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STRIPE_PRICE_SOLO, VITE_STRIPE_PRICE_CREW, VITE_FORCE_DEMO). Pages Functions NOT deployed (`POST /api/stripe/checkout-subscription` → HTTP 405; `functions_enabled: None`). Function code verified correct in repo. Fix: `wrangler pages secret put` × 9 → rebuild → redeploy. Blocks ALL real signups.
4. **Send Emerge Lawns follow-up — due Aug 1 (TOMORROW)** — Draft ready at `/opt/data/mowgo/marketing/emerge-lawns-followup-2026-07-30.md`. Emailed Jul 29, no response; follow up in 2 days per plan.
5. **Address the free-competitor pricing crisis** — ProBase ($0, LawnStarter-backed) + SoloOp ($0) + KaamCam ($12) + Grassly ($9.99) flooding the low end. Need "scalability vs free-cap" counter-messaging. NEW this window.

### 🟡 Medium

6. **Resolve Solo pricing debate** — $49 Solo vs $29.99 QuoteIQ / free ProBase. Intel recommends $29-39/mo range. Day 2 of the debate, still unresolved.
7. **Build online booking link / Customer Self-Booking (P0 feature)** — Day 8. Every competitor ships it; QuoteIQ has InstaSchedule. 30-50% call volume reduction.
8. **Feature roadmap prioritization (from Intel)** — P1: Route Optimization (table stakes 2026), P1: Satellite Property Measurement (QuoteIQ MapMeasure Pro is category leader), P2: Marketing Automation, P2: GPS Time Tracking.
9. **Cold outreach: 22 leads untouched, 8 tracked leads (4 contacted, 4 new), 0 conversions** — NG Outdoor, Frankies etc. flagged 🔴 ready for outreach.
10. **Monitor MowStack (mowstack.com)** — NEW competitor: same flat-rate unlimited-user model, same ICP, same value prop. MEDIUM-HIGH threat. No pricing published yet.

### 🟢 Low

11. **Watch new entrants** — ServiceM8 ($29/mo unlimited users, undercuts everything), SolvPro ($179/mo, bilingual EN/ES, same-day go-live), TurfHop Orbit AI (lawn-specific AI copilot, first mover Feb 2026), Fieldproxy (24-hour deployment claims).
12. **Blasian silent** — no human messages in #🌱mowgo since "hello" Jul 29 15:39. 2 days without follow-up.

---

## 🔬 Research Findings

### 🚨 QuoteIQ Crisis — Full Pricing Confirmed (5 tiers, no per-user fees)
| Tier | Price | Users | Key features MowGo lacks |
|------|-------|:-----:|--------------------------|
| **Essentials** | **$29.99/mo** | 1 | AI estimates, before/after image gen |
| **Beginner** | **$74.99/mo** | 2 | +Satellite measurement, review multiplier, e-sign, analytics |
| Pro | $149.99/mo | 4 | +Email/text automation, job costing, QB sync |
| Elite | $249.99/mo | 7 | +Route optimization, inventory, InstaQuote/Schedule |
| Max | $399.99/mo | ∞ | +Unlimited users, AI website builder |
- **Ranked #1 on Service Business Academy's Top 10 CRMs** using "flat-rate, no per-user fees" — MowGo's exact narrative — backed by Mike Vidan (580K YouTube subs, 20yr vet).
- Head-to-head: Solo **$49 vs $29.99** (63% more, fewer features); 2-person **$79 vs $74.99** (same price, 5x fewer features — no satellite measurement, no AI, no review collection).

### 🆕 ProBase — FREE Competitor (LawnStarter-backed)
- probaseapp.com — built by the LawnStarter team (500K+ customers). **$0/mo, no annual fee, no transaction surcharge.**
- Features: scheduling, route optimization, invoicing, card payments, AI service notes, tips. Revenue from optional marketplace job leads.
- Listed #1 on LawnStarter's "9 Best Lawn Care Software." Now also on Capterra. Still free. Still credible.

### 🆕 MowStack (mowstack.com)
- Same flat-rate, unlimited-user model. Same ICP. Same value prop. Recently launched. **Threat: MEDIUM-HIGH.** No pricing published — monitor.

### 🆕 Other Competitor Moves
- **ServiceM8** — $29/mo, unlimited users, undercuts everything
- **SolvPro** — $179/mo, bilingual EN/ES, same-day go-live
- **KaamCam content blitz** — solo-operator posts across 6+ verticals (lawn care, pool, fencing, tree service, carpet cleaning, window cleaning), same template pushing $12/mo. Coordinated campaign, not one-off.
- **TurfHop Orbit AI** — launched AI copilot (ChatGPT/Claude/Gemini) Feb 2026 — first mover on lawn-specific AI assistant
- **GorillaDesk** — $49/mo with route optimization + chemical tracking — strong value in lawn-specific niche
- **Fieldproxy** — claims 24-hour deployment, unlimited users, AI config — emerging
- **Jobber real solo cost confirmed:** $49/mo published, **$117/mo with add-ons** — MowGo bests them here

### 📊 Industry Data
- FSM market **$5.1B → $9.17B by 2030 (12.5% CAGR)** — strong tailwind MowGo currently captures none of
- **AI adoption in field service: 39% → 66% in one year** (Salesforce). AI aerial measurement + instant quoting now table stakes — SiteRecon, DeepLawn, SatQuote all launching. **MowGo has zero AI features.**
- Payment pain validated: **56% of small businesses owed $17,500 avg in overdue invoices; 87% of Stripe invoices paid within 24h** — MowGo's Stripe integration solves real pain (once deployed)
- US lawn care services market **$115.4B** (2023), 5.6% CAGR; **44% of operators plan software purchase in 2026** (doubled from 2025); 47% of lawn owners use smart apps for scheduling; battery mowers 28% market share

### 🆕 Reddit Signal
- **6 new threads discovered** (5 added to seen_urls): r/lawncare `1puyfcn` (fresh, CRM comparison — perfect entry), r/landscaping `1qhthe7`/`1em4jdy`/`1j62bex`, r/sweatystartup `1cz9kkl` (scaling pain), r/smallbusiness `185d063`
- All previously queued threads now 4-10 days stale. **Reddit fully blocked from this IP — 28 drafts, 0 posted (Week 2).** Dead channel without API access or human posting.

### Stripe Infrastructure Audit (Jul 30 09:16)
| Component | Status |
|-----------|--------|
| Checkout function code in repo | ✅ Correct (4 functions, right paths) |
| Stripe account (live) | ✅ `acct_1TwFQhGwXKVLlr2I` |
| Price IDs configured | ✅ Solo $39, Crew $79 |
| Pages Functions deployed | ❌ Not deployed (405 error) |
| Env vars on CF Pages | ❌ **0 of 9 set** |
| Live checkout | ❌ Broken |
- Checkout is entirely server-side (no Stripe.js in bundle — correct design). Build was manual (`wrangler`, Jul 28, `build_command: null`). Old mowflow project also deployed Jul 30 with zero env vars.

---

## 📝 Notes / Context

### Channel Activity (last 24h)
- **#🌱mowgo** — 17 new messages: 6 Intel Engine runs (02:42 Industry Trends, 06:45 Pricing Intelligence, 10:49 Feature Ideas, 14:51 Competitor Monitoring, 18:53 Industry Trends, 22:56 Pricing Intelligence), 1 Stripe health check (09:16, 3 parts). No human messages — Blasian silent since "hello" Jul 29 15:39.
- **#🌱mowgo-outreach** — No new activity. Last message Jul 26 14:12 UTC.
- **🤝mowgo-cowork** — Still empty.

### Escalation Timeline (execution gap)
| Blocker | Flagged | Now |
|---------|:-------:|:---:|
| SoftwareWorld / comparison site submission | Day 1 (Jul 17) | **Day 14-16** ❌ |
| Production Stripe env vars | Day 1 (Jul 17) | **Day 14-16** ❌ |
| Online booking link | Jul 23 | **Day 8** ❌ |
| Reddit replies (28 drafts) | Week 1 | **Week 2, 0 posted** ❌ |
| Cold outreach (22 leads) | Jul 24 | Untouched ❌ |
| Solo pricing debate | Jul 30 | Day 2 ❌ |

### Key Takeaway
The intel is excellent but the **execution gap is now the dominant risk**: Day 14-16 on the two critical blockers (comparison-site submissions, Stripe env vars) with zero action, while QuoteIQ simultaneously stole MowGo's "flat-rate, no per-user fees" narrative at a lower price and ProBase (LawnStarter-backed) went free. The single most impactful actions for Aug 1: (1) Emerge Lawns follow-up (due), (2) comparison-site submissions, (3) one Reddit reply from the 28 drafts, (4) decide the Solo price question ($29 vs $49) — the pricing decision gates all positioning work.

---

*Generated by MowGo nightly vault sync — 2026-07-31 02:00 UTC*
