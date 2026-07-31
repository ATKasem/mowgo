# MowGo Nightly Vault Sync — 2026-07-30

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Past 24 hours (Jul 29–30, 2026)
> **Total messages synced:** 73 (50 mowgo — 19 new since last sync + 23 outreach — 0 new + 0 cowork — 0 new)

---

## 📊 Decisions

- **Servinix launch delayed 6 weeks** — Terms of Service confirms pre-launch through Sep 14, 2026, beta opens Aug 17. Not a Jul 31 launch. Their pricing ($320-360/mo for 3-person crew) is 4-5x MowGo's Crew plan. Reduced near-term threat but watch for downward expansion.
- **No price change needed (confirmed)** — MowGo $49/$79 flat-rate pricing remains well-positioned. Jobber's restructured Core at $21/mo looks cheap on sticker but add-on creep makes real cost $129-213/mo — this is MowGo's opening.
- **Counter-narrative needed against KaamCam ($12/mo)** — Their solo-operator positioning ("solo ops don't need route optimization") is the most direct competitive message this week. MowGo needs: cheaper Solo tier, a feature comparison page, or messaging about crew scalability.
- **MowGo features should be branded as "AI-powered"** — 67% of commercial landscapers already use AI for scheduling. Market expects it. Route optimization should lead with AI messaging.
- **"Unlimited users" messaging validated** — Service Fusion just published a comparison using unlimited users as their differentiator. Confirms MowGo's flat-rate model is a real selling point.

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **Submit MowGo to SoftwareWorld NOW** — Website updated Jul 29 (yesterday), lists 44 products in "Small Business" category. MowGo still absent. 10 days since first flagged. Zero submission action. **Highest-leverage action.**
2. **Fix production Stripe env vars on Cloudflare Pages** — Still broken. All 4 secret env vars empty (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_KEY, OPENROUTER_API_KEY). VITE_FORCE_DEMO=true. Checkout returns SPA HTML. No real signups possible. Fix sequence: set 4 env vars → remove VITE_FORCE_DEMO → redeploy with wrangler.
3. **Build online booking link** — KaamCam and DoorstepHQ have it. MowGo roadmap #1 feature. 1-2 days dev. Not started.
4. **Servinix launch delay — adjust monitoring** — Originally expected Jul 31. Now confirmed delayed to beta Aug 17, full launch Sep 14. No pricing check needed this week. Next check: mid-Aug.
5. **Submit MowGo to comparison sites (recurring)** — Still absent from ALL 6+ major lists: SoftwareWorld, Briostack, Guideflow, Tolodora, FieldPickr, Software Advice. Every Google search funnels prospects to competitors.

### 🟡 Medium (new since last sync)

6. **New entrant: Grassly.pro ($9.99/mo)** — Ultra-low-cost "lawn care CRM for small businesses." JS-heavy site needs browser for full audit. The price floor signals race-to-the-bottom on the low end. Add to competitor tracking.
7. **KaamCam counter-narrative needed** — Published "Best Lawn Care Software for Solo Operators (2026)" explicitly arguing solo ops don't need route optimization/dispatch/crew features. Direct attack on MowGo Solo ($49 = 4x KaamCam). Prepare growth scalability messaging.
8. **SoloOp ($0/mo) — confirmed real, most significant threat** — Fully built app at solo-op.com with smart scheduling, invoicing, Rain Mode, offline mode. $0/mo, revenue via transaction fees (1.75%+$1.30). Targets same 1-3 person crew ICP. Most significant pricing threat yet.
9. **Jobber restructured pricing — new messaging angle** — Core $21/mo (annual) looks cheap, but add 2nd user = +$29/mo, Marketing = +$79, AI Receptionist = +$99. API locked behind $280-371/mo Plus. MowGo at $49 flat is 3-9x cheaper on real cost. Outreach angle ready.
10. **Reddit replies stale — need API posting** — All 3 high-priority threads (r/Entrepreneur dad-daughter, r/landscaping ICP thread, r/sweatystartup Jobber complaint) are now 3+ days old. Past prime engagement. Reddit API auto-posting is the only path forward for timely engagement.
11. **Cold outreach: 22 leads, zero contacted** — Still untouched. Recommended pick for today: Aaron's Lawn Maintenance, Mowzilla, or Walter's Lawn Service.
12. **Fix Supabase keep-alive script path** — Still failing daily: `/opt/data/scripts/.hermes/scripts/supabase_keepalive.sh` not found.

