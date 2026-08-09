# MowGo Nightly Vault Sync — 2026-08-09

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach ⚠️, #🤝mowgo-cowork
> **Sync window:** Aug 8, 02:00 – Aug 9, 02:00 UTC
> **Total messages synced:** 17 (17 mowgo + 0 outreach + 0 cowork) · 100 fetched (100 / 404-channel-gone / 0) · +0 new cross-check from #🌱mowgo-leads (11 fetched, newest Aug 7 15:11Z)

---

## 📊 Decisions

- **✅ Mon Aug 11 22:23Z Reddit slot LOCKED (96h gate).** First legal slot since #54 fired Fri 22:23Z. One-shot cron `4c195234eaa9` confirmed ENABLED (next Aug 11 22:23Z). **Kit: ① #55 `1vi1hcj` (53 comments, TX drought/level-billing; OP's "do you recommend an SMS reminder platform?" question STILL unanswered — that's the reply opening) → ② #57 `1vi8tr3` (new Central TX biz, $80/mo weekly) → ③ #43 `1vfyg2j`** (first-5-customers, OP active; #56 `1vi4yd1` declared DEAD — OP body [removed], Rule-5 flag — swapped out). Fallback: `1vh7t47`. **⚠️ Sat 22:21Z kit correctly CANCELED** — the 02:38Z run's "tonight" kit conflicted with the account-safety gate; verified no one-shot cron existed for Sat, `post_kit_sat0822.py` never fired. Re-verify liveness before Mon's slot.
- **🆕 LawnBook (lawnbook.app) = new #1 watch.** First tool to undercut MowGo on price *and* free tier: **Free = 15 clients (we give 5), Pro $9.99/mo, Premium $14.99, Crew $29.99**, AI Receptionist add-on $19.99–74.99 (Jobber charges $29). Mobile-only, offline-first, on-device AI, iCloud crews, "1,000+ businesses" (unverified). Not a panic — no web dashboard, crew = Owner/Worker, young app — but counters are now named: web hub + native iOS/Android parity, Crew $79 real team roles, booking link, webhooks, no-card trial.
- **✅ $49 is the new generalist entry floor — Solo $39 undercuts it.** Jobber Core $39→$49 (Connect $129–139, Grow $249), Housecall Pro Basic $59/yr ($79 monthly) after two raises, GorillaDesk + Service Autopilot both $49. Only $29.99 entry left = QuoteIQ Essentials (1 user, no lawn features). Per-user tax = the industry's pricing engine (Jobber +$29/user, HCP +$35 with a $90/mo jump at user #2) → **Crew $79 = cheapest multi-user entry in the market** (vs HCP $149, Jobber $129+, QuoteIQ $74.99–149.99). Compare-page line ready: *"The floor moved up to $49. Solo is $39, flat, unlimited clients."*
- **🌊 Drought = THE 2026 product story (now national).** CO Stage 1 mandatory (Oct 31, fines to $36k), TX confirmed, NC/Raleigh water stages, "landscapers across the East" (WITN). **Level billing upgraded to #1 drought-season feature** (4 operators billing flat-monthly/season-averaged + a homeowner who drops companies that charge for skipped drought mows). Schedule-change broadcast + skip-by-reply ("reply SKIP to skip this week") added to the spec; Rain Delay v2 already ships the reschedule half. Fall upsell dollars banked: aeration $75–225, seeding $680–1,815, leaf removal $155–460.
- **🤖 AI receptionist = 2026 arms race — text-back is the wedge.** Jobber ships AI Receptionist **$29/mo add-on** (free only on Plus $399+); QuoteIQ bundles Virtual Call Team at Pro $149.99; standalone Rosie $49 / Smith.ai $97.50+ / Goodcall $59–199 / PATLive $205 / AnswerForce $349. MowGo read (re-confirmed): **missed-call text-back (Effort S, Twilio)** — missed call → instant text with booking link; feeds the already-shipped public booking page; **beats every competitor price at $0 incremental** (`1viv2m0` intel: OpenPhone ≈ $15/user/mo → a 2-person crew pays $30/mo just for phone). Full AI voice = watch, don't build.
- **✅ Stripe health check all green — bundles CONVERGED.** Both domains serve the identical bundle `index-iH6OkeXp.js` (dual-hash divergence resolved); no `pk_` in bundle (correct by design — checkout 100% server-side), zero `sk_` leaks; checkout endpoints auth-gated on both hosts (403 pages.dev / 401 mowgoapp.com — expected origin/JWT ordering); iOS `pk_live_` format-valid. **Only unproven link unchanged: one real logged-in checkout (Aaron, Day 25).** CF API tokens still dead (see tasks) — but git-push deploys work (`58395b7` docs-only pushed, CF auto-deploy fine).
- **💸 "Quick favors" = the industry's August profit leak — and it's our pitch.** Turf Magazine (Jul 27): the #1 August profit killer is out-of-scope "quick favors" that never reach an invoice — thousands lost per season; same-day r/smallbusiness thread (`1vj3h1k`) has owners arguing exactly this. Copy line banked: *"The 'quick favor' that never gets billed costs you thousands by August."* Goes into outreach + Compare page.
- **📊 NALP stat block captured** — 67% of contractors already use invoicing software yet **42% still list cash flow as a top goal**; switching reasons: automate workflows 58%, efficiency 51%, feature gaps 44%. *"Invoicing tools alone aren't fixing cash flow — the schedule→auto-invoice→pay-link loop is."*
- **🧭 Roadmap reality check:** GorillaDesk Basic $49 **already ships broadcast SMS + triggered automations**, and LawnPro ships **level billing on its FREE tier** (2-way text gated at Plus $249). Both banked ideas are now catch-up — level billing still wins on demand, but **sell it on simplicity + reconciliation, not novelty.**
- **🧭 QuoteIQ churn window + pricing drift:** new **Beginner $74.99 tier** (ladder now Essentials $29.99 → Beginner → Pro $149.99 → Elite $299 → Max $699 — Max +75% YTD); **1% processing fee on top of Stripe (~3.9% total)**; bug-wave reviews + 2-month-cancellation complaints = churn window. Their listicles quote **stale May-2026 Jobber prices** ($39/$119/$199 vs our verified $49/$129–139/$249) — **never cite their tables.**
- **⚠️ #🌱mowgo-outreach GONE — 3rd consecutive nightly 404 (deletion CONFIRMED).** Index already records it CLOSED; remaining cleanup tracked (outreach_ref_cleanup). Do NOT re-add to scan lists.
- **🟢 Cowork channel stays empty & healthy** — cleanup held; watchdog 0 new failures (Day 9 since the Aug 4 13:50Z fix).

