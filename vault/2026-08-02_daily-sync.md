# MowGo Nightly Vault Sync — 2026-08-02

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Past 24 hours (Aug 1, 02:00 – Aug 2, 02:00 UTC)
> **Total messages synced:** 123 (100 mowgo — 14 new + 23 outreach — 0 new + 0 cowork — 0 new)

---

## 📊 Decisions

- **🚨 STRIPE DAY 16 → RESOLVED — production checkout is LIVE on mowgo.pages.dev.** Root cause of the 16-day outage: all 13 env vars + 4 secrets were ALREADY SET on the CF project (set between the 09:07Z health check and the 13:25Z run — likely Aaron in the dashboard), but the deployment was **3 days old with no functions bundle** (`functions_enabled: None`, checkout → 405). Fix: fresh client build + bundled `functions/` + wrangler redeploy (deployments a4364570 + 15163128). All 5 functions verified live: checkout 401-auth-gated (config probe PASSED — secrets present at runtime), create-portal-session, verify-session, webhook fail-closed, autopilot 200. **Signups/payments now possible — revenue unblocked.**
- **mowflow.pages.dev NEUTRALIZED — live-key exposure GONE.** 25 deployments deleted via CF API; inert redirect placeholder deployed (meta-refresh → mowgo); checkout POST → 405, no sessions. Project deletion still blocked by CF guard error 8000076 → Aaron dashboard task (or bot retry).
- **Pricing recommendation carries: HOLD $39 flat + "no % of revenue" messaging.** Run 6 re-verified zero competitor price moves this window; Grassly Free's 2%-of-payments fee and QuoteIQ's bait pricing keep MowGo's flat story the strongest it's been. Still needs Aaron's sign-off (Day 8 of debate).
- **⚠️ NEW DECISION NEEDED — trial length 7 vs 14 days.** Checkout currently grants 7 days (`VITE_STRIPE_TRIAL_DAYS=7` on CF) but marketing promises a "14-day trial." Revenue-affecting → Aaron decides (fix = set `STRIPE_TRIAL_DAYS=14`, 1 min, or update copy).
- **Feature priority locked (Run 3):** land the three 0.5-day wins (invoice reminders ✅ already shipped, rain-delay notify, one-tap route sequencing) now; scope Quotes v1 (done — 3-5d build); photo proof next; Booking Link stays P0. HCP's AI push → Autopilot public face still the right move; **don't claim AI estimates** (roadmap claim re-verified clean Jul 31).

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **📅 DUE TODAY (Sunday): Weekly digest W31 + lead discovery deep-dive** — flagged by Run 6 ("Sunday: weekly digest W31 + lead discovery due tomorrow"); today's intel is queued as input.
2. **Jobber "promo just ended" posts — promo window closes ~Aug 3** — drafts A/B/D ready (`marketing/jobber-promo-expiration-2026-07-29.md`); promo verified dead Aug 1 07:39Z. Post Mon Aug 3 (bot window) or manually before window closes.
3. **4 follow-up emails still due (Day 3-4): Emerge Lawns + Metro Green + Bigfoot + Simply** — sent Jul 29-31, 0 replies. Draft ready for Emerge (`marketing/emerge-lawns-followup-2026-07-30.md`). Warm leads cool fast.
4. **Reply to Blasian in #🌱mowgo-leads (Day 4 unanswered)** — draft at `leads/blasian-reply-draft-2026-08-01.md`; bot can send verbatim on Aaron's word (1 min) — restarts the human loop.
5. **🆕 lawnmowing101 FB group reply** — "Jobber or quoteiq? For the most basic plan." (buying-intent question) → Aaron manual engagement.

### 🟡 Medium

6. **SoftwareWorld / comparison-site submission (Day 16-18)** — live check: 44 products in lawn-care category, updated Aug 1, **MowGo absent**; NO self-serve form exists → vendor contact channel ("Connect with your next Client") 10-15 min, or self-serve: Capterra, G2, Software Advice, GetApp signups (links in `daily_actions.json`).
7. **Quotes v1 — SCOPED (3-5d build, biggest structural gap)** → `docs/quotes-v1-scope.md` (table, 5 CF endpoints, client routes, edge cases, test plan).
8. **Competitor import — SCOPED (P0, ~1d)** → `docs/competitor-import-spec.md` (CSV mapping, preview/confirm endpoints, guardrails, GTM) — Jobber switcher wave + QuoteIQ free-tier refugees are the two open churn pools.
9. **Builds queued:** rain-delay notify + one-tap route sequencing (0.5d each) · photo proof (next) · Booking Link P0 (Day 10) · Autopilot public face (landing chat widget + booking flow).
10. **CF dashboard cleanup (~5 min, all inert):** delete legacy `VITE_STRIPE_PRICE_SOLO` ($49), remove `VITE_FORCE_DEMO=true`, add `STRIPE_PRICE_CREW` for symmetry — prevents config drift if CF CI builds are enabled.
11. **Reddit manual posting (Day 9)** — 28 drafts, 0 posted; bot 403-blocked (Day 9). Targets: r/Entrepreneur `1i3pv4b`, r/landscaping `1rm499y` (review Mon), r/CRM `1v6vwcn`, r/LawnCareBusinessCRM `1l0y40z`.
12. **Delete mowflow project in CF dashboard** — domain already inert; API guard 8000076 blocks bot deletion (Workers & Pages → mowflow → Delete).

