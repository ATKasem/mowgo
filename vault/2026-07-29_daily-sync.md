# MowGo Nightly Vault Sync — 2026-07-29

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Past 24 hours (Jul 28–29, 2026)
> **Total messages synced:** 73 (50 mowgo — 13 new since last sync + 23 outreach — 0 new + 0 cowork)

---

## 📊 Decisions

- **No price change needed for MowGo Solo ($39/$79)** — Intel Engine analysis confirms $49/$79 is well-positioned in the middle band. Annual discount plan ($490/$790) should be ready. Don't race to the bottom against QuoteIQ ($29.99) or free competitors.
- **Marketing message shift:** Lead with "Unlimited crew members. One flat price. No surprise add-ons." — directly addresses the #1 industry complaint against Jobber.
- **Price ID correction needed:** `VITE_STRIPE_PRICE_SOLO` on client side still points to deactivated `price_1TwFiDGwXKVLlr2IIyi3NmBi` ($49 legacy). Server has the correct `price_1TwmrGGwXKVLlr2I2aLpMVHN` ($39). Must sync.

---

## 🎯 Action Items / Tasks

### 🔴 Critical (new since last sync)

1. **Fix Stripe production env vars IMMEDIATELY** — All 4 secret env vars on Cloudflare Pages are empty (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_KEY, OPENROUTER_API_KEY). Checkout, webhooks, auth, and AI Autopilot are completely non-functional in production.
2. **Deploy Pages Functions** — `functions/` directory exists in the repo but CF Pages isn't detecting/activating them. Project has no build command configured. Checkout endpoints return 405/SPA HTML instead of JSON.
3. **Disable VITE_FORCE_DEMO** — Still set to `true` on production site. Demo mode bypasses real auth, so checkout returns 401 Unauthorized to demo users. Toggle to `false` to enable real auth.
4. **Submit MowGo to comparison sites NOW** — Still absent from ALL 6+ major comparison lists (Briostack, Guideflow, SoftwareWorld, Tolodora, FieldPickr, LawnStarter). Every Google search for "best lawn care software 2026" leads to competitors. Highest-leverage action.
5. **Prepare for Jul 31 (TWO days):** Jobber promo expiration + Servinix launch. Need post-promo messaging ("Jobber promo expired? MowGo starts at $39") and Servinix monitoring ready.
6. **Regenerate CF_API_TOKEN** — Still invalid since Jul 26. Blocks automated env var verification.

### 🟡 Medium (new since last sync)

7. **SoloOp ($0/mo) is new FREE FOREVER competitor** — Full-featured field service app at $0. Route-optimized scheduling, invoicing, payments, offline mode. Most significant pricing threat. Add to permanent competitor tracking.
8. **CrewNest ($29/mo Pro)** — Satellite property measurement, free tier. Missing MowGo from their comparison article. Monitor.
9. **QuoteIQ AI AutoMeasure** — Shipped satellite property measurement inside estimates. MowGo roadmap should address property measurement if competitors are winning on it.
10. **Reddit replies still pending** — Threads identified yesterday still untouched: r/Entrepreneur `1i3pv4b` (daughter+dad), r/landscaping "1-3 person crews", r/sweatystartup week-one starter, r/sweatystartup Jobber complaint.
11. **Cold outreach: 22 leads, zero contacted** — Pick ONE daily: Aaron's Lawn Maintenance, Mowzilla, Walter's Lawn Service all suggested.
12. **Check servinix.com pricing on Jul 31** — Their rain delay auto-reschedule is closest feature match to MowGo.

### 🟢 Low

13. **Fix Supabase keep-alive script path** — Still failing since Jul 23: `/opt/data/scripts/supabase_keepalive.sh` not found (script path resolution changed).
14. **Remove cleanflloww.pages.dev from ALLOWED_ORIGINS** — Domain has been dead since Jul 2026, still referenced in Pages Functions.

---

## 🔬 Research Findings

### Pricing Intelligence — July 2026 Landscape

| Tier | Competitors | MowGo Position |
|------|------------|----------------|
| **$0/mo** | SoloOp, LawnBoss, Yardbook (free), CrewNest (free tier) | ⚠️ Squeezed from below |
| **~$12-29/mo** | KaamCam ($12), CrewNest Pro ($29), QuoteIQ ($29.99) | ⚠️ MowGo Solo ($39) above this band |
| **$39-49/mo** | Jobber Core ($39), **MowGo Solo ($39)**, GorillaDesk Basic ($45), Service Autopilot ($49) | ✅ Competitive |
| **$59-79/mo** | Housecall Pro ($59), **MowGo Crew ($79)**, GorillaDesk Pro ($137) | ✅ At market |
| **$199+/mo** | RealGreen, ServiceTitan, Aspire, LMN | ✅ Not in target |

### CRITICAL New Threats