---

## 🎯 Action Items / Tasks

### 🔴 Critical

1. **📣 Mon Aug 11 22:23Z — FIRE the Reddit slot.** Cron `4c195234eaa9` armed. Kit ① #55 → ② #57 → ③ #43 (fallback `1vh7t47`); stop at first visible post; verify visibility after (API success ≠ visible); 1-post/slot rule. **Re-verify liveness Aug 11 before slot.**
2. **💬 Aaron — UNPAUSE the SMS Sender cron (highest-value decision, Day 7).** `3f67268baeb6` still DISABLED (verified this run); wrapper dry-run verified (10 would send); **23 texts queued, 0 sent.** Unpause (auto-send 10/day) or go manual; Wave-1 Day-2 follow-ups become due the moment sends start. Also unpause Qualified-Lead SMS Alert `88f17cbe35b3` when convenient.
3. **🔑 Aaron — refresh BOTH CF API tokens** (Cloudflare dashboard → `/opt/data/.env`). Still dead (10000 auth error) since Aug 7; blocks cf_check.py + any non-git-push deploy. Redeploys currently ride on git-push auto-deploy only.
4. **📝 Blasian — #48 manual paste** (r/sweatystartup `1vgvrg5`, AutoMod-filtered — do NOT re-queue via API) **+ Blasian leads reply** (Jul 28 "How would we get leads for MowGo" — ✅ reacted, never answered; Day 13; draft ready at `leads/blasian-reply-draft-2026-08-01.md`).
5. **📧 Lead follow-ups — Day 14, STILL 0 replies.** Emerge / Metro Green / Bigfoot / Simply (Jul 29) + Campbell & Sons (Jul 31). 2nd-follow-up script drafted but **still unsent** (was due Fri Aug 7). Highest-ROI 10 min, unchanged. W32 digest flags "Day 11+ overdue."
6. **💳 Stripe e2e — Day 25, only unproven link.** One real logged-in checkout with Aaron's account + card closes the last gap. (Stripe side fully green this window — bundles converged.)
7. **🤝 Mon/Tue friend-mode replies:** `1vj9nay` (brand-new business hand-building a quote form that feeds Jobber — *"the last thing I need before starting"* — our exact loop; warm new-business lead) + `1vj4wob` (new lawn company asking move-out pricing, OP engaged; no pitch). Draft both this weekend.

