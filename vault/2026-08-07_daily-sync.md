# MowGo Nightly Vault Sync — 2026-08-07

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach ⚠️, #🤝mowgo-cowork
> **Sync window:** Aug 6, 02:00 – Aug 7, 02:00 UTC
> **Total messages synced:** 13 (13 mowgo + 0 outreach + 0 cowork) · 200 fetched (100 / 404-channel-gone / 0) · +9 cross-check from #🌱mowgo-leads

---

## 📊 Decisions

- **✅ TurfHop outage FULLY CLOSED.** `/pricing` recovered ~11:00Z Aug 6 after **~114h down** (Aug 1 17:00Z → Aug 6 ~11:00Z — longest in tracker history, verified 2×), pricing unchanged (Truck $49 / Office $79 / HQ $129). `/features` also back by the 19:37Z check. No relaunch discount. **Retire the "TurfHop down" compare-page line** (keep as time-stamped aside only: "pricing page down Aug 1–6").
- **🎯 Reddit Fri kit re-sequenced (twice during the window) — FINAL: ① #43 `1vfyg2j` (fencing, 20 comments, draft v2 w/ Nextdoor nod) → ② #50 (mulch pricing — verify alive at slot, ~54h old) → ③ #41 (slow-season, promoted; #44 demoted — score 0, dead) → fallbacks #38/#40/#44.**
- **⚠️ #48 reply MUST be posted manually.** The API post got **AutoMod-filtered ~19:50Z (`t1_p24ihev`)** — do NOT re-queue via API. Blasian pastes it into `1vgvrg5` by hand. (Kit slot now held by #50 instead; #48 manual repost still pending on him.)
- **🧭 Roadmap additions (23:55Z feature lane):** ⭐ **quote-approval capture** (timestamped "Approved" state = dispute shield — live payment-fight thread) and ⭐ **crew clock-in/out + field forms** → both go to the dartboard under **Crew-tier depth** (SA is the only one shipping it). **Customer self-quote page** = booking-loop v2 candidate (QuoteIQ gates it at $299/$699 — our gate is the compare line). **Minimum-job-price setting** (new, from the mulch thread).
- **🚫 AI receptionist — 3rd signal in 24h, STILL don't build.** QuoteIQ now productizes "Virtual Call Team"; 47% of AI-using SMBs use AI for customer service (ServiceTitan: 12% embedded + 34% experimenting). The banked **missed-call text-back (Twilio)** stays the right cheap version. Keep MowGo text-first; don't chase voice.
- **🆕 LawnPro Software added to watch** (lawnprosoftware.com: $29/mo annual w/ 3 employee logins — sticker-undercuts Crew $79, but feature-heavy ladder: chem programs, P4P). **Full profile due next competitor run.**
- **🔧 SMS pipeline ROOT-CAUSED:** the "MowGo SMS Sender" cron (`3f67268baeb6`, daily 14:00Z) has **never run successfully** — `last_error: "Script not found: /opt/data/scripts/send_sms.py"` while the script actually lives at `/opt/data/mowgo/scripts/send_sms.py` (verified in jobs.json + filesystem). Cron was **paused Aug 6 18:29Z**. This is why 12 SMS drafts sit queued with zero sends logged — an automation path bug, not just a manual gap.
- **⚠️ #🌱mowgo-outreach channel is GONE** — fetch returns **404 Unknown Channel (verified 2×)** this run (channel was reachable at the Aug 6 12:00Z scan). No delivery targets it (Rule of 100 moved to #🌱mowgo-leads Aug 5), so nothing is lost — but confirm the deletion was intentional and clean up references (vault index, daily_scan lists).
- **🟢 Cowork channel stays empty & healthy** — cleanup held; watchdog 0 new failures (Day 6 since the Aug 4 13:50Z fix). The ~128 spam messages stayed gone.

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **🔧 FIX THE SMS SENDER CRON (root cause found).** `3f67268baeb6` "MowGo SMS Sender" — last run Aug 6 14:00Z errored `Script not found: /opt/data/scripts/send_sms.py`; script is at `/opt/data/mowgo/scripts/send_sms.py`. Cron is **PAUSED** (Aug 6 18:29Z). Fix the script path (or set workdir), resume, then send: **12 SMS drafts queued across 3 waves** (Wave 1: 5 leads Aug 5 01:33Z; Wave 2: 5 leads Aug 5 15:11Z; Wave 3: 2 report offers Aug 6 15:12Z — NG Outdoor/Edmond, Frankies/Norman). **Zero sends logged anywhere — Day 5.**
2. **📝 Blasian: manually paste the #48 reply** into r/sweatystartup `1vgvrg5` ("boring local service") — API post AutoMod-filtered ~19:50Z (`t1_p24ihev`); do NOT re-queue via API.
3. **🐦 Reddit slot TONIGHT — Fri Aug 7, 22:21Z (96h gate).** Kit: ① #43 `1vfyg2j` (draft v2, Nextdoor nod; 20 comments, still hot — a competitor app promo-commenting makes our friend-mode answer stand out) → ② #50 (verify alive first) → ③ #41 → fallbacks #38/#40/#44. **Verify visibility after each post (successful API ≠ visible).**
4. **💳 Aaron: logged-in end-to-end Stripe checkout — Day 23.** 09:12Z check all green: bundle keyless **by design** (server-side Checkout, 401 = auth gate executing correctly), iOS `pk_live_` valid + PaymentSheet wired (SPM resolved), mowflow.pages.dev redirects to live app. The ONLY unproven link remains one real logged-in checkout.
5. **💬 Blasian reply — Day 11.** Leads question (Jul 28 17:03Z) still unanswered (✅ reaction, no reply). Draft ready at `leads/blasian-reply-draft-2026-08-01.md`. **Human loop silent 10 days** (last human msg: his "hello" Jul 29 15:39Z).

