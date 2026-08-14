# 🌱 mowgo — Raw Channel Dump
**2026-08-10 02:00 UTC | 100 messages fetched (14 new since last sync)**

## Most Recent Activity (New since Aug 09 02:00 UTC sync)

### 2026-08-09T05:32:49.588000+00:00 — HeremesV2
**Bot** —

Cronjob Response: MowGo Intel Engine
(job_id: 54982fcbf42e)
-------------

All deliverables persisted and verified. Final report:

---

# MowGo BI — Run 2026-08-09 05:19 UTC (Sun)

**Sunday deep-dive was already completed this cycle** (01:13Z: digest + lead discovery + pricing lane, tracker at 20 leads). This run: fresh Reddit sweep + competitor monitoring lane. State v44→v45.

## Competitor moves (delta vs yesterday's pass)

- **Servinix published full pricing** — was hidden behind "beta Aug 17" at the last pass. Now: AI Service Assistant **$300/mo flat**, FSM $20/tech, GPS $15/vehicle + $50 OBD. Hook is "show your invoice, we'll beat it by 50%". They're a 1-100 tech FSM play, not a crew competitor, but the numbers are compare-page gold: *their AI layer alone is $300/mo vs MowGo's whole loop at $39/$79 flat.* Beta opens Aug 17, launch Sept 14 — re-check then.
- **LawnBook's "1,000+ businesses" looks inflated.** Google Play listing (live since May 4): 100+ downloads, 6 reviews. iOS is the real channel. Feature surface keeps growing though — Mass Email Campaigns, missed-call lead capture, QBO/Xero import. Note: broadcast comms is now crowded (GorillaDesk Basic $49, LawnBook, Jobber) — the schedule-change broadcast backlog is no longer novel; win on the rain-delay + booking-link pairing, not the broadcast itself.
- **Jobber: no delta.** $24 anchor reconfirmed, Now conference Sept 25 unchanged.

## Reddit sweep (8/8 subs, 200 entries, 134 new)

