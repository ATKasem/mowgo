# MowGo Nightly Vault Sync — 2026-08-05

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Aug 4, 13:55 – Aug 5, 02:00 UTC (since last scan; ⚠️ the Aug 4 nightly sync was skipped — vault backfilled from the Aug 4 13:55Z scan, see `2026-08-04_daily-sync.md`)
> **Total messages synced:** 50 (6 mowgo — 6 new + 44 outreach — 44 new + 0 cowork — 0 new)

---

## 📊 Decisions

- **✅ Jobber "$29/mo" headline VERIFIED — Tue watch item CLOSED.** Live check (getjobber.com/pricing): Core **$29/mo is annual-only bait** (1 user, $348 upfront; **$49 month-to-month**). Reminders + autopay still gated at **Connect $99+** (Grow $149, Plus $399). MowGo's flat-price compare story survives — now with receipts. Close `jobber_pricing_verify`.
- **🏆 Compare-page claim unlocked (5-competitor verified):** the collection loop (reminders / autopay / routes / texting) is gated at **$99–249 everywhere** — Jobber $99, HCP $149, GorillaDesk $99, QuoteIQ $149.99, LawnPro $249. MowGo ships the whole loop at **$49/$79 flat**. The compare page can now claim it directly.
- **🚀 Feature idea #1 UPGRADED:** rain-delay **"shift +1 day" with one-tap auto-text to affected clients** — Jobber shipped "auto-notify clients on reschedule + bulk shift" (Jul 24), validating the exact idea; rain = top pain in OK_LEADS_100 (Emerge, NG Outdoor). Rain-delay marketing page already exists; close the loop in-app. S–M effort, high retention value.
- **🚫 Do NOT chase Jobber's costing / payroll / audit logs** — competitor velocity note: simplicity + flat price + closed loop is the moat; stay off the upmarket treadmill.
- **🟢 Reddit cadence locked:** NO posting until **≥ Fri Aug 7 22:21Z** (96h gate from the Aug 3 post). Window kit ready: Templates A/B/C + draft **#38 (Nextdoor `1vfhp9z`)** + backup draft **#40 (hydroseeding `1vfpd5m`)**. Pull fresh threads from Aug 7–8 sweeps, not cold ones.
- **🆕 SMS outreach engine live:** new **"🌱 Rule of 100 — daily MowGo content + outreach"** cron (job `d37092913d72`) posting daily 5 texts + 3 FB/IG posts; **SMS Batch 1 = 21 per-lead scripts** (Day 1/2/7) built on the Hormozi playbook, each hook tied to the real OK rate report ($55.25 state avg). Rule: never pitch the app in message 1; offer the rate report on reply; **log sends 🔴→🟡 in LEAD_TRACKER.md**.
- **🧹 Concierge notification channel wired** (test message 14:52Z Aug 4) — new pipeline exists; needs a real request to verify end-to-end.
- **🕵️ QuoteIQ review-farming on r/WhichCRM** (YouTube Shorts self-seed) — skip the thread; new evidence for review-request feature priority.

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **🚨 NEW — Rule of 100 cron DUPLICATE-POST bug.** At 02:02–02:06Z the cron re-posted a **12-message subset** of the SMS Batch-1 scripts posted 01:33Z (byte-identical; **OKC Top Choice #10 posted 3× total**). Fix the dedup in job `d37092913d72`. Risk: if sends are copied from the channel, leads get two Day-1 texts. Canonical copy = the 01:33 batch.
2. **📲 SMS Batch 1 — Day 1 sends queued (Aaron).** Rule of 100 named today's 5: **NG Outdoor (Edmond), Frankies (Norman), A Plus (OKC), Mow-Town (Ardmore), Complete Lawn Care (Tulsa)** — all with verified phones, zero Day-1 sends logged. Full 21-script batch posted to #🌱mowgo-outreach. Log each send in LEAD_TRACKER.md.
3. **🔴 Lead follow-ups Day 8 — STILL pending.** Emerge / Metro Green / Bigfoot / Simply (sent Jul 29) + Campbell & Sons (Jul 31): **0 replies**. If silent by Fri, fire the 2nd follow-up script. Highest-ROI 10 minutes this week.
4. **📅 Next Reddit slot ≥ Fri Aug 7 22:21Z.** Drafts #38 (Nextdoor — "check twice a day, reply within the hour, only posts <1 day old, never quote in-thread, dm me your address, quote today") and #40 (hydroseeding pivot, Blasian's story fits) ready. Fresh threads only.
5. **💳 Aaron: logged-in end-to-end Stripe checkout — Day 19**, still the only unproven link (functions live, 14 env vars verified).

### 🟡 Medium

6. **SoftwareWorld + directory submissions — Day 23** of listicle absence; QuoteIQ co-founder self-ranks #1 in his own listicles. 10–15 min each.
7. **Cowork channel cleanup (~127 watchdog-spam messages)** + decide watchdog delivery channel (currently cowork; consider #🌱mowgo or dedicated ops).
8. **quotes v1 (#1 build priority, unchanged)** · online booking link P0 (Day 14) · auto-pay card-on-file · photo proof — roadmap unchanged.
9. **Review-request feature (#2)** — new evidence both ways: QuoteIQ review-farming (they're gaming it) + Jobber Marketing Suite ships it at Plus $399+.
10. **Jobber AI Receptionist moved to Plus-only $399+** (was the $99 add-on QuoteIQ attacks) — refresh compare page if it cites the old figure.
11. **Watch:** QuoteIQ AI push (voice Autopilot, 35+ actions) · TurfHop outage ammo · `1ve8hew` 60-sec invoice entrant · MX Build profile (still owed from Aug 4 lane).

### 🟢 Low

12. **Blasian** — still no human messages (last "hello" Jul 29 15:39; **Day 7–8**). Leads question (Jul 28) unanswered Day 8; draft ready.
13. **Yardbook** — premium pricing page 404s; free/ad model unchanged (watch-only).
14. **LawnBoss monitor** (growth halved 829→404) · LawnEstimates weekly shipping · GreenPal OKC — watch list unchanged.

---

## 🔬 Research Findings

### ⭐ Jobber pricing VERIFIED live — "$29" is annual-bait (Tue watch item CLOSED)
- Core **$29/mo annual** (1 user, **$348 upfront**) / $39 1-yr / **$49 month-to-month**, +$29/user after · **Connect $99** annual (reminders + autopay + QBO) · **Grow $149** (2-way SMS, job costing) · **Plus $399** (AI Receptionist, Marketing Suite). Jobber claims **300,000+ pros**.
- **Everything MowGo sells is still $99+ on Jobber.** The "$29 headline" resolves the $29-vs-$49/$139 conflict: both real, different billing terms.

### 🆕 LawnPro free tier live-verified (SwitchingFromLawnPro ammo)
- Free plan: **25-client cap**. **2-way text + auto-charge locked at Plus $249** → the collection-loop gate list grows to 5 (Jobber $99 / HCP $149 / GorillaDesk $99 / QuoteIQ $149.99 / LawnPro $249).

### ⭐ QuoteIQ all-in on AI (competitor lane, Run 1/4)
- AI Autopilot (voice commands, **35+ actions**), Copilot, Estimator, Before/After AI, Virtual Call Team — with direct price attacks on Jobber ($99 add-on), Hover ($99), ResponsiBid ($179–229).
- Cites **Invoca: contractors miss 27% of inbound calls** (Template A ammo for the AI-receptionist wedge: "1–3 person crews don't need an AI front desk — they need the missed call to become a booked job tomorrow"). Headline "4.7★ · 4,100+ verified reviews" (farming continues). Elite $299 / Max $699 re-confirmed.

### 📡 TurfHop /pricing down ~87h+ — 10th consecutive check
- Leaked **full .NET stack trace**; pricing dead **3.5 days** at a direct lawn competitor. Usable factual aside in comparison threads.

### 📊 Feature lane: Jobber validates rain-delay shift (Run 3/4)
- Jobber shipped "auto-notify clients on reschedule + bulk shift" (Jul 24) → MowGo's **"shift +1 day, one tap, auto-text clients"** is now validated-by-competitor, not just hypothesized. Feature ideas stack: #1 rain-delay shift+notify (upgraded) · #2 auto review-request (QuoteIQ review-farming = new evidence) · #3 photos on invoices · #4 geo auto-route. Watch: Jobber job costing/profit alerts (upmarket, revisit at 20+ customers), WhatsApp/DM booking (trending), AI photo estimating.

### 🐦 Reddit (posting paused on 96h gate; account clean)
- **0 new high-priority on-ICP threads** across 8 subs in 48h (midweek quiet; r/lawncare + r/landscaping all homeowner).
- `1vfci4c` r/smallbusiness "missed calls when on a job" (2h old, 0 comments) — freshest on-ICP thread in days; validates the AI-receptionist wedge; friend-mode draft banked, no product.
- Draft #40: `1vfpd5m` r/Entrepreneur hydroseeding pivot (ex-dev asks honest numbers/seasonality — **Blasian's real story fits**). Karma-builders banked: `1vff40b` (r/CRM AI-complexity — safest), `1vfa9cq` (first-paying-client), `1vfamp8` (service-vs-product). Skipped: `1vfgjnw` (QuoteIQ self-seed), `1vfj336` (hostile market-research trap), `1vfb5jf` (travel-site SEO, not lawn).

### 🌱 Outreach stack shipped (channel reactivated after 10 dormant days)
- **OK rate report** (real, verified — $55.25 avg; Broken Arrow $67.08 → Bethany $48.01; LawnStarter data refreshed 08-03) · **SMS Batch 1: 21 scripts** with per-lead angles · **Content draft** (5 Reddit pieces + 5 IG pieces + 14-day calendar + lead-magnet loop) · **IG carousels** (B2 5-slide, B2V Reels 9:16, B3 "invoice nobody sends", B4 "5 signs") · **phone-ready HTML copy** of the rate report · **Rule of 100 cron** (daily 5 texts + 3 posts).

### 🔧 Intel Engine / infra — this window
| Component | Finding | Status |
|---|---|---|
| Intel Engine runs | 3 OK runs (16:35 pricing · 20:45 feature ideas · 00:50 competitor), state v24, seen 253→341 | ✅ cadence healthy |
| Concierge notifications | Test message 14:52Z — channel wired | 🧪 needs real-request test |
| Provider watchdog | Silent since 13:50Z Aug 4 fix — 0 new failures in cowork | ✅ held |
| Rule of 100 cron | New daily job — but duplicate-post bug (12-msg subset re-posted 02:02Z) | ⚠️ fix dedup |
| Reddit posting | Gated until Aug 7 22:21Z; account clean, both prior comments verified visible | ✅ |

---

## 📝 Notes / Context

### Channel Activity (since Aug 4 13:55Z)
- **#🌱mowgo** — 6 new messages, ALL bot-generated: Concierge test (14:52) + Intel Engine ×3 runs (16:35 pricing / 20:45 feature ideas / 00:50 competitor, one split 2-part = 5 msgs). **No human messages — Blasian silent since Jul 29 15:39Z (Day 7–8).**
- **#🌱mowgo-outreach** — **44 new messages — first activity in 10 days** (channel dormant since Jul 26). Rate report + SMS batch + content/IG assets (Aug 4 15:07–15:48), Rule of 100 daily cron posts (Aug 5 01:17), full 21-script SMS batch (01:33), phone-ready copy (01:48), duplicate subset re-post (02:02–02:06).
- **🤝mowgo-cowork** — 0 new. Watchdog spam stopped 13:50Z Aug 4; ~127 failure messages still in channel awaiting cleanup.

### Escalation Timeline (execution gap)
| Blocker | Flagged | Now | Status |
|---|---|---|---|
| Stripe checkout on mowgo | Day 1 (Jul 17) | Day 19 | ✅ LIVE; **only unproven link: logged-in test checkout (Aaron)** |
| Invoice reminders cron | Aug 3 | — | ✅ Closed — 2+ consecutive OK runs |
| Provider-failover spam | Aug 4 | — | ✅ Fixed 13:50Z; ~127 msgs await channel cleanup |
| Jobber "$29" pricing conflict | Aug 4 | — | ✅ CLOSED this sync — annual-bait verified |
| Comparison-site absence | Day 1 | Day 23 ❌ | Directory submissions still highest-leverage 30 min |
| Cold outreach (17 leads; 5 emailed) | Jul 24 | Day 8 ❌ | 0 replies; SMS Batch 1 (21 scripts) now queued — Day 1 sends listed today |
| Reddit replies | Week 1 | Gated to Aug 7 ❌ | Pipeline live + clean; next slot ≥ Aug 7 22:21Z; drafts #38/#40 ready |
| Blasian human loop | Jul 29 | Day 8 ❌ | Silent 7 days; leads question unanswered; reply draft ready |
| Online booking link | Jul 23 | Day 14 ❌ | P0, not started |
| Solo pricing debate | Jul 30 | Day 11 | Intel: HOLD $39/$79 flat (5-competitor gate proof now) |

### Key Takeaway
The machine side of MowGo is now **outrunning the human side by design**: overnight the bot stack shipped an entire outreach engine (real rate-report asset, 21 honest SMS scripts, IG/Reels content, a daily Rule-of-100 cron) and closed the Jobber pricing question with receipts — **$29 is annual-bait; every feature MowGo sells is gated $99+ on Jobber, and the collection loop is $99–249 across all 5 competitors**. Two NEW machine-side issues to fix today: the **Rule-of-100 cron double-posted 12 SMS scripts** (dedup bug, double-text risk) and the **Concierge test channel needs a real end-to-end request**. The human plate is unchanged and urgent: **Day-1 SMS sends (5 named leads), follow-ups Day 8 (0 replies), Blasian reply (Day 8), logged-in Stripe checkout (Day 19)** — and nothing on Reddit until Fri Aug 7 22:21Z.

---
*Generated by MowGo nightly vault sync — 2026-08-05 02:00 UTC*
