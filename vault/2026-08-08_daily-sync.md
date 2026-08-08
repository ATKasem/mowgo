# MowGo Nightly Vault Sync — 2026-08-08

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach ⚠️, #🤝mowgo-cowork
> **Sync window:** Aug 7, 02:00 – Aug 8, 02:00 UTC
> **Total messages synced:** 13 (13 mowgo + 0 outreach + 0 cowork) · 200 fetched (100 / 404-channel-gone / 0) · +2 new cross-check from #🌱mowgo-leads (11 fetched)

---

## 📊 Decisions

- **✅ Reddit Fri 22:21Z slot FIRED AND LANDED.** The one-shot cron (`1fb9a6fd0113`) posted **#54 `1vi045u`** (r/landscaping, "Any pro's using LMN for their business") at **22:23Z via Composio as u/Blasianzsz — permalink `t1_p2aa3kn`, visibility VERIFIED** (author present in public comment listing — same standard as the #52 check; API success ≠ visible). Kit stopped at first visible comment per the 1-post/slot rule; #43/#50/#41 stay banked; kit header marked **CLOSED** in the tracker. Note: the kit was revised during the day from ①#43→②#50→③#41 (as of the Aug 7 02:00Z sync) to **①#54→②#43→③#50→④#41** (BI 13:31Z) — the revised kit is what executed. **Next legal slot ≥ Aug 11 22:23Z (96h gate); next-slot kit: #55 → #57 → #56.**
- **✅ SMS pipeline root cause FIXED at root (6 wrappers).** The 8am action (13:50Z) created the missing `/opt/data/scripts/send_sms.py` wrapper (runpy → `/opt/data/mowgo/scripts/send_sms.py`) and repaired 5 more path-broken scripts the same way (lead_alert_sms, lead_nurture, mowgo_activation_report, mowgo_churn_report, testimonial_approver) + re-pointed the reply-poller delivery off the deleted #outreach channel → #leads (verified 13:15Z OK). **Dry-run verified: `send_sms.py --dry-run` → "10 would send" (exit 0).** The cron `3f67268baeb6` **remains PAUSED since Aug 6 18:29Z — unpausing is now purely Aaron's decision** (23 texts queued, Day 6, 0 sent).
- **✅ Stripe stale-client finding RESOLVED same-day.** The 09:19Z health check flagged the live bundle (index-D_aBBC3d.js) as a divergent non-main build missing the verify-session flow (billing worked server-side via webhook; success-page verification dead). The 8am action committed `21cf0a0` + pushed → **CF Pages redeployed; bundle `index-DPMXODzY.js` verified LIVE** (stale bundle gone; /seo/compare/ serving new content). Remaining link: one real logged-in checkout by Aaron (Day 24).
- **🔴 CF API tokens DEAD (new blocker).** Both `CF_API_TOKEN` / `CLOUDFLARE_API_TOKEN` in `/opt/data/.env` return **10000 Authentication error** (rotated/expired). Blocks `cf_check.py` + any wrangler/CF Pages deploy. **Aaron must re-auth in the Cloudflare dashboard.** The redeploy above went through via git push (Pages auto-deploy) — but the next manual deploy will fail until tokens are refreshed.
- **🔴 Codex CLI quota-blocked until Aug 8 05:19Z** (usage limit). Code review for the redeploy was done manually this cycle (diffs small, build passed, migration state DB-verified). **Resume the codex review lane today after 05:19Z.**
- **🧭 Watch-don't-build re-confirmed for AI estimating (3rd signal).** DeepLawn (AI satellite measurement) is now integrated into Service Autopilot/Xplor AND sold as a LawnPro add-on; QuoteIQ ships an AI Estimator on every plan from $29.99/mo; TurfHop launched Orbit AI. Mid-tier is adopting AI measurement as table stakes. **If MowGo ever adds it: Solo-tier feature, not an upsell. Text-first stays.**
- **🧭 Feature lane (17:40Z run): 3 features banked as Medium** — level billing, schedule-change batch text, CSV import (Rain Delay v2 validated in the wild; the batch-text idea is the "one tap rebooks the week" SMS loop). Quote-approval, crew clock-in/out, min-job-price remain on the dartboard from the prior window. Jobber's own academy preaches "minimum stop rate" — **min-job-price is now double-confirmed by a competitor's content.**
- **🧭 Free-tier gap is now PUBLIC.** The compare page (deployed live) names the LawnPro Free tier = 25 customers vs MowGo Free = 5 clients, honestly. This makes the open **5-vs-25 free-tier decision** visible on a page prospects actually read — decide soon.
- **🧭 Jobber = the new-entrant default verb.** `1viadq6` (laid-off IT PM starting a lawn biz): *"I'd use tools like Jobber."* New-business outreach scripts should lead with **"start lean, stay lean"** (14-day no-card trial + Solo $39 flat vs their $139+ multi-user).
- **⚠️ #🌱mowgo-outreach GONE — 2nd consecutive nightly 404.** Two independent 404s across consecutive nights = treat the deletion as **effectively confirmed**. Clean up the remaining references (vault index, daily_scan lists, the mowgo-leads skill's asset-delivery curl example still names the old channel id).
- **🟢 Cowork channel stays empty & healthy** — cleanup held; watchdog 0 new failures (Day 7 since the Aug 4 13:50Z fix).

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **💬 Aaron — UNPAUSE the SMS Sender cron (highest-value decision).** `3f67268baeb6` (14:00Z weekdays): path fixed, wrapper dry-run verified (10 would send). **23 texts queued across waves — Day 6, 0 sent.** Unpause (auto-send 10/day) or go manual; Wave-1 Day-2 follow-ups become due the moment sends start. Also unpause Qualified-Lead SMS Alert `88f17cbe35b3` (wrapper ready) when convenient.
2. **🔑 Aaron — refresh BOTH CF API tokens** in the Cloudflare dashboard → update `/opt/data/.env`. Dead since before the 09:19Z check; blocks cf_check.py and any non-git-push deploy.
3. **📝 Blasian — one session clears two: #48 manual paste** (r/sweatystartup `1vgvrg5`, AutoMod-filtered t1_p24ihev — do NOT re-queue via API) **+ the Blasian leads reply** (Jul 28 "How would we get leads for MowGo" — ✅ reacted, never answered; Day 12; draft ready at `leads/blasian-reply-draft-2026-08-01.md`).
4. **🤖 Resume the Codex review lane after 05:19Z** (quota release) — this cycle's review was manual (build + DB-verified).
5. **💳 Stripe e2e — Day 24, only unproven link.** Redeploy DONE bot-side (verify-session flow live, bundle verified). One real logged-in checkout with Aaron's account + card closes the last gap.