- **SoloOp ($0/mo — FREE FOREVER):** Route-optimized scheduling ("Gravity engine"), recurring jobs + Rain Mode, invoicing/payments (card/ACH), AutoPay, offline mode, crew support, client portal + accountant portal. Most significant pricing threat to MowGo. Undercuts by $39/mo targeting the same market.
- **QuoteIQ ($29.99/mo):** Published self-ranked "Top 8" article ranking themselves #1. AI AutoMeasure (satellite property measurement), Ask AI Reports, Expenses Analytics. Massive YouTube influencer reach (Mike Vidan 580K + Justin Rogers 743K). Their 4-tier complexity ($29.99→$149.99→$299→$699) is MowGo's opening.
- **ProBase (free — LawnStarter):** Free tool with rev share on leads. Captures price-sensitive solo operators. If it gains traction, MowGo needs to differentiate on depth, not price.

### Competitor Developments

- **Jobber:** Real solo cost ~$179/mo with add-ons (Core $29 + AI Receptionist $99 + Marketing $79). Route optimization locked behind $349/mo Grow plan. MowGo's flat pricing vs Jobber's add-on creep is the #1 comparison message.
- **Servinix (launching Jul 31):** AI assistant (Maya), lead engine, route optimization, GPS tracking. Not lawn-specific — no rain delay auto-reschedule. Needs pricing check.
- **CrewNest ($29/mo Pro):** 3 team members included, satellite property measurement, free tier available.
- **LawnBoss:** Remains quiet. Free, 92 tools, AI pricing from satellite imagery, route trading.

### Market Intelligence

- **Software adoption DOUBLING:** 20% → 44% YoY planned software investment (FieldRoutes 2026 survey). 62% expect revenue growth. Massive TAM expansion in progress.
- **AI is table stakes:** 40% name AI as #1 priority tech. MowGo's route optimization should be labeled/positioned as AI-powered.
- **The "30-60 Client Threshold":** Software becomes essential between 30-60 recurring clients or when adding a second crew member. Exactly validates MowGo's 1-3 person target.

### Critical Infrastructure Findings

- **Stripe integration: NON-FUNCTIONAL in production** — All 4 secret env vars empty, Pages Functions not deployed, demo mode active. The code is correct locally but the CF Pages deployment is broken.
- **Supabase keep-alive:** Still failing daily (script not found). No effect on actual Supabase connection but indicates dead config.
- **CF API token:** Invalid/expired since Jul 26 — cannot verify env vars via API.

### Reddit Signal (new)

- 🆕 **r/landscaping** — "What do you actually use to schedule + invoice for 1-3 person crews?" — *exact MowGo ICP* (found 22:16 UTC)
- 🆕 **r/landscaping** — "Is Jobber worth it for small teams?" — *direct competitor pain point*
- 🆕 **r/CRM** — "Best CRM for lawn care business in 2026?"
- **r/sweatystartup** — "Starting Lawn Care — Week One" — week-one starter documenting progress, perfect for soft engagement
- **r/sweatystartup** — "Year 2 of Landscaping Business — Revenue, Owners Pay" — financials sharing thread
- **r/Entrepreneur** `1i3pv4b` — Daughter helping dad digitize landscaping (still #1 engagement opportunity)

---

## 📝 Notes / Context

### Channel Activity (last 24h)
- **#🌱mowgo** — 13 new messages: 4 Intel Engine runs (05:51, 09:56, 14:12, 22:16 UTC), 1 Stripe health check (09:13), 1 Supabase keep-alive (06:00). No human posts from Blasian since Jul 23.
- **#🌱mowgo-outreach** — No new activity. Last message Jul 26 14:12 UTC.
- **🤝mowgo-cowork** — Still empty.

### Infrastructure Health (updated)
| Component | Status | Change |
|-----------|--------|--------|
| Stripe checkout (mowflow.pages.dev) | ❌ NON-FUNCTIONAL | 🔴 NEW — secrets empty, functions not deployed |
| mowflow.pages.dev (deployed) | ✅ Healthy, commit c40f68c | — |
| cleanflloww.pages.dev | ❌ Dead domain | Unchanged |
| CF API token | ❌ Expired/revoked | Unchanged |
| Supabase keep-alive | ❌ Script missing | Unchanged |
| VITE_FORCE_DEMO | ❌ Still true in production | 🔴 NEW — blocks auth for checkout |
| VITE_STRIPE_PRICE_SOLO | ❌ Points to deactivated $49 price | 🔴 NEW — client/server mismatch |

### Reddit Extraction Status
Reddit continues to block automated extraction (403 on all endpoints). Playwright browser unavailable in cron environment. Thread dates estimated from Reddit post-ID prefixes.

### Intel Engine Run Cadence
Engine ran 4 times today (approx every 4h): Lanes covered — Competitor Monitoring, Industry Trends, Pricing Intelligence (×2), Outreach Actions. Next digest due Sunday Aug 3 (Week 31).

---

*Generated by MowGo nightly vault sync — 2026-07-29 02:00 UTC*