### 🟡 Medium

8. **Compare page next edit:** add **LawnBook row** (Free 15 / Pro $9.99 / AI receptionist $19.99+), **QuoteIQ Beginner $74.99** + 1% fee, and the **"quick favors" copy line**; verify Jobber/LMN cells from the Aug 8 7am edit are live. Line to lead with: *"Everyone else's real price is hidden behind a wizard; ours is $39/$79 flat."*
9. **📱 Missed-call text-back — PRIORITY UP (Effort S).** THE wedge vs the AI-receptionist arms race; Twilio number already being onboarded for rain-delay SMS; ship under Autopilot branding (still no public face).
10. **🌊 Level billing (M) + schedule-change broadcast (M)** — drought-season #1 feature + its sibling; skip-by-reply folded into broadcast spec.
11. **Directory submissions — Day 29.** Brand #2, zero listicle/directory presence; highest-leverage 30 min unchanged.
12. **Watch list:** **LawnBook (#1 watch — first to undercut free tier + price)** · GorillaDesk $49 Basic (crew-tier direct) · LawnPro (level billing free) · **Servinix beta Aug 17 (9 days) / launch Sept 14** ("60% off your invoice" switcher bait) · Jobber Now Sept 25 (expect tier-messaging reset) · QuoteIQ churn window + 4th self-ranking listicle · welovejoe.com (EU AI receptionist) · astroturf: signld.ai, Auxera, monityAI, AGN IT Services, ustaxx_app, SCS-AI, ContractorPlusDotApp.
13. **Watch delta-backup cron `cf89544f9829`** — next run Aug 9 03:15Z; Aug 8 03:36Z run failed on git push (root-caused to 1.1GB tar > GitHub 100MB limit from .gradle/.npm; fixed via excludes + caps per the 8am action). Monitor tonight's run.
14. **🐛 parse_sweep.py dedupe bug → Codex lane** — RSS hrefs with trailing slash re-flag known threads as NEW every run (slash-vs-no-slash vs seen list). Normalize before seen-check.
15. **📋 Intel Engine cadence healthy:** 5 runs (02:38 / 06:39 / 11:36 / 16:18 / 20:35Z) + Sunday deep-dive (01:19Z) → **state v44, seen 1587**; W32 digest delivered (`weekly_digest_2026-08-09.md`); next lane competitor_monitoring (05:19Z).

### 🟢 Low

16. **Clean up outreach-channel references** (vault index, daily_scan lists, mowgo-leads skill curl example) — deletion now 3× confirmed.
17. **Open decisions:** free-tier gap now **5 (MowGo) vs 15 (LawnBook) vs 25 (LawnPro)** — decision visible on a page prospects read · trial 7 vs 14 days · mowflow CF project deletion confirm (domain verified redirecting — one-click).
18. **Concierge e2e:** smoke 5/5 green; real request still needs Aaron's logged-in session (bot can't mint a user JWT).

---

## 🔬 Research Findings

### ⭐ LawnBook (lawnbook.app) — NEW #1 WATCH (16:18Z profile)
- **Free = 15 clients / Pro $9.99 / Premium $14.99 / Crew $29.99; AI Receptionist $19.99–74.99.** First tool to undercut MowGo on free tier AND price (LawnPro undercut free tier only; Jobber undercut neither). Mobile-only, 100% offline, on-device AI, Product Hunt featured, "1,000+ businesses" (unverified).
- Weaknesses: **no web dashboard**, crew = Owner/Worker on iCloud sync, young app, no booking link/webhooks/roles. Not a panic — but the counter-message is now concrete: *web hub + native iOS/Android + Crew $79 real team roles + booking link + no-card trial.*