### 🟡 Medium

6. **Lead follow-ups — Day 13, STILL 0 replies.** Emerge / Metro Green / Bigfoot / Simply (Jul 29) + Campbell & Sons (Jul 31). 2nd follow-up overdue (was due Fri). Highest-ROI 10 min, unchanged.
7. **Compare page next edit:** refresh Jobber cells (new ladder below) + add **LMN $297-697** row. (LawnPro + TurfHop-outage-line edits already shipped & verified live.)
8. **Jobber switcher window (~Aug 15)** — promo posts drafts A/B/D ready; compare-page promo-row edits queued.
9. **Directory submissions — Day 28.** Brand #2, zero listicle presence; highest-leverage 30 min unchanged.
10. **Watch list:** LawnPro (closest rival — full profile now in `intel/2026-08-07_0449.md`) · Servinix (beta **Aug 17** per action log) · QuoteIQ AI Estimator + 1% fee · DeepLawn AI integrations · GreenPal photo-proof · Jobber Now (Sept 25) · astroturf tracker: **signld.ai** (4th pattern), TradeKit, ContractorPlusDotApp · LawnBoss 305/mo (decline stalled).
11. **Watch delta-backup cron `cf89544f9829`** — exited -15 (killed) last run 03:39Z (likely resource contention, not path); monitor next run.
12. **Cowork channel: empty, healthy** — nothing to do.

### 🟢 Low