### 🟢 Low

13. **First human message from Blasian since Jul 23** — "hello" at 15:39 UTC. Possible signal of engagement. Monitor for follow-up.
14. **Clean up dead domain references** — `cleanflloww.pages.dev` and `cleanmowgo.pages.dev` both dead. Still in ALLOWED_ORIGINS arrays.

---

## 🔬 Research Findings

### 🆕 New Competitor: Grassly.pro ($9.99/mo)
- "Lawn care CRM for small businesses" with scheduling, invoicing, and route optimization
- Starting at **$9.99/month** — even cheaper than KaamCam ($12)
- JS-heavy site, needs browser for full audit
- Signals race-to-the-bottom on low-end pricing

### 🆕 SoloOp Confirmed — FREE FOREVER
- **solo-op.com** — fully built app, NOT vaporware
- Features: Smart scheduling (geo-clustering & ETA engine), invoicing + AutoPay (Stripe Connect), Rain Mode, Offline Mode ("Bush Mode") with offline mutation queue
- **$0/mo subscription** — revenue via transaction fees (1.75%+$1.30, capped $19.95)
- "Built from the field. Not the boardroom." — directly targets same 1-3 person crew ICP
- Android available, iOS sign-up live
- **Most significant pricing threat yet**

### 🆕 KaamCam Solo Push Escalates
- New blog post: "Best Lawn Care Software for Solo Operators (2026)"
- Explicitly argues solo operators don't need route optimization, dispatch, or crew features
- Pitches $12/seat as "price of one mow"
- **Direct attack: MowGo Solo ($49/mo) = 4x KaamCam**

### 🆕 Servinix Launch Details (Delayed)
- Originally expected Jul 31 — NOW: Terms of Service confirms **pre-launch through Sep 14, 2026**, beta opens Aug 17
- Full site live: AI dispatch, GPS, route optimization, QB sync, lead engine
- Pricing: AI Service Assistant $300/mo flat, FSM $20/tech/mo, GPS Fleet $20/vehicle/mo
- For 3-person crew: **$320-360/mo** vs MowGo's **$79 Crew plan** (4-5x higher)
- Targeting mid-market field service, not MowGo's micro-ICP
- Watch for downward expansion if they gain traction

### 🆕 Jobber Pricing Restructured (May–Jul 2026)
| Plan | Annual Entry | Real Cost |
|------|:-----------:|:----------|
| Core (1 user) | $21/mo | Add 2nd user → +$29/mo. Add Marketing → +$79. Reach $129-213/mo |
| Connect/Grow | $70-280/mo | $29/user overage on ALL plans. API locked behind $280-371/mo Plus |
| Add-on stack | $79+$29+$49 | Marketing Suite + AI Receptionist = costs more than base plan |
- **New outreach angle:** "Jobber's $21 Core looks cheap until you add a second crew member ($29), AI scheduling ($29), or marketing ($79). Suddenly it's $213/mo. MowGo: $49/mo. Everything included."

### Market Intelligence
- **FSM Market: $2.89B in 2026**, growing 10.5% CAGR, projected $7.09B by 2035
- **67% of commercial landscapers use AI for scheduling** (GitNux Feb 2026, 100+ datasets)
- AI route optimization boosts labor productivity **28%**, cuts fuel **18%**
- **3x ROI** within first year for 70% of AI-tool users
- **75% of AI-using landscapers** report higher client satisfaction
- AI in landscaping projected to hit $2B by 2035

### Feature Gap Analysis (vs 5 major 2026 comparison guides)
| Priority | Feature | MowGo Status |
|----------|---------|--------------|
| 1 | Route optimization | ❌ MISSING — cited as #1 by ALL guides |
| 2 | Online booking link | ❌ MISSING — roadmap HIGH PRIORITY |
| 3 | Customer self-service portal | ❌ MISSING |
| 4 | Crew mobile dispatch app | ❌ MISSING |
| 5 | SMS/customer communication | ❌ MISSING |
| 6 | QuickBooks integration | ❌ MISSING — #1 request across all guides & Reddit |

