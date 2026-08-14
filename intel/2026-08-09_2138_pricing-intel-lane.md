# BI Engine Late-Run Addendum — 2026-08-09 21:38Z
**Context:** Weekly digest compiled 10:00Z. This is the 21:38Z sweep (pricing_intelligence lane + Reddit pipeline check).

## Reddit Pipeline Status ⚠️
- RSS feeds now returning **403** on all target subreddits
- Previously worked at 10:00Z for the digest sweep; degraded sometime between 10:00Z and 21:38Z
- JSON API also blocked (403)
- `seen_reddit_urls` remains empty — pipeline is effectively dead
- **Impact:** No new threads captured since the 10:00Z digest. The next legal post slot (Mon 22:23Z) still uses the kit from the digest, so no immediate harm, but pipeline restoration needed before W33's Tuesday sweep.

## Pricing Intelligence Lane Results

### Servinix — CONFIRMED competitive threat (beta Aug 17, commercial Sept 14)
Live landscaping page confirms:
- **Rain delay automation** (SMS + auto-reschedule, threshold-configurable ≥70%) — directly competes with MowGo Rain Delay v2
- Crew GPS tracking, recurring contracts, before/after photos
- **"60% off your invoice" switcher hook** — aggressive competitor import incentive
- "No credit card, setup in one day, cancel anytime"
- Pricing not published yet; claims "founding-customer pricing locked"
- Directly targets the same 2+ crew operator ICP as MowGo Crew ($79)
- **MowGo advantage:** Already shipping Rain Delay v2, no beta needed; native web + iOS + Android; $79 flat vs unknown Servinix pricing

### LawnBook — Pricing confirmed via App Store listing
| Tier | Monthly | Annual |
|------|---------|--------|
| Free | $0 | — (15 clients, mobile-only) |
| Pro | $9.99 | $79.99 |
| Premium | $14.99 | $119.99 |
| Crew | $29.99 | — |
- Still the biggest pricing threat at the low end
- Blog content machine is running hard (SEO self-ranking posts)
- "1,000+ businesses claimed" — growing but still niche
- **Key gap:** No web app, no crew dashboard, no booking link, no 2-way SMS at Crew tier

### Jobber — Pricing page reconfirmed live
- Wizard now asks team size first (Just Me / 2-5 / 6-10 / 11-15 / 16+)
- "Starting at $29/mo" anchor persists
- Grow: $199/mo solo, $299 for 5 users
- Plus: $499-699/mo (5-15 users)
- Still $29/user add-on, 3-month promos on every tier
- Annual billing offers 12-month lock discounts ($120/mo Grow 1yr = $149 effective)
- **No change** from the digest — consistent with "pricing settled after Jul 31 promo end"

### GorillaDesk — Unchanged
- Basic $49 (unlimited users, broadcast SMS, automations, Square/Stripe)
- Pro $99 (booking gated here)
- Growth $149 (satellite measure)
- No pricing changes detected since last sweep

### CrewNest — NEW entrant (added to watch list)
- Search result: Pro $29/mo (3 members), $5/additional member
- Pressure washing, lawn care, snow removal — multi-seasonal
- Behind sign-in wall; full features not scanned
- Low-priced entrant; watch for traction

### QuoteIQ — Blog content machine continues
- New listicles (best scheduling software, best sales pipeline) — SEO aggressiveness accelerating
- Pricing: Essentials $29.99 → Beginner $74.99 → Pro $149.99 → Elite $299 → Max $699
- InstaSchedule/self-booking still Elite-gated at $299

## Key Delta from Digest
| Item | Digest (10:00Z) | Now (21:38Z) | Delta |
|------|----------------|-------------|-------|
| Reddit pipeline | RSS working (80 URLs) | 403 blocked | ⚠️ DEGRADED |
| Servinix | "beta Aug 17" noted | Confirmed: rain delay automation, 60% switcher hook | ✅ FULL PROFILE |
| LawnBook pricing | $9.99/$14.99/$29.99 | App Store verified same | ✅ CONFIRMED |
| CrewNest | Not tracked | $29/mo for 3 members | ➕ NEW WATCH ITEM |

## State Update
- BI state advanced: v46 → v47
- Lane cycle: pricing_intelligence done → next lane: feature_ideas
- Reddit pipeline broken — flagged for next-run check