### 🟢 Low

13. **Watch MowStack FREE tier + Websites line** — closest twin now has a $0 entry; Pro $39.99 annual includes weather-aware rescheduling (rain-delay parity), CSV import, portal.
14. **Servinix** — pricing live: $300/mo AI assistant, $20/tech FSM, $15/vehicle GPS → targets Podium/Samsara/ServiceTitan stacks ($1-1.5K/mo), **not** the $39-79 segment. Beta Aug 17, commercial Sept 14.
15. **Blasian** — still no human messages in #🌱mowgo (last: "hello" Jul 29 15:39; ~3.5 days).

---

## 🔬 Research Findings

### 🆕 MowStack launched a FREE tier + Websites line (Run 2, live-verified)
- Free $0: 1 user, no route opt/weather/portal. **Pro $39.99/mo annual: unlimited users, route opt, weather-aware rescheduling (rain-delay parity), portal, CSV import.**
- Surviving MowGo edges: bilingual EN/ES, auto-invoice, PWA/offline, month-to-month. Threat stays HIGH at the $49 tier; free-tier wedge now exists below too.

### 🆕 Servinix pricing live — confirmed OUT of MowGo's segment
- $300/mo AI assistant + $20/tech + $15/vehicle GPS — aimed at replacing $1,000-1,500/mo Podium/Samsara/ServiceTitan stacks. Not a $39-79 competitor; watch Sept 14 launch.

### 🆕 Grassly Free tier confirmed loaded (Run 6, compare-table live)
- $0 + **2% of every payment**: route opt, GPS tracking, job photos, chemical tracking, QuickBooks sync, portal, booking, referral, bilingual, PWA — capped 100 customers / 1 user. MowGo's wedge: **"flat price, no cut of your revenue"** (keep the 2% line Grassly-specific).

### 🆕 Service Autopilot data point (3rd-party only)
- "$49/month + sign-up fee" via QuoteIQ listicle — unverified directly; add to price matrix as sourced-3rd-party, verify before quoting.

### 🆕 MowStack ROI calculator (Run 6)
- "173 hrs saved/yr · $8,667 · **18.1x return**" — value-framing escalation. Do NOT copy the made-up multiplier math; "~4 min admin/customer/week" is a legitimate user-pain hook.

### 🆕 QuoteIQ SEO machine — now self-disclosing
- New listicles (Top 8 Lawn Care 2026, Top 10 Estimating, Top 10 Invoicing, Best Self-Quoting) rank #1-ish with explicit **"We're QuoteIQ"** disclosure. They re-cite MowGo-verified numbers (Jobber $39 Core etc.) — third-party confirmation ammo. Page still IP-blocked; route opt gated at Elite $299.

### 🆕 r/LawnCareBusinessCRM found (Run 4)
- Low-competition, software-rec niche sub — new engagement channel candidate.

### 🆕 WorkView.io — false competitor avoided (Run 5)
- Promo thread `1ijfxi0` checked: product acquired, company pivoted to dev tools → dead end, **not watchlisted**.

### Jobber pain ammo (Runs 5-6)
- `1bfw00i` r/sweatystartup "Not happy with Jobber. Beware." (billing/contract gripes) · `1jf2gs7` can't bulk-reassign recurring jobs · `1rairx5` r/smallbusiness spreadsheet-based 3-person op (exact ICP, best engagement candidate) · `1n3o8iw` Service Autopilot $399/mo user shopping around (churn pool).

### 📊 Industry data (Runs 1 & 5)
- **Small crews are the fastest AI adopters**: JPMorgan Chase Institute — small-biz AI adoption 17.7% by end-2025; ≤$250K segment leads at 27.6%; median new-adopter spend **$20-30/mo** — MowGo's Autopilot-included-at-$39 sits exactly on this tier (Jobber charges $99 add-on). Copy: **"AI included, no add-on fees."**
- Buyers: 61% cost-effectiveness, 54% ease of deployment within 30 days; FSM market $6.14B → $13.79B by 2034 (10.7% CAGR). "No demo call, no onboarding, $39 flat" = the market's own checklist.
- HomeGuide 2026 ammo: lead response <1hr closes 40-55% vs 15-25% next-day · drive time 25-35% of crew hours · upsell attach 15-25% avg / 45-65% top quartile · cancellations 18-30% without automated reminders + photo proofs vs 6-12% with — all four map to shipped MowGo features.
- AI adoption (Run 5): 67% of commercial landscapers use AI for scheduling; smallest firms (<10 emp) fastest-growing AI buyers; 83% of pros haven't adopted → headroom story.
- ⚠️ **Number-hygiene flag**: IBISWorld live page says **$176.7B (2026) / $195B by 2031** — the widely-cited $188.8B doesn't match. Verify market-size figures before using in copy.
- New watchlist entrant: **OptimizeIt.ai** ($239-299/mo, AI satellite measurement + AI voice intake).

