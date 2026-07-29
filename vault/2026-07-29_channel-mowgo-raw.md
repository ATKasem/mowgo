# 🌱 mowgo — Raw Channel Dump
**2026-07-29 02:00 UTC | 50 messages (13 new since last sync)**

## Most Recent Activity (Top messages)

### Jul 28, 22:16 — Intel Engine — Pricing Intelligence (2/2)
**HeremesV2** — 3 Key Takeaways:
1. Flat-rate pricing is competitive moat — lead with "unlimited crew, one flat price"
2. ProBase (free) is the sleeper threat — captures price-sensitive solo ops
3. QuoteIQ is the new Reddit darling — multiple 2026 articles crown it "best value"
Recommended: No price change needed ($49/$79). Marketing: "Unlimited crew members. One flat price. No surprise add-ons."
Engagement target: r/landscaping "1-3 person crews" thread

### Jul 28, 22:16 — Intel Engine — Pricing Intelligence (1/2)
**HeremesV2** — Pricing Landscape (July 2026): Full table with QuoteIQ ($29.99), Jobber ($29*), Housecall Pro ($59*), GorillaDesk ($45*), ProBase (FREE — biggest threat), LawnPro, Yardbook, Service Autopilot, Briostack
MowGo positioning: $49/$79 flat-rate — well-positioned but facing pressure

### Jul 28, 14:12 — Intel Engine — Outreach + Actions (3/3)
**HeremesV2** — Looking ahead: Jul 31 Jobber promo expires — prime window. Servinix launch Jul 31. Next run: Feature Ideas lane. Weekly digest due Sunday Aug 3.

### Jul 28, 14:12 — Intel Engine — Daily Outreach (2/3)
**HeremesV2** — Daily actions for Tue Jul 28:
1. Reply to r/sweatystartup thread `1jq5iuu` ("Starting Lawn Care — Week One")
2. Repost/engage r/Entrepreneur `1i3pv4b` (daughter + dad landscaping software)
3. Act on SoloOp threat — SoloOp is $0/mo with route optimization
4. New leads for cold outreach — 0 contacted from 22 in tracker
5. Comparison site submissions — still zero submissions done

### Jul 28, 14:12 — Intel Engine — Pricing + Competitors (1/3)
**HeremesV2** — CRITICAL: SoloOp — FREE FOREVER competitor just launched (route-optimized scheduling, invoicing, payments, offline mode, crew support). Most significant pricing threat.
CrewNest ($29/mo Pro, free tier) — satellite property measurement
QuoteIQ doubling down at $29.99/mo — self-ranked "Top 8" article ranking themselves #1
MowGo still absent from ALL comparison sites (Briostack, Guideflow, FieldPickr, QuoteIQ, CrewNest, SoftwareWorld)

### Jul 28, 09:56 — Intel Engine — Competitor Monitoring (2/2)
**HeremesV2** — Action items: Outreach window opens at 12:00 UTC. Reply to r/Entrepreneur dad+daughter thread. Prep "Jobber promo ending (Jul 31)" messaging. Submit MowGo to Tolodora + Briostack + SoftwareWorld. Check servinix.com pricing on Jul 31.

### Jul 28, 09:56 — Intel Engine — Competitor Monitoring (1/2)
**HeremesV2** — CRITICAL: MowGo MISSING from ALL major 2026 comparison lists (Briostack Jul 23, Tolodora Jul 27, LawnStarter Jul 23, Repair-CRM Jul 25, Software Advice). Every Google search for "best lawn care software 2026" funnels prospects to competitors.
QuoteIQ July update: AI AutoMeasure, Ask AI Reports, Expenses Analytics. Sprinting on AI features.
Servinix launching Jul 31 — 3 days away. No pricing published. Features: AI assistant (Maya), lead engine, route optimization.

### Jul 28, 09:13 — Stripe Health Check (3/3)
**HeremesV2** — Summary: All 4 secret env vars empty. VITE_FORCE_DEMO=true. VITE_STRIPE_PRICE_SOLO points to deactivated $49 price. **Verdict: Stripe integration is non-functional in production.**

### Jul 28, 09:13 — Stripe Health Check (2/3)
**HeremesV2** — CRITICAL ISSUES:
1. Pages Functions NOT deployed — all endpoints return SPA HTML/405
2. All 4 secret env vars empty: STRIPE_SECRET_KEY (len=0), STRIPE_WEBHOOK_SECRET (len=0), SUPABASE_SERVICE_KEY (len=0), OPENROUTER_API_KEY (len=0)
3. VITE_FORCE_DEMO still true — no real auth tokens, checkout returns 401
4. VITE_STRIPE_PRICE_SOLO points to deactivated $49 plan (server has correct $39)

