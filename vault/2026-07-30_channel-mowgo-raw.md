# 🌱 mowgo — Raw Channel Dump
**2026-07-30 02:00 UTC | 50 messages (19 new since last sync)**

## Most Recent Activity (Top messages)

### Jul 29, 22:39 — Intel Engine — Competitor Monitoring (2/2)
**HeremesV2** — 3 Key Findings:
1. 🆕 **Grassly.pro** ($9.99/mo) — ultra-low-cost entrant, "lawn care CRM for small businesses" with scheduling, invoicing, and route optimization. Cheaper than KaamCam. Price floor signals race-to-the-bottom.
2. 🆕 **SoftwareWorld updated Jul 29 (TODAY)** — lists 44 products including Jobber ($25/mo), LawnPro ($29/mo), Kickserv ($47/mo). **MowGo still absent. 10 days since first flagged. Zero submission action.**
3. **QuoteIQ ($29.99/mo)** — rising, appearing in multiple comparisons. AI estimator from photos.

### Jul 29, 22:39 — Intel Engine — Competitor Monitoring (1/2)
**HeremesV2** — BI Engine Run Report (Competitor Monitoring Lane 0/4):
- **Reddit:** 1 new thread (r/smallbusinessowner — "Advertising for landscaping company"), 19 now tracked. 3 high-priority threads now stale at 3+ days.
- **🚨 Servinix Launch DELAYED** — Terms of Service confirms pre-launch through Sep 14, 2026 (beta opens Aug 17). Full 6-week slip from expected Jul 31. Reduced near-term threat.
- **🆕 KaamCam Solo Push Escalates** — New blog post: "Best Lawn Care Software for Solo Operators (2026)". Argues solo ops don't need route optimization, dispatch, or crew features. Direct attack on MowGo Solo ($49/mo = 4x KaamCam).
- **🆕 Grassly.pro** — $9.99/mo ultra-low-cost entrant.

### Jul 29, 18:37 — Intel Engine — Feature Ideas (2/2)
**HeremesV2** — Daily Action List:
1. 3 reply drafts sitting in `marketing/reddit-replies-2026-07-27.md` — threads over 24h old, past prime engagement
2. 🚨 Top 3 Actions: Submit to comparison sites, Fix production Stripe, Build online booking link
3. KaamCam price threat ($12 vs $49) — needs response: cheaper Solo tier, or feature comparison page

### Jul 29, 18:37 — Intel Engine — Feature Ideas (1/2)
**HeremesV2** — BI Engine Run (Feature Ideas Lane 3/4):
- **🆕** Gap analysis vs 5 major 2026 comparison guides: Route optimization is #1 missing feature. Top gaps: route optimization, online booking link, customer self-service portal, crew mobile dispatch app, SMS/customer communication, QuickBooks sync.
- **KaamCam** directly attacking MowGo's ICP with solo operator positioning.
- **MowGo still invisible** — 9 days flagged. Zero submissions made. SoftwareWorld updated Jul 29 — still no MowGo.

### Jul 29, 15:39 — **Blasian**: "hello" 👋 First human post since Jul 23.

### Jul 29, 14:34 — Intel Engine — Pricing Intelligence (2/2)
**HeremesV2** — Daily Action List:
1. Engage r/Entrepreneur daughter+dad thread — most human story
2. Engage r/landscaping 1-3 person crews — exact ICP
3. Submit MowGo to SoftwareWorld (updated TODAY)
4. Prep "Jobber promo expired" messaging — Jul 31 is 2 days away
5. Fix production Stripe
6. Servinix launch Jul 31 — check pricing (this was before Servinix delay was discovered)

### Jul 29, 14:34 — Intel Engine — Pricing Intelligence (1/2)
**HeremesV2** — BI Engine Run (Pricing Intelligence Lane 3/4):
- 🚨 **BREAKING: Jobber Quietly Restructured Pricing (May→Jul 2026)** — Core $21/mo annual (1 user), but add a 2nd user → +$29/mo. Add Marketing → +$79. API locked behind $280-371/mo Plus.
- **SoftwareWorld (updated Jul 29) — STILL NO MOWGO.** Both AI Lawn Care (4 products) and Small Business (44 products) lists checked.
- New outreach angle: Jobber's $21 Core looks cheap until add-ons. MowGo at $49 flat vs $213/mo for comparable Jobber setup.

### Jul 29, 10:29 — Intel Engine — Industry Trends (3/3)
**HeremesV2** — Run Summary: Reddit monitoring complete (no new threads, 4 queued for outreach). Market intel complete (AI adoption surge, market growth). Outreach skipped (outside window).

### Jul 29, 10:29 — Intel Engine — Industry Trends (2/3)
**HeremesV2** — Key Findings:
- **FSM Market hitting $2.89B in 2026** — growing at 10.5% CAGR. Projects to $7.09B by 2035.
- **AI adoption no longer optional** — 67% of commercial landscapers use AI for scheduling. AI route optimization boosts productivity 28% and cuts fuel 18%. 3x ROI within first year for 70% of users.
- **🆕 Service Fusion** enters "unlimited users" conversation — published Jobber vs Housecall Pro comparison yesterday (Jul 28) positioning on unlimited users. MowGo's exact differentiator. Validation.
- **QuoteIQ expanding beyond lawn care** — targeting cleaning/maid service niches. Less direct focus on lawn care = positive for MowGo.
- **Briostack gaining visibility** — appearing on Software Advice lists.
- **MowGo STILL missing from ALL comparison lists** — checked SoftwareWorld (AI Lawn Care & AI Landscape Jul 29), Software Advice (Jul 28), Workyard (May).

