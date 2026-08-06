# MowGo Nightly Vault Sync — 2026-08-06

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Aug 5, 02:00 – Aug 6, 02:00 UTC
> **Total messages synced:** 11 (11 mowgo — 11 new + 0 outreach + 0 cowork) · 255 fetched (100/55/100)

---

## 📊 Decisions

- **✅ Rule of 100 duplicate-post bug — RESOLVED (verified).** The Aug 5 15:11Z run applied a **dedup gate** (excluded the prior batch's 5 leads — NG Outdoor, Frankies, A Plus, Mow-Town, Complete Lawn Care — and picked the next 5: J&C Mowing, Thogy's, Premier, Scott's, J & Jays) and the job's delivery was **moved from #🌱mowgo-outreach → #🌱mowgo-leads** (`deliver: discord:1529707289014042804`, confirmed in-channel). The 12-message duplicate subset (02:02–02:06Z) is also **gone from outreach history** (67 → 55 fetched) — cleanup happened. Schedule is `0 15 * * 1-5` (15:00Z weekdays; next run today 15:00Z). Close `rule100_dedup`.
- **🏗️ Next build pick (Intel Run 4/4): client booking link.** Self-booking is paywalled everywhere: QuoteIQ $299/$699, Jobber $119+, GorillaDesk $49+per-route. "**Included at $39 flat**" = the compare-page line; also fills cancellations. S–M effort. (Formalizes the online-booking P0, Day 16.)
- **🧰 New free win — missed-call text-back.** Twilio number is already being set up for rain-delay SMS; one more edge function texts "sorry we missed you." Jobber's AI Receptionist does this at $399+; MowGo needs **zero AI** (27%-missed-calls ammo from the trends lane).
- **🏆 mowgoapp.com now ranks #1 for its own brand query** ("MowGo lawn care software") — first time the site leads; zero listicle/directory presence still (Day 25).
- **🚫 Werx → watch list only, NOT compare page** ($49/mo + $6/user generalist contractor tool, 26 industries; LOW–MODERATE threat). **Servinix** is the real mid-Sept threat (beta Aug 17, commercial Sept 14).
- **🟢 Reddit kit locked for TOMORROW:** ① draft #43 (`1vfyg2j` first-5-customers) → ② #44 (AI calls) → ③ #38/#40/#41. Final check on watch threads `1vg1ltw`/`1vfzyn2` Fri, then purge. 4 consecutive quiet sweeps.
- **Nothing needs Aaron tonight** (per Run 6/6): Friday = post #43 at 22:21Z gate + Jobber $29 re-verify + lead follow-up Day 10.

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **🐦 Reddit slot TOMORROW — Fri Aug 7, 22:21Z (96h gate).** Kit: ① #43 `1vfyg2j` (r/sweatystartup first-5-customers, fencing co — freshest banked draft) → ② #44 `1vfyelq` (AI-assistant calls) → ③ #38/#40/#41. Sweeps have been quiet 4 windows straight — this kit is all there is; grab any fresh on-ICP threads in the Aug 7 sweeps.
2. **📲 SMS Day-1 sends — TWO waves queued, ZERO logged.** Wave 1 (Aug 5 01:33Z): NG Outdoor, Frankies, A Plus, Mow-Town, Complete Lawn Care. Wave 2 (Aug 5 15:11Z): J&C Mowing, Thogy's, Premier, Scott's, J & Jays. **LEAD_TRACKER.md untouched since Aug 2 13:25Z (re-verified tonight)** — none of the 10 sends logged. Scripts in #outreach (wave 1) and #🌱mowgo-leads (wave 2).
3. **🔴 Lead follow-ups Day 10 — STILL 0 replies.** Emerge / Metro Green / Bigfoot / Simply (Jul 29) + Campbell & Sons (Jul 31). 2nd follow-up script fires Fri if still silent. Highest-ROI 10 min, unchanged.
4. **💳 Aaron: logged-in end-to-end Stripe checkout — Day 21.** 09:14Z health check all green (functions live, `rk_live_` valid, no-key-in-bundle = by-design server-side checkout, iOS `pk_live_` intact, **mowflow.pages.dev now RETIRED** — "MowGo has moved" stub, old `cs_live_` build gone). The ONLY unproven link remains one real logged-in checkout.
5. **💬 Blasian reply — Day 9.** Leads question (Jul 28 17:03Z) still unanswered (now has a ✅ reaction, but no reply). Draft ready at `leads/blasian-reply-draft-2026-08-01.md`. Human loop silent 8 days.

### 🟡 Medium

6. **SoftwareWorld + directory submissions — Day 25.** Brand query #1 win, but zero listicle presence; QuoteIQ's co-founder keeps self-ranking #1 in his own content (new "Top 8" listicle seen today).
7. **Roadmap unchanged:** quotes v1 (#1 build priority) · **booking link = the named P0** · auto-pay card-on-file · photo proof galleries · review-request text (#1 unshipped cheap win).
8. **Missed-call text-back edge fn** (free win — build alongside the in-progress Twilio/rain-delay SMS setup).
9. **Cowork channel cleanup (~127 watchdog-spam messages, Day 4)** + watchdog delivery-channel decision. Outreach duplicates WERE cleaned — same tooling can clear cowork.
10. **Watch:** Servinix launch (Sept 14) · Werx (watch only) · QuoteIQ content machine · TurfHop outage ammo (12th check, ~101h+) · LawnBoss decline (287/mo, 3rd straight drop, ~65% off peak).

### 🟢 Low

11. **Blasian** — zero human messages anywhere since Jul 29 15:39Z (Day 8 of silence; Day 9 on the leads question).
12. **Concierge e2e test** still pending (channel wired Aug 4, never carried a real request) · **MX Build profile** still owed · **trial 7 vs 14 days** decision · mowflow CF project deletion confirm (domain retired regardless).

---

## 🔬 Research Findings

### ⭐ Market sizing double-confirmed (Runs 2/4 + 6/6)
- US lawn care services **$62.91B (2026) → $79.68B (2031), 4.85% CAGR** (Mordor); **maintenance = 91.5% of revenue** — MowGo's recurring-mow core has the tailwind. NALP: mild-moderate 2026, typical firm **+8.5% sales**.
- Lawn-care software **$2.33B (2025) → $3.97B (2035), ~5.5% CAGR** (MarketResearchFuture) — sourced compare-page line.

### ⭐ BEST NUGGET — adoption blocker quantified
- **49.4% of landscapers say training/implementation is the #1 adoption blocker** (Granum/LMN, n≈700). Onboarding speed = MowGo's wedge vs ServiceTitan's $5k–50k implementation and Jobber's sprawl. Blog/SEO fuel.

### 📞 Missed-call economics quantified (trends lane)
- **27% of home-services calls go unanswered** (60M+ call dataset; 20–40% miss rates, 40–50% at seasonal peaks); **85% of voicemail callers never call back** (CallRail); **avg missed call ≈ $1,200**. Corroborates the Invoca stat QuoteIQ uses — usable sourced on compare page / Template A. The wedge: "the call becomes a booked job tomorrow," not a $99+/mo AI front desk.

### 🛠️ Software is the 2026 story
- **62% of commercial landscapers run 7+ systems**; top switch triggers = **automate workflows (58%) / efficiency (51%)** — exactly auto-invoice + route merge. **Labor crunch:** 59% of landscape firms say hiring is harder than pre-COVID, 76% have open roles → crews can't hire, so software does the office work. PE consolidation at record pace — all commercial/mid-market; 1–3 person residential long tail untouched = ICP intact.

### 🕵️ Competitor monitoring (Run 5/5, 18:16Z)
- **TurfHop /pricing + /features: HTTP 500, 12th check, ~101h+** — longest verified outage in tracker history; homepage CTA still points at the dead page.
- **LawnBoss: 287 pros/mo** (was 404 Aug 3, 829 Jul 27) — 3rd straight decline, ~65% off peak; free-competitor momentum stalling.
- **Werx profiled:** $49/mo + $6/user, 26 industries incl. lawn care, QBO sync + Stripe + field apps, G2 4.4/Capterra 4.8 — generalist (Jobber-style), no lawn-specific routing/rain story → watch list only.
- **Servinix:** unchanged — beta Aug 17, commercial **Sept 14**; Maya AI receptionist front and center; route opt included in FSM (same flat-included wedge as MowGo); review-request automation included.
- **Status sweep 18 URLs:** all 200 except TurfHop; QuoteIQ/Jobber/SA pricing verified this morning (compare page `70a2ef4`) — no changes.
- **Pricing context:** mid-market crowded at $199–299 (QuoteIQ $299, SA Pro $199); **Jobber promotes Core at $29/mo** (academy page) up to $529 — low-end anchor to watch; MowGo's flat $49–79 stays its lane. "95% of lawn businesses don't need [ServiceTitan]."

### 🏗️ Feature lane (Run 4/4, 13:52Z)
- **Booking link pick** (gates: QuoteIQ $299/$699, Jobber $119+, GorillaDesk $49+per-route) · **missed-call text-back** (free win) · day-3 quote nudge · $/1000sqft price-book · profit card (5 new ranked ideas).
- **GorillaDesk ships route opt on Basic $49** — undercuts QuoteIQ's $299 gating. **Yardbook is Android-only** — MowGo's native iOS = edge. Rain-delay SMS **in build**, not re-proposed. Review-request text remains the #1 unshipped cheap win.

### 🐦 Reddit (4th consecutive quiet window)
- 0 bankable drafts; only on-ICP hit `1vglf7r` (r/lawncare "built my own tracker" video, 0 comments, no ask) → skipped. RSS fetch pattern (`www.reddit.com/comments/{id}.rss` after 3-min cooldown, 60s spacing) held through heavy 429 storms.

### 🔧 Infra — this window
| Component | Finding | Status |
|---|---|---|
| Intel Engine | 5 clean runs (05:14 / 09:26 / 13:52 / 18:16 / 22:28Z), state v24→v29, seen 341→739 | ✅ cadence healthy |
| Stripe health check | 09:14Z all green; mowflow.pages.dev RETIRED (stub live, old build + cs_live_ gone) | ✅ mowflow_project_delete CLOSED |
| Invoice reminders | 12:30Z: OK — 0 unpaid >7d | ✅ |
| Rule of 100 cron | Dedup gate applied + delivery moved to #🌱mowgo-leads; outreach duplicates cleaned (67→55) | ✅ FIXED |
| Provider watchdog | 0 new failures; ~127 old spam msgs still in cowork | 🟡 cleanup pending |
| Reddit posting | Gated until Fri Aug 7 22:21Z; kit ① #43 → ② #44 → ③ #38/#40/#41 | 🟢 |

---

## 📝 Notes / Context

### Channel Activity (since Aug 5 02:00Z)
- **#🌱mowgo** — 11 new, ALL bot cron reports: Intel Engine ×5 runs (05:14Z trends, 09:26Z pricing, 13:52Z features, 18:16Z competitor, 22:28Z trends — each 2 msgs except 13:52Z) + Stripe health check 09:14Z (2 msgs) + invoice reminders 12:30Z. **No human messages — Blasian silent since Jul 29 15:39Z (Day 8).**
- **#🌱mowgo-outreach** — **0 new** (newest = Aug 5 01:48Z). The 02:02–02:06Z duplicate subset is GONE from history (67 → 55 fetched) — cleaned since the Aug 5 12:08Z scan. Rule of 100 now delivers to #🌱mowgo-leads.
- **🤝mowgo-cowork** — 0 new; watchdog holding. ~127 failure messages still awaiting cleanup (Day 4).
- *(Cross-check)* **#🌱mowgo-leads** — Rule of 100 15:11Z post confirmed delivered (5 new Day-1 SMS + 3 FB/IG posts); Blasian's leads question (Jul 28) still unanswered, now with a ✅ reaction.

### Escalation Timeline (execution gap)
| Blocker | Flagged | Now | Status |
|---|---|---|---|
| Stripe checkout on mowgo | Day 1 (Jul 17) | Day 21 | ✅ LIVE; **only unproven link: logged-in test checkout (Aaron)** |
| Rule of 100 duplicate-post bug | Aug 5 | — | ✅ RESOLVED Aug 5 15:11Z — dedup gate + delivery moved to leads channel |
| Provider-failover spam | Aug 4 | Day 4 | 🟡 Fixed 13:50Z; ~127 msgs await channel cleanup |
| Comparison-site absence | Day 1 | Day 25 ❌ | Directory submissions still highest-leverage 30 min; brand query now #1 |
| Cold outreach (17 leads; 5 emailed) | Jul 24 | Day 10 ❌ | 0 replies; **10 Day-1 SMS queued across 2 waves, 0 sends logged** (tracker untouched since Aug 2) |
| Reddit replies | Week 1 | Slot TOMORROW ✅ | Fri Aug 7 22:21Z gate; kit ① #43 → ② #44 → ③ #38/#40/#41 |
| Blasian human loop | Jul 29 | Day 9 ❌ | Silent 8 days; leads question unanswered; reply draft ready |
| Online booking link | Jul 23 | Day 16 | P0 now NAMED: booking link ("included at $39 flat" compare line) |
| Solo pricing debate | Jul 30 | Day 12 | Intel: HOLD $39/$79 flat — $29–49 band all teasers/lock-ins |

### Key Takeaway
A fully machine-driven day — **11 bot messages, 0 human**. Two machine-side wins closed: the **Rule of 100 dedup bug is fixed** (gate verified in the 15:11Z run, delivery moved to the leads channel) and the **outreach duplicate batch was cleaned** (67 → 55 messages). The bot stack produced a strong intel day: market sizing double-confirmed ($62.91B → $79.68B), the **49.4% onboarding-blocker nugget** (new wedge: onboarding speed vs ServiceTitan's $5k–50k implementation), missed-call economics quantified (27% unanswered / 85% never call back / ~$1,200 avg), mowflow retirement confirmed, TurfHop's longest-ever outage (101h+), and a first SEO win (brand query #1). **Friday Aug 7 is the hinge: Reddit post #43 at 22:21Z, Jobber $29 re-verify, and follow-up Day 10.** Aaron's plate is unchanged but growing: 10 named SMS Day-1s across two waves with zero sends logged, 5+1 follow-ups at Day 10 with zero replies, Blasian's reply at Day 9, the Stripe logged-in checkout at Day 21, and directory submissions at Day 25.

## 💰 Copy flags banked (8am action — Aug 6, from Intel Runs 02:35Z/06:48Z/11:16Z)

1. **Jobber's $29/mo needs a 1-year lock, a first-year promo, and $29 per extra user** — and they're now running 3-month promos on everything (Core $24–40/mo first term) because demand is soft. MowGo is flat and month-to-month.
2. **QuoteIQ's $29.99 adds its own 1% processing fee on top of Stripe (3.9% total)** — and route optimization still costs $299/mo. MowGo Crew is $79 flat. (Price-Lock Guarantee = reactive churn defense after July's hike.)
3. **Service Autopilot's $49 is one mobile license**; a 2-person crew is $199+ with a signup fee and annual-only billing. MowGo Crew is $79 flat, whole crew.
4. **QuoteIQ's own review wall: "SUPER buggy", "logs me out", "feels like it's still in beta, except you're paying them to test it"** — the small one that just works.
5. **49.4% of landscapers say training/implementation is the #1 adoption blocker** (Granum/LMN) — MowGo onboards in minutes, no $5k–50k implementation.
6. **TurfHop's pricing page was down Aug 1–6** (features page still is) — 5 days of dead signup flow mid-season. Use as time-stamped aside only (recovered 11:16Z Aug 6).
7. **Planado charges per user ($12–29/user/mo) and has no invoicing or payments at all** — MowGo's auto-invoice + SMS pay link loop is the wedge.
8. **"Cancel anytime, no phone call"** vs QuoteIQ's 2-month cancel saga (review-wall sourced).

→ Compare page + SEO static page refreshed with 1–7 (Jobber promo math, QuoteIQ 1%+Price-Lock, SA one-license, TurfHop recovery note, Planado row) — deployed via commit (see daily_actions.json).

---
*Generated by MowGo nightly vault sync — 2026-08-06 02:00 UTC*