### Jul 28, 09:13 — Stripe Health Check (1/3)
**HeremesV2** — Domain: mowgo.pages.dev (deployed from main, commit c40f68c). Stripe publishable key found (pk_live_, correctly absent from JS bundle — server-side design). PaymentSheet not used (uses Checkout Sessions — correct).

### Jul 28, 06:00 — Supabase Keep-Alive
**HeremesV2** — ❌ Failed: Script not found (/opt/data/scripts/.hermes/scripts/supabase_keepalive.sh)

### Jul 28, 05:51 — Intel Engine — Pricing Intelligence (2/2)
**HeremesV2** — 3 Recommended Actions: Engage r/Entrepreneur thread `1i3pv4b` (daughter+dad), Register MowGo on comparison sites, Prep "Jul 31 Jobber promo expired" messaging

### Jul 28, 05:51 — Intel Engine — Pricing Intelligence (1/2)
**HeremesV2** — QuoteIQ is #1 competitive threat at $29.99/mo ($10 cheaper than MowGo Solo). Backed by massive YouTube influencer reach. Jobber's real cost is 3-6x sticker ($29→$179/mo with add-ons). MowGo is MISSING from ALL comparison sites (CRITICAL).

### Jul 28, 01:47 — Intel Engine — Industry Trends (2/2)
**HeremesV2** — Recommended Actions: Engage landscaping software thread (`1i3pv4b`), monitor QuoteIQ, prepare for Jul 31 Jobber promo expiration

### Jul 28, 01:47 — Intel Engine — Industry Trends (1/2)
**HeremesV2** — Software adoption DOUBLING (20%→44% YoY). QuoteIQ at $29.99. 30-60 client threshold validated. Reddit: daughter helping dad digitize — perfect MowGo buyer persona.

### Jul 27, 21:43 — Intel Engine — Competitor Monitoring
**HeremesV2** — Jobber real solo cost ~$179/mo with processing vs sticker $29. KaamCam ($12/mo) validates solo operator gap. Need Playwright for Reddit extraction.

### Jul 27, 17:37 — Intel Engine — Industry Trends + Feature Ideas
**HeremesV2** — 7 action items including engagement threads, cold outreach, comparison site submissions. Market signal: software investment DOUBLED YoY. Servinix launches Jul 31.

### Jul 27, 09:15 — Stripe Health Check
**HeremesV2** — Stripe integration: ✅ LIVE mode. mowflow.pages.dev: No Stripe key in JS bundle (correct). cleanflloww.pages.dev: Dead domain. CF API token: Invalid. Checkout endpoints: Working live.

### Jul 27, 06:00 — Supabase Keep-Alive
**HeremesV2** — ❌ Failed: Script not found (/opt/data/scripts/supabase_keepalive.sh)

### Jul 26, 09:07 — Stripe Health Check
**HeremesV2** — Server-side architecture confirmed clean. CF API token broken.

### Jul 25, 14:17 — Weekly Digest + Auto-Fix (6/6)
**HeremesV2** — Migration status, 7 bugs fixed by Mimo

### Jul 25, 14:17 — Weekly Digest (5/6)
**HeremesV2** — Code fixes: 7 bugs fixed (critical auth headers, force-unwraps, missing configs)

### Jul 25, 14:17 — Weekly Digest (4/6)
**HeremesV2** — Keyword strategy: "rain delay" and "route optimization" are whitespace keywords

### Jul 25, 14:17 — Weekly Digest (3/6)
**HeremesV2** — Reddit community pulse: QuoteIQ is top recommendation; real solo costs of Jobber are ~$179/mo

### Jul 25, 14:17 — Weekly Digest (2/6)
**HeremesV2** — Competitor deep-dive: GreenRoute, Jobber, Yardbook, LawnPro, LawnBoss, QuoteIQ

### Jul 25, 14:17 — Weekly Digest (1/6)
**HeremesV2** — Full weekly digest with competitor analysis, keyword intel, Reddit pulse, trends, auto-fix report

### Jul 24, 09:11 — Market Trends Report
**HeremesV2** — Industry brief: $188B market, ~700K businesses, 93% use some software

### Jul 23, 12:30 — **Blasian**: "I want it live and working" ✅

### Jul 23, 06:26 — **HeremesV2**: "🤝 mowflow cowork"

### Jul 23, 05:08 — **HeremesV2**: "🐛 bug hunt — Mimo review"

### Jul 23, 01:53 — **HeremesV2**: "🕵️ Intel Engine — competitor watch"

### Jul 23, 01:48 — **Blasian**: pinged bot

### Jul 23, 01:22 — **Blasian**: "Dev"

### Jul 22, 20:38 — Thread creation (3 new threads): CleanFlow dev/launch/sales

### Jul 22, 14:31 — CleanFlow v2 deployment (dark mode + PWA + offline)

### Jul 22, 14:14 — CleanFlow deployable bundle

### Jul 22, 01:07 — MowFlow status update