13. **Clean up outreach-channel references** (vault index, daily_scan channel lists, mowgo-leads skill curl example) — deletion now 2× confirmed.
14. **Open decisions:** free-tier gap (5 vs 25 clients — now public on compare page) · trial 7 vs 14 days · mowflow CF project deletion confirm.
15. **Concierge e2e:** smoke re-verified 5/5 this cycle; real request still needs Aaron's logged-in session (bot can't mint a user JWT).

---

## 🔬 Research Findings

### ⭐ LawnPro full profile (04:49Z) — now the closest price rival
- Ladder: **Free (25 customers) · $39 Startup (3 employee logins + deposits + tips) · $129 Grow · $249 Plus**. The **$39 tier is the uncomfortable one**: same price as MowGo Solo but with 3 logins, and the free tier is 5× more generous than MowGo Free's 5 clients.
- Where MowGo wins cleanly: **Crew $79 vs their $129** · Premium $199 vs $249 · flat pricing vs their add-on economy (routes, 2-way text, QBO sync all cost extra below Plus).
- Compare page updated + deployed with the full ladder and the free-tier gap named honestly.

### ⭐ Jobber rebuilt its price ladder (13:28Z, re-verified 21:53Z)
- **Core $29-49 → NEW Connect ~$49-80 → Grow $99-139+ (15u $139-399) → Plus $149-699; +$29/user everywhere**; pricing page now routes buyers through a team-size wizard; promo pricing site-wide. **AI Receptionist only appears at $199+.**
- Cheapest 2-person setup = Grow $139+ → **Crew $79 still ~2× cheaper**. Their promo math anchors "Starting at $24/mo" — demand softening at the low end.
- **Jobber Now conference Sept 25 ($699)** = roadmap-theater phase; expect a late-Sept feature wave that resets tier messaging.

### ⭐ The sub-$100 crew-tool gap widened
- **LMN pinned at $297-697/mo** (Granum Professional $648) — design-build estimating commands 4-8× Crew pricing; that's the band tonight's fresh prospect shops in.
- **ServiceTitan $250-500/tech + $5-50k implementation** — the pricing thread's own commenters call Jobber *"the cheap option below $1M revenue"*; **nobody names a sub-$100 crew tool. That's the gap.**
- Housecall Pro unchanged (Basic $59-79 / Essentials $149-189 / MAX $299-329 + $35/user) — second-user cliff still their soft spot.