### ⭐ The pricing battlefield (06:39Z / 16:18Z / 20:35Z / digest)
- **Entry tiers collapsed into teasers:** Jobber anchors "Starting at **$24/mo**" (12-mo lock + promos everywhere, +$29/user); QuoteIQ added Beginner **$74.99**; **LawnBook entered at FREE/9.99**. Meanwhile the actual money loop (auto-invoice, reminders, pay links, booking) is gated at **$99–699 everywhere** — Jobber Connect $129–139, QuoteIQ Pro $149.99+, HCP Essentials $149. **MowGo $39/$79 flat, whole loop included = the compare-page, outreach, and landing-page line.** Verified live across 9 competitors this week.
- **Per-user tax quantified:** Jobber +$29/user, HCP +$35/user ($90/mo jump at user #2), QuoteIQ 2nd user = $74.99 tier, Service Autopilot $49 + setup = ONE mobile license (2-person = Pro $199+). GorillaDesk the exception (unlimited users on Basic $49 — but booking gated at Pro $99). Content idea banked: *"What a 2-crew lawn business actually pays"* (Jobber ~$158–197, HCP $149, QuoteIQ $74.99–149.99 vs **Crew $79**).
- **QuoteIQ:** Elite $299 / Max $699 confirmed (+$49/+$299 since Jul 31; Max +75% YTD), "Price-Lock Guarantee" after the hike, **1% processing fee on top of Stripe (~3.9% total)**, InstaQuote/self-booking STILL Elite-gated, anti-Jobber video campaign ("Pricing IS A TRAP"), 4th self-ranking listicle + YouTube Shorts review-farming.

### ⭐ Drought economics (02:38Z / 11:36Z / digest)
- National story (CO Stage 1 through Oct 31; TX; NC/East). Fewer routine mows, more premium one-offs → **level billing + Rain Delay + schedule broadcast = the drought toolkit**. Fall dollars: aeration $75–225, seeding $680–1,815, leaf removal $155–460; aeration+overseeding from one customer can rival that customer's whole-year revenue (Holganix).
- Subscription contracts = 66% of market revenue (Mordor; US $62.91B → $79.68B by 2031) → level billing aligns with how the market already pays. Robotics going commercial (STIGA APX Pro, Honda ProZision) erodes per-visit pricing → level billing gets *more* defensible.
- 692,777 US landscaping businesses (+4.8% vs 2024); on-demand visits = fastest-growing segment (10.22% CAGR) → booking-link tailwind.

### ⭐ The stat block MowGo was missing (02:38Z NALP)
- **67% use invoicing software, yet 42% still list improving cash flow as a top goal** ("struggling to be paid in a timely manner"). Switching drivers: automate workflows 58%, operational efficiency 51%, feature gaps 44%. The whole pitch in three numbers — save for Compare page + sales collateral.
- Labor: 70% plan 2026 wage raises (44% by 4%+); 28% of maintenance crews earn $21–25/hr (Aspire, 3rd independent source for admin-hours-are-lost-field-labor). Electric transition now regulatory (CA sales ban, SF city-contractor ban Jan 1 2026, PA ordinances) — electric-first crews = new-entrant ICP.

### 🐦 Reddit — Saturday quiet window + live Monday kit
- **0 new bankable drafts Sat** (daytime = homeowner/DIY window) but **kit is the strongest yet:** #55 `1vi1hcj` at **53 comments** (was 26 — thread blowing up; OP's SMS-platform question unanswered = most on-topic opening), #57 `1vi8tr3` (OP replied 4×), #43 `1vfyg2j` (OP engaged). **#56 `1vi4yd1` DEAD** (OP body [removed]) — swapped out.
- **`1vj9nay` (r/smallbusiness, ~11h old)** — new business hand-building a quote form that feeds Jobber: *"the last thing I need before starting."* That's the MowGo loop, unbuilt. Friend-mode reply Mon/Tue = warm lead.
- **`1viz0nv`** — owner on Jobber/HCP/ServiceTitan: "built-in reporting is the weak spot… we just export to Google Sheets." Live reporting-pain proof → copy flag.
- **`1vj3h1k`** — owners arguing over unbilled "quick favors" (pairs with Turf Magazine's #1 profit killer).
- **Astroturf +6** (Auxera, monityAI, AGN IT Services, ustaxx_app, SCS-AI — plus signld.ai an *enterprise BI tool* shilling our exact threads, and QuoteIQ video-testimonial via low-history account `1vj609p`). **Never engage; friend-mode contrast is the win.**

### 🧭 Lead discovery (Sunday deep-dive, +3 → 20 tracked)
- **Ponca City/Pawhuska one-stop op** (lawn + tree + pressure washing, 405-747-7869, FB group) — new north-central OK geography, not in the 100-lead pool.
- **Jameson Solutions** (Yukon, OK) — Angi 5.0, active July 2026 review = pays for leads, growth-minded. **Green's Mowing Service** (OKC) — Angi 5.0, thin footprint, verify.
- Queue evaluation: `1vitibw` (stump pricing → content fuel), `1vhxb8k` (skip — curbing newbie), TX new-build segment = warm via #57 OP (engagement-first). Pipeline: **20 tracked · 5 contacted · 0 replies · 0 conversions.**
- Outreach-strategy note (log-only thread `1vikxdv`): cold SMS carries TCPA/A2P 10DLC risk + poor response — **don't route MowGo cold outreach through SMS blasts; text nurture only with consent** (pairs with the paused SMS cron).

### 🔧 Infra — this window
| Component | Finding | Status |
|---|---|---|
| Intel Engine | 5 runs (02:38 / 06:39 / 11:36 / 16:18 / 20:35Z) + Sunday deep-dive 01:19Z; state v40→v44 (seen 1280→1587); W32 digest delivered; commit `58395b7` pushed (docs-only) | ✅ cadence healthy |
| Stripe health check | 09:05Z: all green; **bundles CONVERGED** (`index-iH6OkeXp.js` both domains); no pk/sk in bundle; endpoints auth-gated 403/401; iOS key valid | ✅ |
| CF API tokens | **both still dead (10000 Authentication error)** — blocks cf_check/wrangler; git-push deploys unaffected | 🔴 Aaron re-auth |
| Invoice reminders | 12:30Z: OK — 0 unpaid >7d | ✅ |
| Reddit slot | **Sat 22:21Z correctly CANCELED** (96h gate); **Mon Aug 11 22:23Z cron `4c195234eaa9` ARMED** (kit #55→#57→#43) | ✅ next Mon |
| SMS Sender cron | `3f67268baeb6` still DISABLED — 23 texts queued, Day 7, 0 sent | 🔴 Aaron decision |
| Rule of 100 | Aug 8: no run (weekend schedule 15:00Z Mon–Fri) — next Mon Aug 10 15:00Z | ✅ |
| Reply poller / lead watch | delivery on #leads; poller next 02:15Z, lead watch 13:18Z | ✅ |
| Provider watchdog | 0 new failures; cowork channel empty (cleanup held) | 🟢 |
| delta-backup cron | Aug 8 03:36Z run failed on git push (1.1GB tar > 100MB GitHub limit) — **root-caused & fixed** (excludes + caps + auto-split); next run Aug 9 03:15Z | 🟡 monitor |
| BI verifier | `/tmp/bi/fetch.sh` write denied (outside HERMES_WRITE_SAFE_ROOT=/opt/data) — recurring | 🟡 note |

---

## 📝 Notes / Context

### Channel Activity (since Aug 8 02:00Z)
- **#🌱mowgo** — **17 new, ALL bot cron reports:** Intel Engine ×5 runs (02:38Z NALP/drought, 06:39Z pricing floor + SLOT FLAG, 11:36Z AI receptionist + kit swap, 16:18Z LawnBook profile, 20:35Z quick-favors) + Sunday Deep-Dive W32 01:19Z (3 msgs) + Stripe health check 09:05Z (2 msgs) + invoice reminders 12:30Z (1 msg). **No human messages — Blasian silent since Jul 29 15:39Z (Day 12).** 16 with content + 1 footer-only trailer.
- **#🌱mowgo-outreach** — **⚠️ 404 Unknown Channel again — 3rd consecutive nightly sync. Deletion CONFIRMED** (index already records CLOSED); 0 messages synced. No active cron targets it.
- **#🤝mowgo-cowork** — **0 messages** (empty since Aug 6 13:30Z cleanup; watchdog holding, Day 9).
- *(Cross-check)* **#🌱mowgo-leads** (11 fetched, **0 new**) — newest remains Rule of 100 wave-4 (Aug 7 15:11Z: 6 SMS drafts + 3 FB/IG posts). **Blasian's leads question (Jul 28) still unanswered — Day 13.** sms_queue.json still 23 entries, all status=new.

### Escalation Timeline (execution gap)
| Blocker | Flagged | Now | Status |
|---|---|---|---|
| **SMS pipeline (23 queued, 0 sent)** | Aug 5 | Day 7 🔴 | Path fixed (6 wrappers, dry-run verified); cron `3f67268baeb6` STILL DISABLED — unpause is Aaron's call |
| **CF API tokens dead** | Aug 7 | Day 3 🔴 | Both 10000-auth-error; blocks cf_check/wrangler — dashboard re-auth |
| Lead follow-ups (5 emails, 0 replies) | Jul 29 | Day 14 ❌ | 2nd follow-up script drafted, still unsent (was due Fri) |
| Blasian human loop | Jul 29 | Day 13 ❌ | Silent 12 days; #48 still needs manual paste; leads question Day 13 |
| Stripe logged-in e2e checkout | Day 1 | Day 25 | ✅ Stripe side green (bundles converged); one real checkout left |
| Reddit replies | Week 1 | ✅ **Mon slot ARMED** | #54 landed Fri; next ≥ Mon Aug 11 22:23Z (kit #55→#57→#43) |
| Comparison-site absence | Day 1 | Day 29 ❌ | Brand #2, zero listicle; directory submissions still highest-leverage 30 min |
| **LawnBook threat** | Aug 8 | NEW 🆕 | #1 watch — first to undercut free tier AND price; counters named |
| TurfHop outage | Aug 1 | — | ✅ CLOSED Aug 6 (~114h; now historical footnote) |
| Rule of 100 duplicate-post bug | Aug 5 | — | ✅ RESOLVED (dedup gate + #leads delivery) |
| Cowork spam (128 msgs) | Aug 4 | — | ✅ Cleaned Aug 6 13:30Z; channel empty Day 9 |
| **Outreach channel** | — | Aug 9 | ⚠️ **GONE — 404 ×3 consecutive nightly syncs; deletion CONFIRMED** |
| Online booking link | Jul 23 | Day 20 | P0 named; self-quote page = booking-loop v2 candidate |
| Solo pricing debate | Jul 30 | Day 15 | Intel: HOLD $39/$79 flat — floor moved UP to $49; band is a promo/lock-in contest |

### Key Takeaway
Fourth fully machine-driven day in a row — **17 bot messages, 0 human (Blasian silent Day 12)**. The weekend was all prep: the **Sat slot was correctly NOT fired** (96h gate respected — account-safety win), the **Mon Aug 11 kit is locked and armed** (#55 at 53 comments with an unanswered SMS-platform question as the opening), the **W32 digest landed** with the strongest pricing story of the campaign (*"Everyone else's real price is hidden behind a wizard; ours is $39/$79 flat"* — the floor moved UP to $49 while QuoteIQ/Jobber/LawnBook fight over teasers), and **LawnBook emerged as the new #1 watch** (first to undercut free tier AND price — counters named, no panic). Drought went national → **level billing is now the #1 drought-season feature** and **missed-call text-back is the wedge** vs the AI-receptionist arms race. Infra: Stripe converged + green, Intel cadence healthy (state v44), delta-backup root-caused & fixed. Aaron's plate is unchanged in shape: **unpause SMS (Day 7, 23 texts), CF token re-auth, real Stripe checkout (Day 25), Blasian session (#48 + leads reply — Day 13), 5 lead follow-ups (Day 14), directory submissions (Day 29)** — plus fire the Mon 22:23Z slot.

---
*Generated by MowGo nightly vault sync — 2026-08-09 02:00 UTC*
