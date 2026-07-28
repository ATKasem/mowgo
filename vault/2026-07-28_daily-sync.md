# MowGo Nightly Vault Sync — 2026-07-28

> **Channels scanned:** #🌱mowgo, #🌱mowgo-outreach, #🤝mowgo-cowork
> **Sync window:** Last 7 days (Jul 22–28, 2026)
> **Total messages synced:** 73 (50 mowgo + 23 mowgo-outreach + 0 mowgo-cowork)

---

## 📊 Decisions

- **Pricing: MowGo Solo $39/mo** — Current Solo plan pricing (confirmed via Stripe price ID `price_1TwmrGGwXKVLlr2I2aLpMVHN`)
- **MowGo Crew $79/mo** — Current Crew pricing
- **Market positioning: 1-3 person crews, under 50 clients** — Explicit target; avoid going upmarket against Jobber/Service Autopilot
- **Server-side Stripe architecture** — No client-side Stripe key needed; checkout handled via CF Pages Functions (confirmed correct)
- **MowGo Solo price reduction from $49→$39** — New price ID shows a drop (legacy was `price_1TwFiDGwXKVLlr2IIyi3NmBi` at $49)
- **14-day free trial** — Configured in Stripe checkout
- **CleanFlow deployment model** — PWA/Netlify drop deployment (no CI/CD pipeline yet)

---

## 🎯 Action Items / Tasks

### 🔴 Critical
1. **Regenerate CF_API_TOKEN** — Current token (`cfk_hVA8YJ3iWxbGjjAfsVF0tNyNIoTYx8gJkiU7XBT15396badd`) is expired/invalid. Needed for Cloudflare Pages env var verification
2. **Fix Supabase keep-alive cron** — Script `/opt/data/scripts/supabase_keepalive.sh` not found; keeps failing daily
3. **Submit MowGo to comparison sites** — Still absent from Briostack, SoftwareWorld, Guideflow, FieldServiceStack (all 4 updated recently without MowGo)
4. **Prepare for Jul 31 Jobber promo expiration** — Post-promo window is prime for comparison ads. Have messaging ready: *"Jobber promo expired? MowGo starts at $39 with rain delay built in."*

### 🟡 Medium
5. **Reddit replies pending** — Engage the landscaping software thread (`1i3pv4b`) about a daughter helping dad digitize; reply highlighting MowGo's simplicity
6. **Monitor QuoteIQ ($29.99/mo)** — New competitor undercutting MowGo Solo by $10. Need feature comparison deep-dive
7. **Cold outreach kickoff** — 22 leads in tracker, zero contacted. Start with Mowzilla, Walter's Lawn Service, Aaron's Lawn Maintenance
8. **Install Playwright** — Needed for Reddit content extraction on future Intel Engine runs
9. **Clean up `cleanflloww.pages.dev` references** — Domain is dead; remove from `ALLOWED_ORIGINS` arrays in Pages Functions

### 🟢 Low
10. **Delete dead `VITE_STRIPE_PUBLISHABLE_KEY`** — Unused client-side env var (server-side architecture doesn't need it)
11. **Remove `twilio` from server/package.json** — Dead dependency, never imported
12. **Facebook engagement** — Post draft in "Lawn Mowing 101" group; conversational "what's your scheduling headache?" angle

---

## 🔬 Research Findings

### Market Intelligence
- **Software adoption DOUBLING** — FieldRoutes 2026 survey: planned software investment jumped from 20% (2025) → 44% (2026). 53% of operators expect market improvement
- **AI is table stakes** — 40% name AI as #1 priority tech. MowGo's route optimization should be labeled/positioned as AI-powered
- **The "30-60 Client Threshold"** — Software becomes essential between 30-60 recurring clients or when adding a second crew member. This exactly validates MowGo's target

### Competitor Analysis
- **QuoteIQ ($29.99/mo)** — New entrant with route optimization, MapMeasure Pro, AI estimating. Heavy Reddit presence. $10 below MowGo Solo. 🔴 Monitor closely
- **Jobber pricing restructured** — Core $29/mo (1 user), Connect $99/mo (5 users). But hidden add-ons pile up: AI Receptionist $99/mo, Marketing Suite $79/mo, Pipeline $49/mo. Real solo cost ~$179/mo with processing
- **LawnPro ($29/mo)** — Consistently budget-priced. G2 3.8/5. Data loss/support issues reported
- **GreenRoute** — Free (scheduling only), Pro $10/mo. Client portal locked at $199/mo Enterprise. Rain is forecast-only, NOT auto-reschedule (MowGo differentiator still open)
- **LawnBoss** — "100% free forever" new challenger. 92 tools. AI pricing from satellite imagery, route trading. 825+ pros joined last month. Worth monitoring
- **KaamCam ($12/mo)** — Validates solo operator pricing gap but tiny/unproven
- **GorillaDesk ($49/$99/$149)** — Converges with MowGo's pricing
- **Servinix launching Jul 31** — Rain delay auto-reschedule is closest feature match to MowGo

### Market Context
- US landscaping: ~$115.6B industry, ~600K companies, no player >5% market share
- 74% returning customers, 26% new — high retention market
- $503/household annual spend on lawn care
- 68% of annual revenue in March–September peak season
- 73% of operators rely on more technology today than 5 years ago
- 73% of homeowners under 40 would switch to a provider with online booking/payment

### Reddit Signal
- **r/Entrepreneur thread** — Daughter (24) asked by dad to put landscaping business on software. Perfect MowGo buyer persona. "The helper pattern" is an untapped marketing angle
- **r/landscaping "1-3 person crews" thread** — Highly actionable, OP asking for exactly what MowGo offers
- **r/sweatystartup** — Multiple threads about leaving corporate for landscaping; software pain is consistent
- Reddit blocks automated access (403); manual verification of dates needed before replying

---

## 📝 Notes / Context

### Channel Activity
- **#🌱mowgo** — High activity: Intel Engine runs every ~4h, Stripe health checks, Weekly Digests, Supabase keep-alive (failing). Blasian (blasian3836) last active Jul 23
- **#🌱mowgo-outreach** — Reddit Monitor (daily) and Daily Actions reports. Active Jul 23–26
- **🤝mowgo-cowork** — No activity in the sync period

### Infrastructure Health
- Stripe checkout: ✅ LIVE (`cs_live_` URLs), fully functional
- mowflow.pages.dev: ✅ Healthy, latest deployment Jul 23
- cleanflloww.pages.dev: ❌ Dead domain, DNS doesn't resolve
- CF API token: ❌ Expired/revoked
- Supabase: ❓ Unknown (keep-alive script missing)
- Reddit scraping: ❌ Blocked (403); Playwright needed for extraction

### Price IDs
| Plan | Price ID | Status |
|------|----------|--------|
| Solo $39 | `price_1TwmrGGwXKVLlr2I2aLpMVHN` | ✅ Current (Jul 2026) |
| Solo $49 (legacy) | `price_1TwFiDGwXKVLlr2IIyi3NmBi` | 🔴 Legacy |
| Crew | `price_1TwFiUGwXKVLlr2InMLdsc6T` | ✅ Current |
| Trial | 14 days | ✅ In checkout |

### Team
- **Blasian (blasian3836)** — Owner/founder, user ID: `358245311686246401`
- **HeremesV2** — Bot, user ID: `1527797521072787466`

---

*Generated by MowGo nightly vault sync — 2026-07-28 02:00 UTC*