### 🔌 Stripe infrastructure — RESOLVED this window
| Component | Before (09:07Z check) | After (13:25Z run) |
|---|---|---|
| mowgo.pages.dev checkout | ❌ 405 — stale 3-day-old static deploy, `functions_enabled: None` | ✅ **LIVE** — 5 functions verified (checkout 401-auth-gated, portal, verify, webhook fail-closed, autopilot 200) |
| Env vars / secrets | reported unset | ✅ all 13 + 4 secrets present at runtime |
| Autopilot key | — | ✅ `OPENROUTER_API_KEY` re-bound (was empty at runtime → 503), real OpenRouter responses |
| mowflow.pages.dev | ⚠️ LIVE `cs_live_` sessions under old brand | ✅ inert redirect placeholder, checkout dead, 25 deployments deleted (project delete pending CF guard) |
| Invoice reminders | idea | ✅ **LIVE** — `server/scripts/invoice_reminders.py` + cron daily 12:30Z (next run Aug 2 12:30Z) |

---

## 📝 Notes / Context

### Channel Activity (last 24h)
- **#🌱mowgo** — 14 new messages, ALL bot-generated: 6 Intel Engine runs (03:35, 07:39, 11:43, 15:47, 19:51, 23:55 UTC — full 4-lane cycle completed + pricing 2nd pass) + 1 Stripe health check (09:07, 2 parts). **No human messages — Blasian silent since "hello" Jul 29 15:39.** Separate #🌱mowgo-leads thread still unanswered (Day 4, draft ready).
- **#🌱mowgo-outreach** — No new activity. Last message Jul 26 14:12 UTC. Dormant 7 days.
- **🤝mowgo-cowork** — Still empty.

### Reddit Status
- Day 8-9 of 403-block (www/old/api re-verified; web_search + hound sweeps). 0 verified new 48h threads all day; 5 pre-48h threads seen-added (incl. `1bfw00i` Jobber complaint — ammo). 28 drafts, **0 posted** (Week 2). Dead channel without API access or human posting.

### Escalation Timeline (execution gap — two major wins this window)
| Blocker | Flagged | Now | Status |
|---|---|---|---|
| Production Stripe on mowgo | Day 1 (Jul 17) | Day 16 | ✅ **RESOLVED Aug 1** — functions deployed, checkout live |
| mowflow live-key exposure | Day 2 | Day 2 | ✅ **NEUTRALIZED** — redirect placeholder, checkout dead; project delete pending (CF guard) |
| SoftwareWorld / comparison sites | Day 1 (Jul 17) | Day 16-18 ❌ | Path researched: vendor channel or Capterra/G2/SoftwareAdvice/GetApp (10-15 min) |
| Reddit replies (28 drafts) | Week 1 | Week 2, 0 posted ❌ | Needs human posting |
| Cold outreach (22 leads; 4 follow-ups due) | Jul 24 | Day 3-4 ❌ | 4 emails due today |
| Online booking link | Jul 23 | Day 10 ❌ | P0, 1-2 days est. |
| Solo pricing debate | Jul 30 | Day 8 | Intel: HOLD $39 + no-% messaging (needs Aaron sign-off) |

### Key Takeaway
The window's headline: **the two longest-standing infrastructure blockers both fell on Saturday.** Stripe production checkout went LIVE (root cause was a stale 3-day-old deploy missing its functions bundle — the env vars had been set all along), and the old domain's live-key exposure was neutralized. Revenue is now unblocked, and the pipeline has shifted from infra to growth: invoice reminders went from idea to live cron in one day, Quotes v1 and competitor import are scoped specs ready to build, and the **Jobber promo window (closes ~Aug 3) is the immediate GTM priority** — the switcher wave is open and the CSV-import play is the hook. The remaining execution gap is almost entirely human-side: 4 follow-up emails, the Blasian reply (1 min, draft ready), Jobber promo posts, SoftwareWorld submission, Reddit manual posts — plus the **W31 weekly digest + lead discovery due TODAY (Sunday)**.

---

*Generated by MowGo nightly vault sync — 2026-08-02 02:00 UTC*
