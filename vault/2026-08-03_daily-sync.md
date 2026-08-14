# MowGo Nightly Vault Sync — 2026-08-03

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Past 24 hours (Aug 2, 02:00 – Aug 3, 02:00 UTC)
> **Total messages synced:** 123 (100 mowgo — 16 new + 23 outreach — 0 new + 0 cowork — 0 new)

---

## 📊 Decisions

- **🚀 Quotes v1 ESCALATED to #1 build priority** — market converging from 3 directions: QuoteIQ gates self-quoting + route optimization behind **Elite $299/mo** (their pricing captured live for the first time), LawnEstimates is shipping weekly (branded storefront, QR codes, service-area polygons, PAYG — far beyond Sunday's capture), and oda.do's researched "AcreAI" concept ($39/mo solo AI quoting, "lawn care software" search +171%/12mo) predicts a bundler owns instant-quote SEO within 12–18mo. Spec already exists (`docs/quotes-v1-scope.md`, 3–5d build).
- **🆕 Auto-pay (#3 gap) re-validated as table-stakes** — Jobber's card-on-file auto-charge is now explicit on their pricing page; MowStack ships saved-card auto-pay; SoloOp ships AutoPay free. Roadmap items #3 (auto-pay), #6 (rain-notify), #7 (route-sequencing) **now all exist free somewhere** → pull forward if capacity allows.
- **Pricing stance holds:** Solo $39 pitch stays *"flat everything + no % fee + unlimited customers"* — free options now **6** (Grassly, MowStack, Yardbook, ProBase, LawnPro Solo, SoloOp), so the free-tier wedge story is spent; the flat/no-cut line is the moat.
- **Service Autopilot ammo locked (open item CLOSED):** live-verified $49→$499 ladder + sign-up fee + Elite "Request Pricing" → compare-page line: *"SA charges a sign-up fee and hides Elite behind a sales call — MowGo publishes $39/$79 and takes a card."* Remove from tracker.
- **✅ Stripe verify-session bug — flagged AND fixed within this window.** Health check (09:09Z) found the success page 403s for real users (function requires Bearer JWT + Origin allowlist; client sent bare same-origin GET). Bot fixed + deployed same day (commit `051857c`): Subscribe.jsx now sends Bearer JWT, function allows same-origin. Landing copy "Coming soon: Stripe payments" → **"Stripe payments are live."** (EN+ES). Compare page updated (+SoloOp, +TurfHop columns; free-tier count-6 note; TurfHop 500-error note; "Updated August 2026").
- **IBISWorld number-hygiene resolved:** $176.7B (2026) = IBISWorld *market-size dashboard* (3.0% CAGR); $188.8B = *industry report* (broader scope, 6.5% CAGR). Both real, different products — **name the product when citing**. Rule stands: don't quote $57.77B/$60B/$309.15B variants.
- **Bilingual claim audited & retired:** no "bilingual" claim exists in live copy (intel-only artifact) — do NOT reintroduce. Jobber ships a Spanish app; MowGo's edge is full Spanish parity including admin.
- **⏳ Still open (Aaron):** trial length 7 vs 14 days (revenue-affecting, Day 9) · CF env cleanup (legacy `VITE_STRIPE_PRICE_SOLO`, `VITE_FORCE_DEMO`) · mowflow project deletion (CF guard 8000076 still blocks; domain itself retired Aug 2).

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **🚨 NEW — Invoice reminders cron is BROKEN (regression of a shipped feature).** Failed Aug 2 12:30Z: `Script not found: /opt/data/scripts/invoice_reminders.py`. The script actually lives at `/opt/data/mowgo/server/scripts/invoice_reminders.py` → **cron path mismatch**. Went live Aug 1 as a headline win, broke on its first scheduled run. Fix the cron job path (or symlink) — reminders are a selling point ("reminder cron live" is cited in copy/compare page).
2. **📅 DUE TODAY (Monday) — full plate in `monday_plate_2026-08-03.md`:** Blasian reply first (Day 6 unanswered, draft verbatim) · 4+1 follow-up emails (Emerge/Metro Green/Bigfoot/Simply overdue 4–5 days; **Campbell & Sons due today**) with new angle *"Stripe payments went live — card link on every invoice"* · Jobber "promo just ended" posts (drafts A/B/D — switcher wave open NOW through ~Aug 15) · FB 4+1 buying-intent threads (lawnmowing101 ×4 incl. live LawnPro-eval post 4293446087564500; bluecollarmillionaire 170-customer invoicing) · 6 Reddit posts · directory submissions (Day 19) · 8 new-OK-lead DMs (reverse-lookup DONE: Spray Masters = Spray Masters Turf Mgmt, Owasso; Lawton duo → DM in group) · 3 one-click decisions.
3. **🆕 Reddit `1vcr90y` (r/CRM) — first fresh thread in 11 days, TOP target.** ~8h old at 17:00Z capture: construction worker starting a lawn care side hustle, price-sensitive solo op → MowGo Solo pitch. Draft written (`leads/reddit-threads.md` #30) — **reply within 48h while warm**.
4. **🆕 TurfHop cite for `1rm499y`/`1unfily` if still 500 at 13:00Z** — 5th consecutive check (~32h+, stack trace leaking); reliability ammo now triple-verified for Monday replies.
5. **Compare page additions:** SA signup-fee + opaque-Elite line · QuoteIQ "$299 for quotes + route optimization — MowGo includes both" line (third gate-confirmation this week: Jobber Connect $119, HCP $149, QuoteIQ $299).
6. **Verify Jobber Receptionist discrepancy:** $99 (W31 digest) vs **$29 live on pricing page** — either a 70% AI-price cut or stale intel; relevant to Autopilot positioning.

### 🟡 Medium

7. **Propagate SoloOp intel correction** — earlier capture said "3.5%+$0.50"; live site: card **1.75%+$1.30**, bank 1%+$1.30, **capped $19.95**, added to client invoice. Also: SoloOp is an **Australian** product (ABN/GST/PayTo). Fix intel notes before any copy uses it; compare page is safe (only shows ✅).
8. **Builds queued (roadmap):** quotes v1 (**now #1**, 3–5d scoped) · auto-pay #3 · rain-delay notify #6 · one-tap route sequencing #7 (0.5d each) · photo proof (next) · Booking Link P0 · Autopilot public face (0.5d — AI front-office is table-stakes everywhere).
9. **Reddit manual posting (Day 12):** 29 drafts, 0 posted. Targets: `1vcr90y` (NEW top) · `1i3pv4b` · `1rm499y` · `1v6vwcn` · `1l0y40z` · `1unfily` (NEW — OP demoed 3 tools for a month, multi-op owner) · `1bfw00i` (Jobber complaint ammo).
10. **Service Autopilot tracker cleanup** — $279+signup vs $49-499 discrepancy resolved; close the open item.
11. **Delete mowflow project in CF dashboard** — domain retired Aug 2 (400-byte redirect stub, no Stripe surface); project deletion still blocked by CF guard 8000076.

### 🟢 Low

12. **LawnEstimates watch** — shipping weekly, founder active on r/landscaping (`1pipbj4`); validates quotes v1; potential partnership/landing-page signal.
13. **GreenPal launched in OKC** — aggregator on home turf; use independence angle in OK outreach ("keep your clients off the aggregator").
14. **LawnManage watch-only** — Wix-built, route-opt + equipment + free website, no pricing published.
15. **Blasian** — still no human messages in #🌱mowgo (last "hello" Jul 29 15:39; Day 6).

---

## 🔬 Research Findings

### ⭐ Service Autopilot pricing VERIFIED — open item closed (Run 1)
- Startup **$49 → Pro $199 → Pro Plus $499 → Elite "Request Pricing"**; **sign-up fee on paid tiers** confirmed (live fetch + 3 corroborating sources).
- Pricing page **926 days stale**; Client Portal / Smart Maps / Email Integration are "Call for Pricing"; Two-Way Texting + QuickBooks gate at Pro+. oda.do's "$279" was wrong — the real story (signup fee + opaque Elite) is better ammo.

### ⭐ QuoteIQ pricing captured LIVE for the first time (myquoteiq.com/pricing; quoteiq.io still 403s)
- 5 tiers **$29.99 → $699**; **InstaQuote (self-quoting) + Route Optimization gated at Elite $299/mo**; QuickBooks at Pro $149.99; AI Virtual Call Team on the $29.99 entry tier; Consumer Financing on every tier; 14-day trial.
- **= MowGo's #1 structural gap (quotes v1, 3–5d scoped) priced at $299 by a direct competitor.** Route sequencing (0.5d) sits behind their Elite gate too.

### 🆕 SoloOp (solo-op.com) — new FREE entrant shipping 3 of MowGo's roadmap items
- $0/mo, no tiers: **AutoPay, Rain Mode** (3 reschedule strategies + auto branded client emails), **"Gravity" route clustering**, 3-tap invoicing, offline mode.
- Monetizes via **card fee 1.75%+$1.30 / bank 1%+$1.30, capped $19.95, added to client invoice** (owner pays $0). **Australian** product. Counter for copy: MowGo flat $39 has zero fees anywhere; SoloOp's fee is visible to the client at checkout. (Corrected from 3.5%+$0.50 capture earlier that day.)

### 🆕 LawnPro Solo free tier verified + MowStack moves up-stack
- LawnPro: **$0 forever, 25-customer cap** (scheduling/quotes/invoices/online payments/portal/mobile). Free options now 6.
- MowStack: **"Mowstack Websites" launched** (Starter/Pro/Premium, **$399 setup fee waived with annual Software bundle**); positioning mirrors MowGo's ("one flat price, cancel anytime"); new nuggets: ACH, recurring quotes, read-only API "coming soon"; native iOS/Android apps live. Closest-shaped competitor at $39.99–49.99.

### 📡 TurfHop ops instability — 5th consecutive check (~32h+)
- `/features/` + `/pricing/` both 500, .NET NullReference stack trace leaking on a "Whoops" page, homepage 200. **Reliability ammo now 5× verified** for Monday's `1rm499y` + `1unfily` replies. Orbit AI (ChatGPT/Gemini/Claude choice) confirmed.

### 💸 Cash-flow crisis = strongest ammo yet for the core loop (Aspire 2026 via NALP, 1,000+ pros)
- **76% bill within 4 days — only 39% get paid on time. 60% paid ≥1 week late; 7% paid 2–3 months late.** MowGo's auto-invoice-on-Complete + reminder cron + roadmap auto-pay hit this dead-on. Copy line: *"60% of lawn companies get paid late. MowGo invoices the second the job's done."*

### 🧩 Software sprawl + TAM (verified)
- **62% of firms run 7+ systems (28% run 10+)**; switch triggers: automate workflows 58%, efficiency 51%, feature gaps 44% → "one flat tool replaces the app stack."
- NALP: **692,777 US landscaping businesses (+4.8% vs 2024)**; median firm 355 customers / $14,682 per customer; labor costs +20% by 2029. Mordor: maintenance 91.55% of revenue; **subscriptions = 66.45% of market** → recurring model is the norm.

### 🕵️ QuoteIQ astroturfing confirmed
- r/pressurewashinglife `1s1w53q` (4mo old) is **verbatim QuoteIQ ad copy from a low-karma account** — treat their Reddit presence as planted, not organic. They also shipped an accurate SA-comparison page (their compare math now current, unlike the stale Jobber $39 row). quoteiq.io flipped 403→200 (bot-block flip — watch once).

### 🐦 Reddit (Day 12 of 403-block)
- **FIRST fresh thread in 11 days: r/CRM `1vcr90y`** (~8h old, side-hustle solo op, price-sensitive). Everything else in 11 sweeps = seen/old.
- 5 pre-48h seen-added (108→113), incl. `1s40bzq` r/smallbusiness "scheduling + routes + invoices daily" (~1mo) — **pain-point goldmine for landing copy**, too old for outreach; `1b4dwfx` r/lawn route-planning demand signal (supports geo-sort #7); `1v8kyd4` r/CRMSoftware workflow-automation listicle (spam pattern, not a target).
- ⚠️ Unverified (do NOT cite): r/roboticLawnmowers "US robotics ban incl. robot mowers" claim, 4d old.

### 📊 Other market signals
- **Flat pricing spreading:** ServiceM8 $29 no per-user · Kickserv $60 flat (their own listicle). GreenMargins roundup corroborates QuoteIQ gates ($74.99 satellite / $149.99 job costing) + Jobber +$29/user everywhere.
- **GreenPal launched in OKC** (aggregator on home turf) · **LawnEstimates** shipping weekly (branded storefront, QR codes, service-area polygons, PAYG) · **oda.do "AcreAI"** concept (Jul 5): $39/mo solo AI quoting — price point independently matches MowGo Solo.
- **Jobber:** Receptionist **$99 vs $29 live — verify**; card-on-file auto-charge now explicit on pricing page; Spanish mobile app for team members (erodes "bilingual" claim — already scrubbed).
- **Sunday deep-dive (04:00Z):** weekly digest W31 + **8 new OK leads** (Chris Young, Lawton duo, Spray Masters, Duncan op, TRIMLY TURF, Melgar's, Native Lawn Care, Grand Lake couple) — tracker 9→17; 5 emailed Jul 29–31, **0 replies**.

### 🔌 Stripe infrastructure — this window
| Component | Finding | Status |
|---|---|---|
| verify-session success page | 09:09Z check: 403 for real users (client/function auth mismatch) | ✅ **FIXED + deployed same day** (commit `051857c`) |
| Landing copy | "Coming soon: Stripe payments" | ✅ → "Stripe payments are live." (EN+ES) |
| mowflow.pages.dev | Retired Aug 2 — 400-byte redirect stub, no Stripe surface | ✅ neutralized (project delete pending CF guard) |
| mowgo.pages.dev functions | checkout/verify/portal all JWT + Origin gated, matching repo | ✅ deployed |
| Invoice reminders cron | ❌ **FAILED 12:30Z — script not found** (path mismatch) | 🔴 needs fix (see tasks) |

---

## 📝 Notes / Context

### Channel Activity (last 24h)
- **#🌱mowgo** — 16 new messages, ALL bot-generated: Intel Engine ×6 (Sun deep-dive + digest 04:50 · competitor 08:50 · industry trends 12:54 · pricing 17:00 · feature ideas 21:04 · Mon 01:12) + Stripe health check (09:09, 2 parts) + **invoice-reminders cron FAILURE** (12:30). **No human messages — Blasian silent since Jul 29 15:39 (Day 6).**
- **#🌱mowgo-outreach** — No new activity. Last message Jul 26 14:12 UTC. Dormant 8 days.
- **🤝mowgo-cowork** — Still empty.

### Escalation Timeline (execution gap — net +1 resolved, +1 regressed)
| Blocker | Flagged | Now | Status |
|---|---|---|---|
| Stripe checkout on mowgo | Day 1 (Jul 17) | Day 17 | ✅ LIVE; verify-session success-page bug found **and fixed** Aug 2 |
| mowflow live-key exposure | Day 2 | Day 2 | ✅ **Domain retired Aug 2** (redirect stub); project delete pending CF guard |
| Invoice reminders | — | Day 1 | 🔴 **cron path broken** — failed first scheduled run (script exists at mowgo/server/scripts/) |
| Comparison-site absence | Day 1 (Jul 17) | Day 19-20 ❌ | Directory submissions still the highest-leverage 30 min |
| Reddit replies (29 drafts) | Week 1 | Week 2, 0 posted ❌ | Needs human posting; `1vcr90y` fresh today |
| Cold outreach (17 leads; 5 follow-ups due) | Jul 24 | Day 4-5 ❌ | Emerge/Metro/Bigfoot/Simply overdue; Campbell & Sons due today |
| Online booking link | Jul 23 | Day 11 ❌ | P0, 1-2 days est. |
| Solo pricing debate | Jul 30 | Day 9 | Intel: HOLD $39 + no-% messaging (needs Aaron sign-off) |
| Trial 7 vs 14 days | Aug 2 | Day 1 ❌ | Revenue-affecting; Aaron decides (1-min fix) |

### Key Takeaway
This window belonged to **quotes and pricing truth**: QuoteIQ's pricing was captured live for the first time ($299 gate on self-quoting — MowGo's #1 structural gap, now escalated to top build priority with 3-way market convergence), Service Autopilot's signup-fee/opaque-Elite story was verified and turned into compare-page ammo, and the Stripe success-page bug found by the 09:09Z health check was fixed and deployed the same day. Two regressions/risks to open Monday with: the **invoice-reminders cron broke on its first scheduled run** (script-path mismatch — a shipped selling point is silently dark), and the **verify-session fix should be re-confirmed with a logged-in test checkout** (env var values still never verified at runtime). The Monday plate (`monday_plate_2026-08-03.md`) is packed: Blasian reply (Day 6), 5 follow-up emails, Jobber promo posts while the switcher wave is open, 6 Reddit replies including the first fresh thread in 11 days (`1vcr90y`), directory submissions, and 8 new OK lead DMs — the execution gap remains almost entirely human-side.

---

*Generated by MowGo nightly vault sync — 2026-08-03 02:00 UTC*
