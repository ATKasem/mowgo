# MowGo Weekly Digest — W31 (Mon Jul 27 – Sun Aug 2, 2026)
**Compiled:** 2026-08-02 04:00 UTC · MowGo BI Engine (Sunday deep-dive)
**Sources:** 6 daily BI reports (Jul 28–Aug 1), 28 intel lane files, lead tracker, daily action logs

---

## 📌 Executive Summary

The week's shape: **revenue infrastructure went live, product gaps got named, and the switcher wave opened.**

1. **Stripe production checkout went LIVE on mowgo.pages.dev (Day 16 blocker resolved Aug 1)** — all 5 Cloudflare functions verified, OpenRouter secret re-bound, old mowflow.pages.dev neutralized (deployments deleted, redirect placeholder live). Signups/payments now possible.
2. **Jobber's promo died Jul 31 → the switcher wave is open NOW.** Jobber permanent ladder confirmed ($29 Core + $29/user everywhere; Grow $99/mo annual for solo). MowGo Solo $39 flat beats it by $60/mo for solos and every 2-user crew. Window is days-to-weeks — competitor-import tool (scoped, ~1d) + "promo just ended" posts are the capture moves.
3. **MowStack is the builder to watch** — shipped photo proof, weather dispatcher inbox, route map with real drive times, time cards/payroll, customer portal, **equipment tracking, native iOS/Android apps, and card-on-file auto-pay** (all verified live this week). They're the closest-shaped competitor at $39.99-49.99 flat.
4. **Feature gap board finalized:** online booking link (P0) · quotes v1 (biggest structural gap — scoped) · **card-on-file auto-pay (NEW, #3)** · photo proof · invoice reminders (**cron already LIVE Aug 1**) · rain-delay auto-notify (SMS = MowGo-only edge) · one-tap route sequencing.
5. **Lead engine: 9 tracked → 17.** 5 cold emails sent Jul 29-31 (0 replies yet — follow-ups overdue). Sunday deep-dive added 8 new FB-discovered Oklahoma leads.
6. **Reddit: Day 9 of the 403-block.** 0 verified new 48h threads this week; 15+ pre-48h threads evaluated and seen-added; 28 reply drafts still unposted (Aaron-side). r/sweatystartup may have banned software posts — engagement shifts to r/LawnCarePros/r/landscaping.
7. **GTM gap unchanged:** MowGo absent from SoftwareWorld (Day 18) and every "best of 2026" listicle; SERP crowding accelerating (tolodora.com, solvpro.com + 4 comparison blogs this week).

---

## 🏆 Top Opportunities (ranked)

| # | Opportunity | Window | Capture move | Owner |
|---|-------------|--------|--------------|-------|
| 1 | **Jobber switcher wave** (promo dead Jul 31) | NOW–Aug 15 | "Promo just ended" posts (drafts A/B/D ready) + competitor-import tool + /switch page | Aaron (posts) + Codex (import build, ~1d) |
| 2 | **QuoteIQ free-tier refugees** (free edition axed ~2mo ago) | ongoing | QuoteIQ-alternative page + same import tool (2 waves, 1 build) | Aaron + Codex |
| 3 | **Invoice reminders → faster cash** | shipped Aug 1 | Cron live (daily 12:30Z); product-side reminder loop next (~0.5d) | Bot/Dev |
| 4 | **FB buying-intent threads (this week)** | NOW | lawnmowing101: scheduling-app request · Venmo/Zelle card-on-file pain · apps-for-jobs; bluecollarmillionaire 170-customer invoicing pain | Aaron manual engagement |
| 5 | **8 new OK leads** (Sunday batch) | Mon outreach | Reverse-lookup contact info, then cold emails (E1/E2 templates) | Aaron |
| 6 | **Directory submissions** | this week | Capterra/G2/SoftwareAdvice/GetApp self-serve (SoftwareWorld has no form) | Aaron (10-15 min) |
| 7 | **Jobber $119 gate ammo** | copy update | "Jobber gates auto-reminders + QuickBooks behind Connect $119; HCP at $149 — MowGo includes them flat" | BI copy flag → Aaron |

---

## 🔀 Competitor Changes (this week)

- **Jobber:** Promo ended Jul 31 → permanent ladder $29 Core + **$29/user on every tier**; AI Receptionist bundled into Plus; **Spanish mobile app for non-admin team members** (kills MowGo's "only bilingual" claim — scrub from copy; edge is now *full* Spanish incl. admin/app). Add-on stack: Reviews, Campaigns, Referrals, "Grow Faster" $79, Receptionist $99.
- **MowStack:** Shipped photo-proof galleries (MIME-validated, locked at completion), weather dispatcher inbox (7-day forecast + one-tap reschedule + customer email), Mapbox route map with real drive times, **equipment tracking**, **native iOS/Android apps (App Store + Google Play)**, **saved-card auto-pay**, customer portal (6-digit code login), time cards/payroll, CSV exports, ROI calculator on pricing page (18.1x claim — don't copy the math). Free tier + Pro $39.99 annual flat. **Most active builder in the segment.**
- **TurfHop:** Orbit AI confirmed (model choice: ChatGPT/Gemini/Claude, credits on entry tier); ThreadKore family (Pesthop/Gutterhop/Chemhop); **features page down 24h+ (500 error)** — ops instability signal. $49/$79/$129 unchanged.
- **Housecall Pro:** No changes (features page modified Mar 27). Entry $59/mo annual. "Voice to Invoicing" differentiator noted.
- **QuoteIQ:** SEO machine accelerated — new listicles (Top 8, Top 10 estimating/invoicing, Best Recurring Billing) with explicit "We're QuoteIQ" disclosure; recurring billing on every plan from $29.99; page still IP-blocked for direct fetch. Their numbers independently confirm Jobber/HCP gate ammo (auto-reminders at Connect $119, QB at HCP $149).
- **KaamCam:** $12/seat per-seat pricing — counter-narrative drafted (growth-ceiling math: MowGo wins at 4+ crew; flat vs per-seat).
- **Grassly:** Free tier confirmed loaded (route opt, GPS, photos, chemicals, QB, portal, bilingual at $0 + 2% fee) — 4 permanent $0 options now in solo segment; MowGo Solo sells "flat everything + no % fee."
- **New entrants:** LawnEstimates (instant address-based estimate widget, free 7-day trial, founder on Reddit) · Fieldproxy (AI routing) · tolodora.com/solvpro.com listicles · "Job Tools" ads in QuoteIQ snippets (unverified).
- **GreenPal launched in OKC (Apr, re-surfaced this week)** — aggregator on MowGo's home turf; note for OK lead messaging (independence angle).

## 📈 Market Trends

- **AI front-office is table-stakes marketing everywhere:** Jobber Receptionist (in Plus), HCP CSR AI/Analyst/Coach, QuoteIQ Virtual Call Team, TurfHop Orbit AI, Voice for Turf at the L&L Tech Conference (Jul 22-24, Scottsdale). MowGo has Autopilot (14 tools, OpenRouter) but it's invisible — **give it a public face on the landing page** (0.5d, no new build). Do NOT claim AI estimates (absent).
- **Conference takeaways (L&L Tech 2026 recap):** "find your $50K of waste" (Muskoka: +6% net profit from waste elimination, no new sales); "confirm an estimate request within 5 minutes" (Troops Mowing — direct support for booking-link P0); buyers ask "can a new hire learn it in <2 weeks?" (Bates); "20% through implementation then stall" is industry norm — zero-onboarding is a wedge (RulyScapes).
- **Robotic mowers pushing commercial** (Segway Navimow, Mammotion; $1.8B→$4.2B by 2030) — squeezes low-end residential mowing → crews move upmarket (fert/aeration/multi-service = more invoices). Supports MowGo multi-service positioning.
- **Numbers (verified):** US landscaping services $176.7B through 2026, $195B by 2031 (IBISWorld live — the "188.8B" figure circulating is wrong; verify before publishing any market-size number). Recurring maintenance = 60-75% of revenue at well-run residential ops (NALP); $1,800-4,800 LTV per residential account; auto-charge → 96-98% collection in 7 days vs 80-85% in 30 (QuoteIQ-compiled). Small firms (<10 emp) 18% AI adoption — fastest-growing AI buyers; GreenPal: 83% of pros haven't adopted AI.
- **M&A/consolidation** in landscape services (Visterra, Super-Sod, Winterberry) pushes larger ops to Aspire/ServiceTitan class — MowGo's 1-3 person ICP untouched.

## 📋 Lead Results (week + Sunday deep-dive)

- **Pipeline:** 17 tracked (9 prior + 8 new). Contacted 5 (Emerge Lawns, Metro Green, Bigfoot, Simply LawnCare on 7/29; Campbell & Sons 7/31). **Responses: 0. Conversions: 0.**
- **⚠️ Follow-ups overdue:** Emerge Lawns, Metro Green, Bigfoot, Simply — 3-4 days past first email. Campbell & Sons follow-up due ~Aug 3. Warm leads cool fast; these are the highest-ROI minutes this week.
- **New Sunday batch (all 🔴):** Chris Young (OK starter — brand-new, no lock-in) · Lawton OK duo "owner + partner Noah" (2-person = Crew $79) · Spray Masters (Owasso — recurring treatment programs) · Duncan OK weekly/bi-weekly op (SW OK, new geography) · TRIMLY TURF (active advertiser) · Melgar's Lawn Care · Native Lawn Care (verify) · Grand Lake couple (verify location). Contact paths: FB group DMs; reverse-lookup phone/email for Lawton duo + Spray Masters.
- **Blasian leads question:** Day 5 unanswered — ready-to-send reply draft in leads/ (1 min send).

## ✅ Recommended Actions (next 7 days)

1. **Aaron (Mon AM):** Send 4 follow-up emails (drafts ready for Emerge; E1/E2 templates for others) + Campbell & Sons follow-up.
2. **Aaron (Mon):** Post "Jobber promo just ended" content (drafts A/B/D) — window is live; facts verified.
3. **Aaron:** Reply to the 4 FB buying-intent threads (lawnmowing101 ×3, bluecollarmillionaire) + lawnmowing101 "Jobber or QuoteIQ?" (from Aug 1).
4. **Aaron:** 6 manual Reddit posts (28 drafts ready): top targets r/Entrepreneur `1i3pv4b`, r/landscaping `1rm499y` (feature-goldmine — check Mon), r/CRM `1v6vwcn`, r/LawnCareBusinessCRM `1l0y40z`, plus Jobber-complaint thread `1bfw00i`.
5. **Aaron:** Directory submissions (Capterra/G2/Software Advice/GetApp — 10-15 min; SoftwareWorld needs vendor-channel contact).
6. **Aaron:** Decisions — trial length (CF says 7d, copy says 14d; checkout grants 7) · CF cleanup (VITE_STRIPE_PRICE_SOLO legacy $49, VITE_FORCE_DEMO) · delete mowflow project in CF dashboard.
7. **Dev/Codex:** Quotes v1 (scoped, 3-5d) · competitor import (~1d) · card-on-file auto-pay (1-2d, post-quotes) · 0.5d wins (invoice reminder loop, rain-delay notify, geo-sort). Invoice-reminder cron already live.
8. **BI (next runs):** Lane cycle continues (competitor → trends → pricing → features); re-check TurfHop /features/ (recovery or continued 500); verify Service Autopilot $49 directly; watch MowStack for price/positioning moves; re-run LawnEstimates check.

## 📊 Metrics Snapshot

| Metric | Value | Trend |
|--------|-------|-------|
| Tracked leads | 17 | +8 this week |
| Contacted | 5 | 0 replies |
| Reddit 48h threads found | 0 (403-block day 9) | 15+ seen-added evaluated |
| Reply drafts | 28 | 0 posted (Aaron-side) |
| Production checkout | LIVE (Aug 1) | Day-16 blocker resolved |
| Invoice reminders | cron live | daily 12:30Z |
| Feature builds scoped | quotes v1, competitor import, auto-pay | — |
| Pricing moves by competitors | 0 | full matrix captured |

## 🚧 Blockers (Aaron-side)

Reddit posting (Day 9, 28 drafts 0 posted) · SoftwareWorld/comparison-site absence (Day 18) · cold-outreach method — 5 sent / 0 replies (follow-up cadence is the gap) · Blasian reply (Day 5) · mowflow project deletion (CF guard 8000076) · trial-days decision (7 vs 14).

---

*State: .bi_state.json v10 → v11 (lanes cycled; seen URLs 82→85; weekly_digest_week → 2026-W32). Intel: intel/2026-08-02_0358.md (feature ideas lane). Leads: leads/LEAD_TRACKER.md (17). Full archive: bi_report_2026-07-28 … bi_report_2026-08-01_2355.md.*
