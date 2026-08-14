# MowGo Nightly Vault Sync — 2026-08-10

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach ⚠️, #🤝mowgo-cowork
> **Sync window:** Aug 9, 02:00 – Aug 10, 02:00 UTC
> **Total messages synced:** 14 (14 mowgo + 0 outreach + 0 cowork) · 100 fetched (100 / 404-channel-gone / 0) · +0 new cross-check from #🌱mowgo-leads

---

## 📊 Decisions

- **✅ Mon Aug 10 22:23Z Reddit slot STILL ARMED.** Cron `4c195234eaa9` confirmed enabled. Kit: `1vj4wob` (pricing question, new solo op) → `1vj9nay` (building quote form by hand) → fallback. Reply drafts in `intel/`. **First slot since the 96h gate — fire tonight.**
- **⚠️ Reddit RSS pipeline DEGRADED — 403 at 21:38Z.** Was working at 10:00Z but all 5 target subreddits now return 403. If RSS stays 403, need alternative: Hound search or old.reddit HTML scrape. Mon 22:23Z slot uses the cron poster kit (not RSS), so tonight's slot is unaffected.
- **⚠️ Intel Engine HTTP 402 (Insufficient Balance) at 09:48Z.** First time this has fired — OpenRouter balance may be low. Recovered by 13:37Z (next run succeeded). Flag for Aaron's attention.
- **✅ Stripe health check all green — no regression.** Both domains (mowgo.pages.dev, mowgoapp.com) deployed, auth-gated as designed. verify-session bug (Aug 2) remains fixed. iOS `pk_live_` format-valid. CF API tokens still dead (see tasks).
- **✅ Invoice reminders: 0 unpaid invoices** — clean sweep, no invoices older than 7d.
- **🤖 Robotic mower labor dynamics shifting.** UF/IFAS study: robots improve lawn health while reducing labor. ANTBOT debuts smart series (CES 2026). Carbon Robotics $1M/unit, Blue River exit $305M. **Implication:** robots eat entry-level mowing jobs but create demand for higher-value packages (aeration, irrigation, design-build) — exactly the Premium seasonal-pack opportunity.
- **🏢 PE consolidation record pace continues** (TruArc/Schill, Visterra, HighGrove, DJ's, Osprey) — all commercial/mid-market; 1-3 person residential long tail untouched.
- **🌱 Electric transition regulatory now:** CA bans new gas-equipment sales, SF bans city-contractor gas equipment (Jan 1 2026), PA municipal ordinances advancing. Another vector for the "future-proof" positioning.
- **📊 QuoteIQ's hidden 1% fee** on top of Stripe (~3.9% total) = confirmed compare-page bullet. We charge 0%.
- **🌊 LawnBook** ($0-29.99, free=15 clients vs our 5) = pricing floor threat. Counters: web app, native apps, crew dashboard, booking link, no-card trial.
- **🟢 Cowork channel empty & healthy** — watchdog holding Day 10, 0 new failures since Aug 4 13:50Z fix.
- **🗑️ #🌱mowgo-outreach GONE — 4th consecutive nightly 404** (deletion confirmed). References pending cleanup.

---

## 🎯 Action Items / Tasks

### 🔴 Critical

1. **📣 Mon Aug 10 22:23Z — FIRE the Reddit slot.** Cron `4c195234eaa9` armed. Kit: `1vj4wob` → `1vj9nay` → fallback; stop at first visible post; verify visibility after (API success ≠ visible); 1-post/slot rule.
2. **💬 Aaron — UNPAUSE the SMS Sender cron (Day 9).** `3f67268baeb6` still DISABLED. **23 texts queued, 0 sent.** `hermes cron resume 3f67268baeb6` unblocks it. Wave-1 Day-2 follow-ups become due the moment sends start.
3. **🔑 Aaron — refresh BOTH CF API tokens** (Cloudflare dashboard → `/opt/data/.env`). Still dead (10000 auth error) since Aug 7; blocks cf_check.py + any non-git-push deploy.
4. **📝 Blasian — #48 manual paste** (r/sweatystartup `1vgvrg5`, AutoMod-filtered) **+ Blasian leads reply** (Jul 28 "How would we get leads for MowGo" — Day 14, never answered; draft ready at `leads/blasian-reply-draft-2026-08-01.md`).
5. **📧 Lead follow-ups — Day 14, STILL 0 replies.** Emerge / Metro Green / Bigfoot / Simply (Jul 29) + Campbell & Sons (Jul 31). 2nd-follow-up script drafted but **still unsent** (was due Aug 7). Highest-ROI 10 min, unchanged.
6. **💰 OpenRouter balance check — Intel Engine 402 at 09:48Z.** Sufficient balance recovered by 13:37Z, but needs monitoring. May need top-up.
7. **🤝 Mon friend-mode replies:** `1vj4wob` (pricing question, new solo op) + `1vj9nay` (building quote form by hand, warm lead). Drafts ready in `intel/`.

### 🟡 Medium

8. **🔧 Reddit RSS 403 — implement alternative.** If RSS stays 403, replace with Hound search (`site:reddit.com`) or old.reddit HTML scrape. Intel Engine pipeline check flagged this.
9. **📱 Compare page next edit:** add QuoteIQ 1% hidden fee bullet, LawnBook row, and seasonal-pack angle from robotic mower shift.
10. **📱 Missed-call text-back — PRIORITY UP (Effort S).** THE wedge vs the AI-receptionist arms race; Twilio number already being onboarded.
11. **🌊 Level billing (M) + schedule-change broadcast (M)** — drought-season #1 feature + its sibling.
12. **Directory submissions — Day 29.** Brand #2, zero listicle/directory presence; highest-leverage 30 min unchanged.
13. **Watch list:** **LawnBook (#1)** · GorillaDesk $49 Basic · LawnPro · **Servinix beta Aug 17 (7 days) / launch Sept 14** · Jobber Now Sept 25 · QuoteIQ churn window · astroturf.
14. **Watch delta-backup cron `cf89544f9829`** — monitor tonight's run.

### 🟢 Low

15. **Clean up outreach-channel references** (vault index, daily_scan lists) — 4× confirmed deletion.
16. **Open decisions:** free-tier gap 5 vs 15 (LawnBook) vs 25 (LawnPro) · trial 7 vs 14 days · mowflow CF project deletion confirm.
17. **Concierge e2e:** smoke 5/5 green; real request still needs Aaron's logged-in session.

---

## 🔬 Research Findings

### ⭐ Intel Engine — Feature Ideas (W33, Lane 3/4, 01:42Z)
- **State v48, seen 1347→1587+.** Reddit 8 candidates scanned, standard Monday quiet window.
- **`1vj2pj6`** r/sweatystartup — "Second biz" considering lawncare. Reply candidate (founder-mode advice).
- **`1vj2it9`** r/smallbusiness — thread about scheduling pain.
- **Jobber's 4-tier wall** ($24 anchor → $320+ actual) is the widest pricing gap in years. Every Connect user paying $80-139 + $29/user pays more than MowGo Crew at $79 flat.
- **QuoteIQ's hidden 1%** on top of Stripe (~3.9% total) = compare-page bullet. We charge 0%.
- **LawnBook** ($0-29.99, free=15 clients vs our 5) = pricing floor threat. Counters: web app, native apps, crew dashboard, booking link, no-card trial.
- **Solo operator consensus**: 5 things needed — client list, schedule from truck, on-site invoicing, auto-recurring billing, auto-reminders. MowGo Solo at $39 covers all 5.

### ⭐ Industry Trends (10:00Z Sunday Deep-Dive)
- **Robotic mower labor dynamics.** UF/IFAS study shows robots improve lawn health while reducing labor. ANTBOT debuts smart series (CES 2026). Carbon Robotics $1M/unit, Blue River exit $305M. Implication: robots eat entry-level mowing but create demand for higher-value packages — exactly Premium seasonal-pack opportunity.
- **PE consolidation record pace** (TruArc/Schill, Visterra, HighGrove, DJ's, Osprey) — all commercial/mid-market; 1-3 person residential long tail untouched.
- **Electric transition regulatory now:** CA bans new gas-equipment sales, SF bans city-contractor gas equipment (Jan 1 2026), PA municipal ordinances advancing.
- **GorillaDesk is direct competitor at crew tier:** $49 Basic punches above Jobber Core (unlimited users, 25-stop routing, automations).

### ⭐ Pricing Intelligence (21:38Z)
- **Jobber ladder re-verified:** Core $29-49 · Connect ~$49-80 · Grow $99-139+ · Plus $149-699; +$29/user.
- **QuoteIQ ladder:** Essentials $29.99 → Beginner $74.99 → Pro $149.99 → Elite $299 → Max $699 (Max +75% YTD). 1% processing fee on top of Stripe.
- **Housecall Pro:** Basic $59-79 / Essentials $149-189 / MAX $299-329; +$35/user.
- **TurfHop:** $39-49 flat + tx% — pricing page still up this check.

### ⭐ Stripe Health Check (09:08Z)
- **Both domains OK** — mowgo.pages.dev and mowgoapp.com deployed, auth-gated as designed.
- mowgo.pages.dev: `index-Bt9HBI5a.js` (bundle hash unchanged from last check).
- mowgoapp.com: `index-DC5ARPj0.js` (mowgoapp.com bundle).
- iOS `pk_live_` format-valid, `PaymentSheet` configured with topmost-VC fallback.
- **verify-session bug (Aug 2) remains fixed.**
- CF API tokens still dead (separate finding).

### ⭐ Invoice Reminders (12:30Z)
- 0 unpaid invoices older than 7d — clean sweep.

---

## 📡 Channel Status

| Channel | Status | Messages Synced |
|---------|--------|-----------------|
| #🌱mowgo (1529248227394850916) | ✅ Active — 14 new (all bot/Intel) | 14 |
| #🌱mowgo-outreach (~~1529711006023024680~~) | 🗑️ **GONE — 404 × 4 consecutive syncs** | 0 |
| #🤝mowgo-cowork (1529736297847980153) | 🟢 Empty — Day 10 watchdog clean | 0 |

*All messages from HeremesV2 (bot). Blasian/Aaron silent another day.*

---

## 📋 Quick Stats

- **Sync date:** 2026-08-10
- **Intel Engine state:** v48 (next lane: competitor_monitoring)
- **Leads:** 20 total · 5 contacted · 0 replies (Day 14)
- **SMS queue:** 23 texts, 0 sent (cron paused Day 9)
- **Reddit kit:** LOCKED for Mon 22:23Z (cron `4c195234eaa9`)
- **OpenRouter:** 402 Insufficient Balance at 09:48Z (recovered)
- **CF API tokens:** Dead (Day 4)
- **Stripe:** All green
- **Invoice reminders:** Clean

---
*Generated by MowGo nightly vault sync — 2026-08-10 02:00 UTC*