### 🟡 Medium

6. **Lead follow-ups Day 12 — STILL 0 replies.** Emerge / Metro Green / Bigfoot / Simply (Jul 29) + Campbell & Sons (Jul 31). 2nd follow-up was due Friday if silent — overdue. Highest-ROI 10 min, unchanged.
7. **Jobber switcher window (~Aug 15)** — ammo refreshed: 3-month promos **live-verified** (Core $40/3mo etc.); compare-page edits queued (Jobber promo row + QuoteIQ Price-Lock + 1%-fee lines).
8. **SoftwareWorld + directory submissions — Day 27.** Brand query holds #2 (no regression); zero listicle presence; QuoteIQ co-founder still self-ranking in his own "Top 8".
9. **Build queue (unchanged priorities + new ideas):** quotes v1 (#1) · booking link (named P0) · photo checklist (validated ×3: QuoteIQ Inspection Tool, Planado photo reports at every tier, r/CRM proof-of-work thread) · review-request text (#1 unshipped cheap win) · NEW: quote-approval capture, crew clock-in/out, min-job-price (dartboard).
10. **Watch:** LawnPro Software (full profile due) · Servinix (commercial Sept 14) · Werx (watch only) · QuoteIQ "Virtual Call Team" + content machine · LawnBoss 305/mo (decline stalled) · **astroturfing tracker: TradeKit** (2nd shill this week, after ContractorPlusDotApp in #43).
11. **Cowork channel: empty, healthy** — nothing to do (cleanup held; watchdog holding).

### 🟢 Low

12. mowflow CF project deletion confirm (domain retired regardless) · trial 7 vs 14 days decision · concierge e2e test (channel wired, never carried a real request) · **BI engine safe-root note:** 19:37Z run could not update `/tmp/reddit_sweep.py` (write denied — outside HERMES_WRITE_SAFE_ROOT=/opt/data) · clean up outreach-channel references (index/daily_scan) once deletion is confirmed.

---

## 🔬 Research Findings

### ⭐ QuoteIQ review wall (4,100+ reviews, full dump) = reliability wedge
- **15+ bug complaints clustered Dec 2025–Feb 2026:** "super buggy and slow", "constantly logs me out", "won't let me create clients", **"still in beta, except you're paying them to test it"**. One reviewer ties it to the July hike: *"Now that they've upped their costs heavily, their app does not work."* Bug wave after price hike = **churn window**.
- **💣 Stealth 1% processing fee ON TOP of Stripe** — reviewer: *"I'm paying 3.9% in fees top line… Didn't update me or tell me. Just started charging my card."* Their $29.99 is really $29.99 + 3.9%/tx.
- 2-month cancellation saga (sharpen "cancel anytime, no phone call") + trial-paywall complaints ("can't even test anything") → **keep MowGo's 14-day trial fully functional**.

### ⭐ Jobber 3-month promos site-wide — LIVE-VERIFIED (02:48Z)
- Core $49 → $40/3mo · $39 1-yr → $32/3mo · $29 annual → $24/12mo · Grow $199→$160 · Plus 15u $699→$560. Wizard anchors **"Starting at $24/mo"**. Read: **demand softening at the low end** — they need a visible discount to convert. "$29/mo" headline now triple-loaded (1-yr lock + first-year promo + $29/extra user).

### 🟢 TurfHop: outage closed, LawnBoss stalled, two new profiles
- **TurfHop:** down Aug 1 17:00Z → Aug 6 ~11:00Z (**~114h, longest in tracker history**); recovered unchanged (Truck $49/Office $79/HQ $129 + Orbit AI credits); `/features` recovered by 19:37Z; **no relaunch discount**.
- **LawnBoss: 305 pros/mo** (was 287) — 4th capture, decline **stalled but not reversed** (-63% off the 829 peak); pushing a 12+ page SEO machine (compare pages + "best of 2026" roundups).
- **Planado (profiled):** lawn-specific crew tool, **$12/$29 per user/mo**, checklists + before/after photo reports + geofencing at **every tier** (re-validates the photo-checklist roadmap). **No invoicing or payments anywhere** — auto-invoice + SMS pay-link loop is the wedge. 2-person crew ≈ $58/mo vs MowGo Crew $79 flat.
- **LawnPro Software (new watch):** $29/mo annual w/ 3 employee logins — sticker-undercuts Crew $79 but feature-heavy (chem programs, P4P). Full profile next competitor run.

### 🧭 Feature lane (23:55Z) — 4 new ideas, 2 worth doing
- ⭐ **Quote-approval capture** — `1vhj4sb` is a live payment fight: $335 of work, no approved quote, homeowner refused to pay. Timestamped "Approved" state between quote and scheduling = dispute shield. Small build; pairs with photo-proof.
- ⭐ **Crew clock-in/out + field forms** — SA the only one shipping it ("NEW Team App"); owners anxious about labor % (r/Entrepreneur "labor is 37% of sales" tonight). Natural Crew-tier depth.
- **Customer self-quote page** — QuoteIQ gates self-quote at $299/$699; MowGo's `?mode=quote` → real pick-services-see-price flow = booking-loop v2. **Minimum-job-price setting** — mulch thread shows "$750 for 2 yards" don't-want-the-job quotes and pros with $850 minimums; draft #50 tells small ops to set a floor.

### ✍️ Copy fuel (verbatim, from `1vhhu28` top comment)
- *"The consolidation that actually pays is quote to signature to invoice to payment… re-keying the same numbers into [three tools]."* — **a stranger just described MowGo's whole pitch.**
- Caught **TradeKit astroturfing** that thread — second shill sighting this week (after ContractorPlusDotApp in #43); tracking for the competitor lane.

### 🤖 AI receptionist trend (3rd signal in 24h)
- **47% of AI-using SMBs now use AI for customer service** (12% embedded + 34% experimenting, per ServiceTitan). QuoteIQ productizes "Virtual Call Team". Missed-calls thread = live proof. **Decision: text-first, don't build.**

### 🐦 Reddit — 7th consecutive quiet r/LawnCarePros window
- 0 new bankable drafts except **#50** (mulch pricing, exact-ICP OP, signld.ai competitor already pitch-commenting); r/Entrepreneur recovered after the 19:37 rate-limit storm (nothing on-ICP); 3 hot r/smallbusiness threads (discount-drama, card-fees, missed-calls) missed the window — logged only, dead by Fri.

### 🔧 Infra — this window
| Component | Finding | Status |
|---|---|---|
| Intel Engine | 6 clean runs (02:48 / 07:07 / 11:19 / 15:37 / 19:55 / 23:55Z), state v29→v35, seen 739→1239; next: LawnPro profile | ✅ cadence healthy |
| Stripe health check | 09:12Z all green; keyless bundle by design; iOS PaymentSheet wired; mowflow redirects | ✅ |
| Invoice reminders | 12:30Z: OK — 0 unpaid >7d | ✅ |
| Rule of 100 | Wave-3 delivered 15:12Z to #leads (2 SMS report offers + 3 FB/IG posts); dedup gate holding | ✅ |
| **SMS Sender cron** | **Root-caused: script path mismatch (`/opt/data/scripts/…` vs `/opt/data/mowgo/scripts/…`); never ran; PAUSED 18:29Z** | 🔴 fix + resume |
| Provider watchdog | 0 new failures; cowork channel empty (cleanup held) | 🟢 |
| Reddit posting | Gated → **TONIGHT Fri Aug 7 22:21Z**; kit ① #43 → ② #50 → ③ #41 | 🟢 |
| BI engine | 19:37Z file-mutation verifier: `/tmp/reddit_sweep.py` write denied (outside HERMES_WRITE_SAFE_ROOT) | 🟡 note |

---

## 📝 Notes / Context

### Channel Activity (since Aug 6 02:00Z)
- **#🌱mowgo** — **13 new, ALL bot cron reports:** Intel Engine ×6 runs (02:48Z pricing, 07:07Z features, 11:19Z competitor, 15:37Z daily summary, 19:55Z pricing, 00:49Z features — 2 msgs each except 15:37Z/19:55Z) + Stripe health check 09:12Z (2 msgs) + invoice reminders 12:30Z (1 msg). **No human messages — Blasian silent since Jul 29 15:39Z (Day 10).**
- **#🌱mowgo-outreach** — **⚠️ CHANNEL GONE.** Fetch → `404 Unknown Channel` (2×). Was reachable at the Aug 6 12:00Z scan (55 msgs, newest Aug 5 01:48Z). Likely deleted by Aaron — dormant since Rule of 100 moved to #leads. **0 messages synced.**
- **#🤝mowgo-cowork** — **0 messages** (empty since the Aug 6 13:30Z cleanup; watchdog holding, 0 new failures).
- *(Cross-check)* **#🌱mowgo-leads** (9 fetched) — **Rule of 100 wave-3 posted 15:12Z:** 2 SMS report offers (NG Outdoor/Edmond, Frankies/Norman — "only 2 qualify, other 21 phone leads already posted, dedup gate") + 3 FB/IG posts (rain-day rebook, OK $55.25 money post, flat-price positioning). **Blasian's leads question (Jul 28) still unanswered — Day 11.** In-channel note confirms the **SMS Sender cron failure** (path mismatch).

### Escalation Timeline (execution gap)
| Blocker | Flagged | Now | Status |
|---|---|---|---|
| **SMS pipeline (12 queued, 0 sent)** | Aug 5 | Day 5 🔴 | **ROOT-CAUSED: sender cron script-path bug; never ran; paused Aug 6 18:29Z — fix + resume** |
| Lead follow-ups (5 emails, 0 replies) | Jul 29 | Day 12 ❌ | 2nd follow-up overdue (was due Fri) |
| Blasian human loop | Jul 29 | Day 11 ❌ | Silent 10 days; **#48 reply AutoMod-filtered — needs manual paste** |
| Stripe logged-in e2e checkout | Day 1 | Day 23 | ✅ LIVE; only unproven link = Aaron's real checkout |
| Reddit replies | Week 1 | **TONIGHT 22:21Z** | Kit ① #43 → ② #50 → ③ #41 (verify visibility after each) |
| Comparison-site absence | Day 1 | Day 27 ❌ | Brand #2, zero listicle; directory submissions still highest-leverage 30 min |
| TurfHop outage | Aug 1 | — | ✅ **CLOSED Aug 6** (~114h, longest tracked; no relaunch discount) |
| Rule of 100 duplicate-post bug | Aug 5 | — | ✅ RESOLVED (dedup gate + #leads delivery); wave-3 clean |
| Cowork spam (128 msgs) | Aug 4 | — | ✅ Cleaned Aug 6 13:30Z; channel empty |
| **Outreach channel** | — | Aug 7 | ⚠️ **GONE (404 ×2)** — confirm deletion was intentional |
| Online booking link | Jul 23 | Day 18 | P0 named; self-quote page = booking-loop v2 candidate |
| Solo pricing debate | Jul 30 | Day 13 | Intel: HOLD $39/$79 flat — band is now a promo/lock-in contest (Jobber 3-mo promos, QuoteIQ Price-Lock + 1% fee) |

### Key Takeaway
A fully machine-driven day — **13 bot messages, 0 human (Day 10 of silence)**. Two machine-side closures: **TurfHop's longest-ever outage is over** (~114h, no relaunch discount — retire the compare line) and the **SMS mystery is root-caused**: the sender cron points at a nonexistent script path, has never run, and is now paused — 12 drafts sit queued across 3 waves. Intel's best ammo: **QuoteIQ's own review wall** (bug wave after price hike, stealth 1% fee on top of Stripe, cancel saga), **Jobber's promo math live-verified**, new profiles for **Planado** (no invoicing at all) and **LawnPro** (sticker undercut, profile due), plus two bankable feature ideas (quote-approval, clock-in/out). **Tonight 22:21Z is the Reddit hinge** — kit ① #43 → ② #50 → ③ #41 — and Blasian must manually paste the AutoMod-filtered #48 reply. Aaron's plate: fix/resume the SMS sender, Stripe e2e checkout (Day 23), Blasian reply (Day 11), 5 lead follow-ups (Day 12, overdue), directory submissions (Day 27).

---
*Generated by MowGo nightly vault sync — 2026-08-07 02:00 UTC*