### Jul 29, 10:29 — Intel Engine — Industry Trends (1/3)
**HeremesV2** — BI Engine Run (Industry Trends Lane 2/4):
- Reddit: 4 premium threads queued for outreach window (12-20 UTC)
- Top threads: r/landscaping "1-3 person crews" (PRIME), r/landscaping "Is Jobber overkill?" (HIGH), r/Entrepreneur dad-daughter digitization (PRIME), r/sweatystartup "Not happy with Jobber" (HIGH)

### Jul 29, 09:08 — Stripe Health Check (3/3)
**HeremesV2** — Fix sequence per reference doc: Set 4 secret env vars on CF Pages, remove VITE_FORCE_DEMO, redeploy with wrangler.

### Jul 29, 09:08 — Stripe Health Check (2/3)
**HeremesV2** — Scorecard:
| Component | Status |
|-----------|--------|
| Code in repo (`/functions/api/stripe/`) | ✅ Correct |
| Functions deployed | ❌ **Broken** (`functions_enabled: None`) |
| `STRIPE_SECRET_KEY` | ❌ Empty |
| `STRIPE_WEBHOOK_SECRET` | ❌ Empty |
| `SUPABASE_SERVICE_KEY` | ❌ Empty |
| `OPENROUTER_API_KEY` | ❌ Empty |
| `VITE_FORCE_DEMO` | ⚠️ Still `true` |
| Stripe account | ✅ Active |
| Price IDs | ✅ Valid |

### Jul 29, 09:08 — Stripe Health Check (1/3)
**HeremesV2** — Stripe Integration Report:
- Domains: `mowgo.pages.dev` ✅ Active, `cleanmowgo.pages.dev` ❌ Dead, `cleanflloww.pages.dev` ❌ Dead
- Publishable key NOT found in JS bundle (correct — server-side checkout)
- No PaymentSheet/Elements — uses Checkout Sessions (redirect flow) ✅
- 🚨 All 4 secret env vars on CF Pages are EMPTY
- 🚨 Pages Functions NOT deployed — all endpoints return SPA HTML
- 🚨 VITE_FORCE_DEMO still true — blocks real auth/checkout
- Live endpoint test: ❌ POST to checkout-subscription returns 200 with SPA HTML, not JSON

### Jul 29, 06:25 — Intel Engine — Competitor Monitoring (3/3)
**HeremesV2** — Recommended Actions: Submit to SoftwareWorld & Tolodora TODAY. Prep "Jobber promo expires Jul 31" messaging. Monitor SoloOp (#1 strategic threat). Reddit replies at 12:00 UTC. Cold outreach — pick one lead today.

### Jul 29, 06:25 — Intel Engine — Competitor Monitoring (2/3)
**HeremesV2** — Secondary Threats:
- **QuoteIQ** ($29.99/mo): Shipped July 2026 update with AI AutoMeasure (satellite property measurement), Ask AI Reports, Expenses Analytics. Heavy content marketing.
- **KaamCam** ($12/mo): Aggressively targeting solo operators with content that positions full features as unnecessary.
- **Fieldbookly** (free): Online booking for lawn care — another free entrant.

### Jul 29, 06:25 — Intel Engine — Competitor Monitoring (1/3)
**HeremesV2** — **🚨 CRITICAL FINDINGS:**
1. **SoloOp IS real** — FREE FOREVER competitor confirmed (solo-op.com). Fully built app with smart scheduling, invoicing, Rain Mode, offline mode. $0/mo subscription, revenue via transaction fees (1.75%+$1.30). Directly targets same 1-3 person crew ICP. **Most significant pricing threat yet**.
2. **Servinix already LIVE** ahead of Jul 31 launch. Pricing: AI Service Assistant $300/mo flat, FSM $20/tech/mo, GPS Fleet $20/vehicle/mo. For a 3-person crew: $320-360/mo vs MowGo's $79 Crew plan. 4-5x higher.
3. **MowGo still MISSING from ALL comparison lists** — confirmed fresh: SoftwareWorld (updated Jul 29 TODAY), Tolodora (Jul 27), KaamCam solo guide (Jul 25).

### Jul 29, 06:00 — Supabase Keep-Alive
**HeremesV2** — ❌ Failed: Script not found (/opt/data/scripts/.hermes/scripts/supabase_keepalive.sh)

### Jul 29, 02:21 — Intel Engine — Feature Ideas (2/2)
**HeremesV2** — Recommended Actions: Flat-rate pricing is competitive moat. Lead with "unlimited crew, one flat price." No price change needed. Marketing: "Unlimited crew members. One flat price. No surprise add-ons."

### Jul 29, 02:21 — Intel Engine — Feature Ideas (1/2)
**HeremesV2** — BI Engine Run (Feature Ideas Lane 4/4, cycle complete):
- Reddit: 3 high-priority threads queued (r/landscaping ICP thread, r/landscaping Jobber overkill, r/sweatystartup "Not happy with Jobber")
- Top findings: MowGo STILL absent from all comparison lists; Market buying NOW (44% software investment); Flat-rate pricing = superpower
- Feature gap: QuickBooks integration is the #1 request across every guide and thread
- 4 key recommendations including marketing message shift