### Competitor Moves
- **Service Fusion** (Jul 28) — Published Jobber vs Housecall Pro comparison positioning on **unlimited users**. MowGo's exact differentiator. Both threat (losing the message) and validation (flat-rate model is real).
- **QuoteIQ** — Expanding beyond lawn care into cleaning/maid service. Less direct focus on lawn care = slight positive. Shipped July update with AI AutoMeasure, Ask AI Reports, Expenses Analytics.
- **Briostack** — Gaining visibility, appearing on Software Advice "Best Field Service Mobile Apps" lists.
- **Fieldbookly** (fieldbookly.com) — Free online booking for lawn care. Another free entrant.

### Comparison Site Status (checked Jul 29)
| Site | Updated | Products Listed | MowGo? |
|------|---------|----------------:|:------:|
| **SoftwareWorld** — AI Lawn Care | Jul 29, 2026 | 4 (Joblogic, GorillaDesk, Kickserv, ServiceTitan) | ❌ |
| **SoftwareWorld** — Small Business | Jul 29, 2026 | 44 products | ❌ |
| **Software Advice** — Field Service Mobile | Jul 28, 2026 | Briostack + others | ❌ |
| **Workyard** — 6 Best Lawn Care Scheduling | May 2026 | Workyard + 5 others | ❌ |
| **Tolodora** — Best Software 2026 | Jul 27, 2026 | 6 (Jobber, Yardbook, SA, LawnStarter, RealGreen, Aspire) | ❌ |

### Reddit Signal
- 🆕 **r/smallbusinessowner** — "Advertising for landscaping company" — fresh thread, not yet engaged
- Existing threads now 3+ days stale: r/Entrepreneur dad-daughter `1i3pv4b`, r/landscaping "1-3 person crews", r/sweatystartup Jobber complaint
- 19 total threads tracked across target subreddits
- Reddit still blocks all automated extraction (403)

---

## 📝 Notes / Context

### Channel Activity (last 24h)
- **#🌱mowgo** — 19 new messages: 4 Intel Engine runs (02:21, 06:25, 10:29, 14:34, 18:37, 22:39 UTC — 6 runs today due to lane cycling), 1 Stripe health check (09:08), 1 Supabase keep-alive failure (06:00), 1 human post from Blasian (15:39 UTC — first since Jul 23).
- **#🌱mowgo-outreach** — No new activity. Last message Jul 26 14:12 UTC.
- **🤝mowgo-cowork** — Still empty.

### Blasian Sighting
"hello" at Jul 29, 15:39 UTC — first human post since Jul 23. No follow-up yet. Possible re-engagement signal.

### Infrastructure Health (updated)
| Component | Status | Change |
|-----------|--------|--------|
| Stripe checkout (mowflow.pages.dev) | ❌ NON-FUNCTIONAL | 🔴 Unchanged — secrets empty, functions not deployed |
| mowflow.pages.dev (deployed, commit c40f68c) | ✅ Healthy | — |
| cleanmowgo.pages.dev | ❌ Dead domain | 🆕 NEW — DNS doesn't resolve |
| cleanflloww.pages.dev | ❌ Dead domain | Unchanged |
| CF API token | ❌ Expired/revoked | Unchanged |
| Supabase keep-alive | ❌ Script missing | Unchanged |
| VITE_FORCE_DEMO | ❌ Still true in production | 🔴 Unchanged |
| VITE_STRIPE_PRICE_SOLO | ❌ Points to deactivated $49 price | 🔴 Unchanged |

### Intel Engine Run Cadence
Engine ran 6 times today (every ~4h). Lanes cycled: Competitor Monitoring (×2), Industry Trends, Pricing Intelligence, Feature Ideas (×2). Report shows intensive monitoring but limited action execution on findings.

### Price IDs (unchanged)
| Plan | Price ID | Status |
|------|----------|--------|
| Solo $39 | `price_1TwmrGGwXKVLlr2I2aLpMVHN` | ✅ Current (Jul 2026) |
| Solo $49 (legacy) | `price_1TwFiDGwXKVLlr2IIyi3NmBi` | 🔴 Legacy — deactivated |
| Crew $79 | `price_1TwFiUGwXKVLlr2InMLdsc6T` | ✅ Current |
| Trial | 14 days | ✅ In checkout |

### Key Takeaway
The Intel Engine is producing high-quality intelligence but the gap between **intel produced** and **actions taken** is widening. Critical items (comparison site submissions, Stripe fix, Reddit replies) flagged for 10+ days remain untouched. The most impactful action is **submitting MowGo to SoftwareWorld** — their Jul 29 update added 44 products without MowGo.

---

*Generated by MowGo nightly vault sync — 2026-07-30 02:00 UTC*