### 🧭 Feature validation (from the wild)
- **GreenPal pays out only after timestamped photo confirmation** — photo-proof is becoming a homeowner *expectation* (backs quote-approval + before/after photo roadmap).
- **Jobber's academy preaches "minimum stop rate"** — min-job-price idea double-confirmed; also banked their price charts ($50-250/mow, per-acre table) and "65% of owners raised prices" for what-to-charge posts.
- **Jobber Grants $250k/9** + **SMS gating at $349-599/mo** (their broadcast gap = MowGo's wedge) · **SA V3 weather-aware skip + paid migration** (moat) · level billing / schedule-change batch text / CSV import banked (M).

### 🧭 Structural 2026 market signals
- **Drought = structural sales event:** Denver metro mandatory Stage 1 (water 2 days/week, nothing 10am-6pm, $1.10/1000gal surcharge, fines to $36k, locked through Oct 31). Fewer routine mows, more renovation/xeriscape/irrigation one-offs with bigger invoices = MowGo's loop; Rain Delay fits watering-window chaos.
- **Labor costs +20% by end of 2029** (NALP/ITR); 28% of maintenance crews earn $21-25/hr. Every admin hour is field labor lost — keep that line in outreach.
- **Jobber = new-entrant default verb** (`1viadq6` IT PM: "I'd use tools like Jobber") — lead with "start lean, stay lean" in new-business scripts.

### 🐦 Reddit — 11th r/LawnCarePros window broke with a hit
- **Draft #57 — `1vi8tr3` "Starting up, Central TX" (18:34Z):** brand-new biz (LLC, insurance, door hangers, electric equipment, no truck yet), $80/month weekly mows on 60 new-build 1/8-acre lots. **Exact MowGo ICP doing pricing math by hand** — banks "sell the month, not the mow" + add-on-price-list. Slotted kit #2 for next slot, ahead of #56.
- **Draft #55 — `1vi1hcj`** (TX drought pro, 40 comments, hot): text-vs-schedule in slow season → kit #1 for next slot. **Draft #56 — `1vi4yd1`** ("software you pay for but dislike"): switching-cost lock-in verbatim copy fuel.
- **`1vhv10k` r/smallbusiness reply ALREADY LIVE** (13:18Z, `t1_p29ceub`, visibility verified): uncle pays **$379/mo** for website + booking widget and was quoted **$2,400 for a dropdown** — *"nobody names the middle. That middle is MowGo."*
- **4th astroturf pattern — signld.ai:** `IncreaseNegative4614` copy-pastes identical "We use signld.ai internally to connect estimates, schedules, labor…" into `1vi045u` (tonight's kit #1!), `1vh7t47`, and r/cleaningbusiness. signld.ai = **Inzata Analytics' enterprise BI** (CFO/COO buyer, Salesforce/HubSpot/NetSuite connectors) — zero lawn relevance. The shill economy went generic. **Never engage; friend-mode contrast is the win.**

### 🔧 Infra — this window
| Component | Finding | Status |
|---|---|---|
| Intel Engine | 5 runs (04:49 / 09:12 / 13:31 / 17:40 / 21:53Z), state v35→v39, seen 1230→1280; LawnPro profile done; next: industry_trends | ✅ cadence healthy |
| Stripe health check | 09:19Z: 4/4 functions green both domains, iOS pk_live_ valid, no key leak; **stale live bundle flagged** → redeployed 13:50Z (`index-DPMXODzY.js` verified live) | ✅ resolved same-day |
| CF API tokens | **both dead (10000 Authentication error)** — blocks cf_check + wrangler | 🔴 Aaron re-auth |
| Invoice reminders | 12:30Z: OK — 0 unpaid >7d | ✅ |
| Reddit slot | **FIRED 22:23Z — #54 `1vi045u` posted + visibility verified** (t1_p2aa3kn); kit closed; next ≥ Aug 11 | ✅ |
| SMS Sender cron | **Path FIXED at root (6 wrappers, dry-run verified 10 would send); cron still PAUSED** | 🔴 Aaron decision |
| Rule of 100 | Wave-4 15:11Z → #leads: **6 SMS drafts** (Campbell & Sons, Nutri-Green, Hicks, Eberly's, LBR, Aguilar Brothers) + **3 FB/IG posts**; dedup gate passed (10 prior leads excluded) | ✅ drafted — 0 sent (cron paused) |
| Reply poller | delivery re-pointed off deleted #outreach → #leads; 13:15Z run OK | ✅ |
| Provider watchdog | 0 new failures; cowork channel empty (cleanup held) | 🟢 |
| Codex CLI | quota-blocked until **Aug 8 05:19Z** — review manual this cycle | 🟡 resume today |
| delta-backup cron | `cf89544f9829` exited -15 (killed) 03:39Z — likely resource contention | 🟡 monitor |
| BI engine verifier | `/tmp/bi/fetch.sh` write denied (outside HERMES_WRITE_SAFE_ROOT=/opt/data) — recurring | 🟡 note |

---

## 📝 Notes / Context

### Channel Activity (since Aug 7 02:00Z)
- **#🌱mowgo** — **13 new, ALL bot cron reports:** Intel Engine ×5 runs (04:49Z competitor/LawnPro, 09:12Z trends, 13:31Z pricing, 17:40Z feature ideas, 21:53Z competitor — 2 msgs each except 13:31Z whose 2nd msg is footer-only) + Stripe health check 09:19Z (3 msgs) + invoice reminders 12:30Z (1 msg). **No human messages — Blasian silent since Jul 29 15:39Z (Day 11).**
- **#🌱mowgo-outreach** — **⚠️ 404 Unknown Channel again (2nd consecutive sync).** Deletion now effectively confirmed; 0 messages synced. No active cron targets it (Rule of 100 → #leads; reply poller re-pointed Aug 7).
- **#🤝mowgo-cowork** — **0 messages** (empty since Aug 6 13:30Z cleanup; watchdog holding).
- *(Cross-check)* **#🌱mowgo-leads** (11 fetched, 2 new) — **Rule of 100 wave-4 posted 15:11Z:** 6 SMS drafts (Campbell & Sons OKC, Nutri-Green Tulsa, Hicks Stillwater, Eberly's Midwest City, LBR Tulsa/Owasso/BA, Aguilar Brothers Claremore — all rate-report hooks, fresh touches, opener rotation, dedup gate passed) + 3 FB/IG posts (rain-day rebook, "$67 a cut in Broken Arrow" money post, per-seat pricing positioning). **Blasian's leads question (Jul 28) still unanswered — Day 12.**

### Escalation Timeline (execution gap)
| Blocker | Flagged | Now | Status |
|---|---|---|---|
| **SMS pipeline (23 queued, 0 sent)** | Aug 5 | Day 6 🔴 | **Path FIXED at root (6 wrappers, dry-run verified); cron PAUSED — unpause is Aaron's call** |
| **CF API tokens dead** | Aug 7 | NEW 🔴 | Both 10000-auth-error; blocks cf_check/wrangler — dashboard re-auth |
| Codex CLI quota | Aug 7 | until 05:19Z Aug 8 | 🟡 resume review lane today |
| Lead follow-ups (5 emails, 0 replies) | Jul 29 | Day 13 ❌ | 2nd follow-up overdue (was due Fri) |
| Blasian human loop | Jul 29 | Day 12 ❌ | Silent 11 days; #48 still needs manual paste |
| Stripe logged-in e2e checkout | Day 1 | Day 24 | ✅ redeploy done (bundle live); one real checkout left |
| Reddit replies | Week 1 | ✅ **SLOT LANDED** | #54 `1vi045u` posted 22:23Z + visible; next ≥ Aug 11 (kit #55→#57→#56) |
| Comparison-site absence | Day 1 | Day 28 ❌ | Brand #2, zero listicle; directory submissions still highest-leverage 30 min |
| TurfHop outage | Aug 1 | — | ✅ CLOSED Aug 6 (~114h; compare line retired, page updated live) |
| Rule of 100 duplicate-post bug | Aug 5 | — | ✅ RESOLVED (dedup gate + #leads delivery); wave-4 clean |
| Cowork spam (128 msgs) | Aug 4 | — | ✅ Cleaned Aug 6 13:30Z; channel empty |
| **Outreach channel** | — | Aug 8 | ⚠️ **GONE — 404 ×2 consecutive nights; deletion effectively confirmed** |
| Online booking link | Jul 23 | Day 19 | P0 named; self-quote page = booking-loop v2 candidate |
| Solo pricing debate | Jul 30 | Day 14 | Intel: HOLD $39/$79 flat — band is now a promo/lock-in contest (Jobber 3-mo promos, QuoteIQ Price-Lock + 1% fee) |

### Key Takeaway
Third fully machine-driven day in a row — **13 bot messages, 0 human (Blasian silent Day 11)**. The big machine-side wins: the **Fri Reddit slot fired and LANDED** (#54 on `1vi045u`, visibility-verified — a clean automated slot execution for the first time), the **SMS pipeline was fixed at root** (6 wrappers, dry-run verified — now purely an Aaron decision with 23 texts waiting, Day 6), and the **stale-client redeploy shipped same-day** (verify-session restored, new bundle verified live). Intel's best ammo: **LawnPro's full profile** (closest price rival — compare page updated + deployed live), **Jobber's rebuilt ladder + Sept 25 conference**, **LMN $297-697**, the **signld.ai 4th shill pattern**, and two fresh drafts (**#55/#57**) ready for the next kit. New blockers to note: **CF API tokens dead** (blocks deploys until dashboard re-auth) and **Codex quota until 05:19Z** (resume the review lane today). Aaron's plate: unpause SMS (highest value, 23 texts), CF token re-auth, real Stripe checkout (Day 24), Blasian session (#48 paste + leads reply — Day 12), 5 lead follow-ups (Day 13), directory submissions (Day 28).

---
*Generated by MowGo nightly vault sync — 2026-08-08 02:00 UTC*
