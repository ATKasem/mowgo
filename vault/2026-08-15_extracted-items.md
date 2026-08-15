# MowGo Extracted Items — 2026-08-15

**Source:** #🌱mowgo (12 new messages from HeremesV2 bot)
**Human activity:** Zero (Blasian silent Day 17)

---

## 📋 Decisions

| # | Decision | Date | Notes |
|---|----------|------|-------|
| D1 | **Route optimization = #1 build priority** | Aug 14 | Every competitor has it; estimated $565/mo wasted drive time per crew. Recommend in-house with Open-Meteo geocoding. |
| D2 | **Servinix beta evaluation due Aug 17** | Aug 14 | Sign up first thing Monday. "60% off invoice" promo, rain delay + GPS promised. |

## ⚡ Action Items

| # | Item | Priority | Due | Status |
|---|------|----------|-----|--------|
| A1 | Sign up for Servinix beta evaluation | HIGH | Aug 17 (Monday) | Pending |
| A2 | Send final lead follow-up nudge (Emerge, Metro Green, Bigfoot, Simply, Campbell & Sons) | HIGH | This week | Pending — Lead Nurture API key broken (401), needs manual send |
| A3 | Fix Lead Nurture API key — aaronkasemt@gmail.com emails failing with 401 | CRITICAL | ASAP | Broken since Aug 14 |
| A4 | Top up / increase OpenRouter credits to restore cron health | CRITICAL | ASAP | Intel Engine + Stripe check + others all failing HTTP 402 |
| A5 | Complete directory submissions (Capterra/G2/SoftwareAdvice) | MEDIUM | Weekend | Day 34 overdue |
| A6 | Reply to r/CRM thread "Best CRM for lawn care" (thread ID: 1uaa3yg) — solo operator, never used CRM | MEDIUM | Today/Friday | HIGH signal, friend-mode reply |
| A7 | Reply to r/smallbusinessowner "Alternative to Square" thread — paying $20/mo invoicing, wants cheaper | MEDIUM | Today/Friday | FREE tier match |
| A8 | Monitor Jobber Conference 2026 thread for engagement opportunity | LOW | If active | Spending $2500+ on conference, might want alternatives |

## 🔬 Research Findings

| # | Finding | Source | Relevance |
|---|---------|--------|-----------|
| R1 | **ProBase = #1 competitive threat.** Completely free, all features unlocked, backed by LawnStarter. Marketing angle: "Sunday night problem," "7am route problem." | BI Engine Run 1 (03:15Z) | Defense: better UX, native apps, data privacy |
| R2 | **Yardbook card commission pain = MowGo messaging.** Free tier adds ~1% commission on card payments. At 200 jobs/mo = $300/year bleeding out. MowGo can own "no hidden payment fees." | BI Engine #3 (19:24Z) | Key positioning point vs Yardbook |
| R3 | **Jobber total cost transparency opportunity.** Connect ($149) + Manifold ($72) = $221/mo for typical crew. YouTube video "Jobber's Pricing IS A TRAP" gaining traction. | BI Engine #3 (19:24Z) | MowGo Crew at $79 undercuts even Jobber Core by half |
| R4 | **QuoteIQ aggressive price cuts.** Elite $299→$249 (17%), Max $699→$399 (43%). Responding to competitive pressure. June: 60+ features. July: AI AutoMeasure (satellite) + Ask AI Reports. | BI Engine #3 (19:24Z) | QuoteIQ most aggressive shipper; possible continued cuts incoming |
| R5 | **Level billing + Rain Delay = drought-season retention combo.** LawnPro ships level billing on free tier. Oklahoma lawns mowing every 10 days, customers resent full-price billing during dry spells. | Executive Summary (15:24Z) | Ship before fall — feature gap with multiple competitors |
| R6 | **FieldVibe is new entrant to watch.** Free lawn care scheduling app, 4.8 stars across App Store/Google Play/Capterra. Needs deeper monitoring for feature depth and pricing trajectory. | Competitive analysis (19:25Z) | Potential future threat |

## 🔔 Tasks & TODOs

| # | Task | Owner | Deadline |
|---|------|-------|----------|
| T1 | Build route optimization feature (in-house, Open-Meteo geocoding) | Dev team | Q3 target |
| T2 | Implement level billing for drought season | Dev team | Before fall |
| T3 | Monitor Servinix launch (Aug 17) for feature/pricing reveals | Aaron | Aug 17 |
| T4 | Verify if QuoteIQ Elite actually cut to $249 or if it was temporary promo | BI Engine | Next run |
| T5 | Add FieldVibe and Grassly to deeper competitive analysis next rotation | BI Engine | Next rotation |

## 📊 Metrics Snapshot

- **Intel Engine status:** Degraded — 2 successful runs, 3 failures (HTTP 402 credit exhaustion), 1 partial failure
- **Lead Nurture:** ❌ BROKEN — API key invalid (401)
- **Invoice Reminders:** ✅ Healthy — no overdue invoices
- **Stripe Health Check:** ⚠️ Failing — same credit exhaustion issue as Intel Engine
- **Reddit extraction:** ❌ Blocked (403 anti-bot)
- **Blasian silence streak:** Day 17