- **No new on-ICP threads this window.** The Mon kit stands: **#55 → #57 → #43, slot Mon Aug 11 22:23Z**, plus friend-replies to `1vj4wob` / `1vj9nay`.
- Screened and logged off-ICP (tracker updated so they won't be re-screened): `1vjgcfr` (sales/ops team CRM), `1vjeath` (freight brokerage), `1viyhlv` (MVP agency), `1vjh02j` (local-SEO self-promo).
- Infra note: Reddit RSS 429'd hard this window (6/8 subs on first pass). Retry ladder saved to `.bi_scripts/reddit_sweep_retry.py` for future runs.
 (1/2)

---

### 2026-08-09T05:32:50.571000+00:00 — HeremesV2
**Bot** —

## For Monday (Aaron)

No action list today (Sunday), but the Monday plate is unchanged and waiting: kit post at 22:23Z, two friend-mode replies, **2nd follow-up emails to all 5 leads (Day 11+, zero replies — highest-ROI 10 minutes you have)**, directory submissions (Day 26), SMS queue decision, Blasian reply (Day 13+).

**Files:** `intel/2026-08-09_0519.md` · `.run_markers/2026-08-09_0519.md` · digest addendum in `weekly_digest_2026-08-09.md` · tracker screening log · state v45 (seen 1,721, next lane **industry_trends** 1/4).

To stop or manage this job, send me a new message (e.g. "stop reminder MowGo Intel Engine"). (2/2)

---

### 2026-08-09T09:08:25.325000+00:00 — HeremesV2
**Bot** —

Cronjob Response: 🔌 MowGo Stripe health check
(job_id: 9f622e63f4b8)
-------------

Both domains scanned and probed. Report:

---

## MowGo Stripe Integration Status — Aug 9, 2026

**Overall: OK — deployed, wired, auth-gated as designed. No regression.**

### 1. Domains checked (both)
| Domain | Bundle | Checkout POST | Verify GET | Portal POST |
|---|---|---|---|---|
| mowgo.pages.dev | `index-Bt0NtHLK.js` (entry, 183KB) | 403 `{"error":"Forbidden"}` | 401 `{"error":"Unauthorized"}` | 403 `{"error":"Forbidden"}` |
| mowgoapp.com (prod) | `index-Bt0NtHLK.js` — **same hash** (domains now in sync) | 401 `{"error":"Unauthorized"}` | 401 | 401 |

All 3 Stripe endpoints return JSON error responses on both domains = **functions deployed and executing** (not 405/HTML static fallthrough). 401/403 is the expected auth-gated state without a real JWT — not a failure.

### 2. Publishable key in built JS
**Not found in either web bundle — this is CORRECT, not a gap.** Checkout is fully server-side (Cloudflare Function creates the Checkout Session; client just `fetch`es `/api/stripe/checkout-subscription` with a Bearer JWT and redirects to the returned URL). `VITE_STRIPE_PUBLISHABLE_KEY` compiles out of the web bundle — verified again today, matching prior checks (Jul 29/31). No `pk_`/`sk_`/`cs_` keys leak into the web client.

The live publishable key exists only in the iOS app: `pk_live_51TwFQhGwXKVLlr2Ip5FKKwD...` in `ios-native/MowGo/Config.xcconfig:27` + `Info.plist:13` — **valid live format, account prefix `51TwFQhGwXKVLlr2I` matches `acct_1TwFQhGwXKVLlr2I`** → authentic live key.

### 3. PaymentSheet configuration
- **Web: N/A by design** — web uses Stripe Checkout Sessions redirect (correct for a redirect-based flow).
- **iOS: fully configured** in `PaymentView.swift`:
  - `PaymentSheet.IntentConfiguration(mode: .payment(amount:amountCents, currency:"usd"))` with `confirmHandler` returning the clientSecret from `createPaymentIntent` (Supabase Edge Function) (1/2)

---

### 2026-08-09T09:08:25.591000+00:00 — HeremesV2
**Bot** —

- `config.merchantDisplayName = "MowGo"`
  - `paymentSheet.present(from: topmostViewController)` with a proper topmost-VC fallback chain
  - Guarded by `stripe.isConfigured` (fails loudly if publishable key missing)

### 4. Client wiring (deployed bundle scan)
- `checkout-subscription` ✓, `create-portal-session` ✓, `verify-session` ✓ all present in deployed chunks.
- **Aug 2 verify-session bug is fixed in the deployed build**: `Subscribe` chunk sends `Authorization: Bearer <token>` on the verify GET when a session exists (old build sent a bare same-origin GET → 403 → false failure after real payments). Now: 401 from probes = JWT gate active, client sends the token.
- `payments.js` sends `{plan, interval}` + Bearer to checkout — annual/monthly wiring intact.

### Known limitation (unchanged)
Probes can't see past the JWT gate, so env-var presence on CF (STRIPE_SECRET_KEY etc.) isn't re-proven today — but 14 env vars were confirmed Aug 3-4 (`deployment_configs.production.env_vars`) and nothing changed since. The only still-unproven link remains a real logged-in end-to-end checkout (documented manual test).

**Verdict: OK** — both domains serving the same current build, functions live and auth-gated, client wired and sending Bearer tokens, iOS PaymentSheet valid-live-key + fully configured.

To stop or manage this job, send me a new message (e.g. "stop reminder 🔌 MowGo Stripe health check"). (2/2)

---

### 2026-08-09T09:48:00.503000+00:00 — HeremesV2
**Bot** —

Cronjob Response: MowGo Intel Engine
(job_id: 54982fcbf42e)
-------------

⚠️ Cron 'MowGo Intel Engine' failed: HTTP 402: Insufficient Balance

To stop or manage this job, send me a new message (e.g. "stop reminder MowGo Intel Engine").

---

### 2026-08-09T12:30:02.838000+00:00 — HeremesV2
**Bot** —

Cronjob Response: MowGo invoice reminders
(job_id: f51f38e19d7d)
-------------

[2026-08-09T12:30:02.509513+00:00] OK — no unpaid invoices older than 7d (0 unpaid found, 0 skipped/cooldown)

To stop or manage this job, send me a new message (e.g. "stop reminder MowGo invoice reminders").

---

### 2026-08-09T13:37:05.648000+00:00 — HeremesV2
**Bot** —

Cronjob Response: MowGo Intel Engine
(job_id: 54982fcbf42e)
-------------

Here's the MowGo BI Engine report for **Sunday, Aug 9, 2026, 10:00 UTC** (weekly deep-dive + lane 1/4 industry_trends):

---

## What Changed Since Last Run (05:19Z)

**Industry trends intel** (lane 1/4) produced 5 actionable findings. No fresh Reddit threads detected (search engines rate-limited; previous sweep through ~80 URLs already covered the 48h window). No new lead discoveries this session (FB groups blocked for extraction; snippet-level data logged).

### Industry Trends — Key Findings

1. **Chemical-free turf management is going mainstream.** Naware (bootstrapped MN startup, TechCrunch Battle of 200) demos AI-steam weed detection bolted onto existing mowers with 85-90% accuracy. Regulatory pressure is real: 26 of 40 common lawn care ingredients under scrutiny, Minneapolis nearly banned synthetic pesticides. 95% of turf pros want chemical-free options. *MowGo angle:* crews adding organic transition programs need tighter scheduling/invoicing — Premium seasonal packs v2 could bundle organic program tracking.

2. **Market numbers validate our TAM.** Market Research Future confirms $2.33B → $3.97B by 2035 (5.48% CAGR). SMB segment is the growth engine ($1.1B → $1.95B share). Scheduling/dispatch = top feature driver. Subscription model = 50%+ revenue. Cloud deployment dominates. Confirms flat-price model resonates with the SMB majority.

3. **M&A accelerating in landscaping.** Multiple 2026 deals documented (Mariani Premier Group → Mitschele's, Winterberry Gardens → Willie C. and Sons). Buyers targeting mid-market operators aggressively. Signal: consolidation creates integration pain → churn window for Jobber/HCP users post-acquisition.
 (1/2)

---

### 2026-08-09T13:37:05.856000+00:00 — HeremesV2
**Bot** —

4. **Robotic mower labor dynamics shifting.** UF/IFAS study shows robots improve lawn health while reducing labor. ANTBOT debuts smart series (CES 2026). Carbon Robotics $1M/unit, Blue River exit $305M. Implication: robots eat entry-level mowing jobs but create demand for higher-value packages (aeration, irrigation, design-build) — exactly the seasonal-pack opportunity MowGo targets with Premium.

5. **OK sector growing despite drought.** Oklahoma lawn & garden sector expanding, with tech adoption (robotic mowers, smart irrigation) accelerating. Contradicts "drought = market collapse" narrative — operators pivot to premium services during dry periods.

### Lead Pipeline Snapshot

| Metric | Value |
|--------|-------|
| Tracked leads | 20 |
| Contacted / responses | 5 / 0 |
| Conversions | 0 |
| Follow-ups overdue | Day 11+ (all 5) |
| New today | 0 (FB blocked, no dirs) |

### Monday Actions Flagged

1. **Post kit @ 22:23Z:** #55 `1vi1hcj` → #57 `1vi8tr3` → #43 `1vfyg2j`
2. **Friend-mode replies:** `1vj9nay` (quote-form builder) + `1vj4wob` (move-out pricing)
3. **Follow-up emails:** all 5 leads (Day 11+, highest ROI)
4. **Directory submissions:** Capterra/G2/SoftwareAdvice/GetApp (Day 26 of zero presence)

### Files Written

- `bi_report_2026-08-09_1000.md` — daily BI report
- `weekly_digest_2026-08-09.md` — updated with industry trends + OK/drought/market data
- `.bi_state.json` — v44→v45, lane advanced to competitor_monitoring (0/4)

### Next Run

**Lane:** competitor_monitoring (0/4) · **Watch:** LawnBook traction, Servinix launch Sept 14, Jobber Now fallout (Sept 25), QuoteIQ churn post-hike

To stop or manage this job, send me a new message (e.g. "stop reminder MowGo Intel Engine"). (2/2)

---

### 2026-08-09T17:38:43.584000+00:00 — HeremesV2
**Bot** —

Cronjob Response: MowGo Intel Engine
(job_id: 54982fcbf42e)
-------------

## MowGo BI Engine — 2026-08-09 17:37 UTC (Sunday Evening Run)

### What ran

| Task | Status |
|------|--------|
| ✅ Reddit sweep | Target subreddits scanned — no new on-ICP threads in this 4h window beyond `1vj4wob` (Mon reply) and `1vj9nay` (Tue/Wed). Hound's site:reddit queries had mixed backend coverage. |
| ✅ Industry Trends lane (1/4) | **DONE** — full report at `intel/2026-08-09_1737.md` |
| ✅ W32 digest | Already compiled at `weekly_digest_2026-08-09.md` (105 lines, reviewed by prior run) |
| ✅ State file | Updated to v46, next lane = pricing_intelligence |

---

### Industry Trends — Top 5 findings

1. **Drought is THE 2026 product story.** Bella FSM published a full drought playbook (Aug 5). MowGo's rain delay + level billing + route optimization = the drought-season toolkit no competitor at $39-79 matches. Level billing is the wedge — operators losing mowing revenue need to pivot, not buy more software.

2. **ProBase (FREE, by LawnStarter) is the most serious free entrant.** Genuinely functional invoicing/scheduling/route optimization for 1-5 crews. Monetizes via job lead marketplace. MowGo's counter: independent-operator positioning, no marketplace cut, no lead-gen middleman.

3. **Free tier war is real.** 4+ free options (ProBase, LawnPro Free, LawnBook Free, YardBook Free) before operators reach paid software. MowGo wins on: no per-user tax, truly no-strings free (5 clients), rain delay + booking link no free tier matches.

4. **US lawn care market = $309B (2025) → $488B by 2034, 5.2% CAGR.** Drought shifts spend from mowing to irrigation/turf services, not shrinks the market.

5. **Repair-CRM ($89/mo, equipment-level tracking)** entered the small-team space. Not a direct threat but equipment tracking is a cheap differentiator MowGo could add.

---

### Monday Morning (Aug 10) — Action List for Aaron
 (1/2)

---

### 2026-08-09T17:38:43.816000+00:00 — HeremesV2
**Bot** —

1. **Mon 22:23Z Reddit slot** — Cron already created (4c195234eaa9). Kit: `1vj4wob` (pricing question, new solo op) → `1vj9nay` (building quote form by hand, industry TBD) → fallback. Reply drafts in `intel/`.

2. **SMS sender** — 23 queued texts (Day 8), cron PAUSED. `hermes cron resume 3f67268baeb6` unblocks it.

3. **Lead follow-ups overdue Day 14** — Emerge, Metro Green, Bigfoot, Simply (Jul 29) + Campbell & Sons (Jul 31). 0 replies. 10 min work.

4. **Blasian reply** — Leads question unanswered Day 12 (✅ reaction only). Draft ready.

5. **W32 digest review** — `weekly_digest_2026-08-09.md`. Highlights: Jobber switcher window ~Aug 15, drought = national story, Servinix $300/mo = compare-page foil, 5 leads×0 replies.

6. **Intel credits** — Self-recovered at 13:34Z after 402 error at 09:32Z. Monitor.

---

### Pipeline status

| Metric | Value |
|--------|-------|
| Total leads | 20 (5 contacted, 0 replies) |
| Reddit threads queued | 2 (Mon, Tue/Wed) |
| SMS queued | 23 (Day 8, 0 sent) |
| Weekly digest | ✅ vW33 |
| Next market lane | pricing_intelligence (next run) |
| CF tokens | 🔴 DEAD (Day 3 — git push works) |
| Full backup | 🔴 GitHub repo bloat (delta backup OK) |
| Stripe e2e | 🟡 Day 25, unconverged |

To stop or manage this job, send me a new message (e.g. "stop reminder MowGo Intel Engine"). (2/2)

---

### 2026-08-09T21:42:37.204000+00:00 — HeremesV2
**Bot** —

Cronjob Response: MowGo Intel Engine
(job_id: 54982fcbf42e)
-------------

---

# MowGo BI Engine — Report for Sun Aug 9, 21:38Z

**Context:** Weekly digest already compiled at 10:00Z (W32). This is the **pricing_intelligence lane** run + Reddit pipeline check.

## ⚠️ Reddit Pipeline DEGRADED
RSS feeds were working at 10:00Z but now return **403** across all 5 target subreddits. No new threads captured since the digest sweep. Next check in 4h to see if it recovers. The Mon 22:23Z posting kit (#55→#57→#43) is already locked, so no immediate posting impact.

## Pricing Intelligence — New Findings

**Servinix (beta Aug 17 → commercial Sept 14):** Full landscaping page confirmed. They're shipping **rain delay automation** (SMS + auto-reschedule) — directly overlapping MowGo Rain Delay v2. Also: crew GPS, recurring contracts, before/after photos, **"60% off your invoice"** switcher hook. Pricing unlisted. MowGo counters: already shipping Rain Delay v2, no beta, $79 flat vs unknown.

**LawnBook:** App Store pricing confirmed — Free (15 clients) / Pro $9.99 / Premium $14.99 / Crew $29.99. Their blog content machine is running hard (SEO self-ranking posts). Still no web app, no crew dashboard, no booking link.

**CrewNest (NEW watch):** $29/mo for 3 members, $5/addl. Covers pressure washing + lawn + snow. Low-priced but early — added to tracking.

**Jobber/GorillaDesk/QuoteIQ:** No pricing changes since the digest. All consistent with prior state.

## 🗓️ Monday Checklist for Aaron

1. **Mon AM: Follow-up emails to 5 leads** — Day 11+ overdue, highest-ROI 10 min of the week
2. **Mon 22:23Z: Post kit** — #55 (drought/level-billing thread) → #57 (new TX biz) → #43 (first-5-customers)
3. **Mon/Tue: Friend-mode replies** — `1vj9nay` (quote-form builder) + `1vj4wob` (move-out pricing)
4. **#48 manual paste** + Blasian reply (both overdue Day 13+)
5. **Directory submissions** (Capterra/G2/GetApp — Day 26 of zero listicle presence) (1/2)

---

### 2026-08-09T21:42:37.498000+00:00 — HeremesV2
**Bot** —

6. **Pipeline check** — if Reddit RSS stays 403, need alternative (Hound search, old.reddit HTML scrape)

## Lane Next: feature_ideas (rotates after pricing_intelligence)
Intel saved to `intel/2026-08-09_2138_pricing-intel-lane.md`. State v46 → v47.

To stop or manage this job, send me a new message (e.g. "stop reminder MowGo Intel Engine"). (2/2)

---

### 2026-08-10T01:46:30.972000+00:00 — HeremesV2
**Bot** —

Cronjob Response: MowGo Intel Engine
(job_id: 54982fcbf42e)
-------------

---

# MowGo BI Engine — Run Report
**Mon Aug 10, 2026 · 01:42 UTC · W33 · Lane: feature_ideas (3/4)**

## ✅ Run Complete — State v48

### Reddit (8 candidates, standard Monday quiet window)
- **`1vj2pj6`** r/sweatystartup — "Second biz" considering lawncare. Reply candidate (founder-mode advice).
- **`1vj2it9`** r/smallbusiness — "Heavy duty mowing" SEO owner. SEO advice reply.
- **`1vjvhu7`** r/FortWorth — scheduling/autopay complaint thread. Product copy fuel.
- **`1vjbrmk`** r/shreveport — new lawn care startup. Welcome reply.
- **`1vk2tgr`** r/smallbusiness — "software worth paying for." Tue/Wed reply candidate.
- **`1vjk1sc`** r/smallbusiness — "$300/mo SaaS too much?" Pricing perception intel.
- **`1vjn2uu`** r/smallbusiness — AI calling discussion. Jobber AI Receptionist monitor.
- **`1vjou0q`** r/sweatystartup — "what biz would you build" scheduling mention. Low signal.

Pre-flagged (carry-forward): `1vj4wob` (new owner pricing, Mon reply) + `1vj9nay` (quote→Jobber loop, Mon reply).

### Feature Ideas — Top 10 ranked
1. **Level billing** (drought national story, Rain Delay v2 head start) ← HIGHEST IMPACT
2. **Missed-call text-back** (Twilio ready, S effort, beats Jobber's $29 AI Receptionist)
3. **Jobber import tool** (switcher wave open NOW — their ladder is $24-399+, ours is $39/$79 flat)
4. **Schedule-change broadcast** (weather/routing changes via SMS)
5. **Satellite property measurement** (everyone gates at $149+; we could do it at $0)
6. **Client portal** (booking link only — table stakes we're missing)
7. **Crew time clock + GPS** (Crew tier value-add)
8. **Chemical/EPA compliance** (Jobber's biggest gap — spray market unlock)
9. **AI Autopilot expansion** (route optimization, auto-follow-ups)
10. **Seasonal packs** (Q4 aeration/seeding bundles for Premium tier)

### Key market signals (1/2)

---

### 2026-08-10T01:46:31.221000+00:00 — HeremesV2
**Bot** —

- **Jobber's 4-tier wall** ($24 anchor → $320+ actual) is the widest pricing gap in years. Every Connect user paying $80-139 + $29/user is paying more than MowGo Crew at $79 flat.
- **QuoteIQ's hidden 1%** on top of Stripe (~3.9% total) = compare-page bullet. We charge 0%.
- **LawnBook** ($0-29.99, free=15 clients vs our 5) = new pricing floor threat. Our counters: web app, native apps, crew dashboard, booking link, no-card trial.
- **Solo operator consensus** across all 2026 reviews: 5 things needed — client list, schedule from truck, on-site invoicing, auto-recurring billing, auto-reminders. MowGo Solo at $39 covers all 5. The compare page should lead with this.

### Weekday outreach
⏸ Skipped this run (01:42 UTC, before 12:00-20:00 window). Next run at/after 12:00 UTC will generate outreach list.

### Recommended actions (next run)
1. **Aaron:** Follow up 5 leads (Day 12+ overdue — highest-ROI 10 min this week)
2. **Aaron:** Reply `1vj4wob` and `1vj9nay` in Mon slot (friend-mode, no pitch)
3. **Lane:** Next run = **competitor_monitoring (0/4)** — deep check on Jobber/QuoteIQ/LawnBook pricing moves
4. **Ship priority this week:** Level billing (M) + missed-call text-back (S) — highest human-impact features with lowest effort

### Files
- `intel/2026-08-10_0142.md` — full feature ideas research
- `.run_markers/2026-08-10_0142.md`
- `.bi_state.json` v48 (next lane: competitor_monitoring)
- Lead tracker: unchanged (20 leads / 5 contacted / 0 replies)

To stop or manage this job, send me a new message (e.g. "stop reminder MowGo Intel Engine"). (2/2)

---

*Raw dump generated by MowGo nightly vault sync — 2026-08-10 02:00 UTC*