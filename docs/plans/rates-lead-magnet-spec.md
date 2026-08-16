# Rates Lead Magnet — Build Spec

## Goal
Convert the existing "What to Charge in Your City" rate report into a self-serve lead magnet at mowgoapp.com/#/rates.

## Pattern to follow
The RouteAudit page (`client/src/pages/RouteAudit.jsx` + `functions/api/route-audit.js`) is the exact template. Follow its structure.

## Files to create

### 1. `client/src/pages/Rates.jsx` (React page)

**Route:** `/#/rates`

**Design brief:**
- Clean landing page matching RouteAudit's visual style (emerald gradient, white cards)
- Hero section: "What to Charge in Your City" / "Real Oklahoma lawn rates, by city. Free."
- Eyebrow badge: "Free Report" (like RouteAudit's "Free Audit" badge)
- State average prominently displayed: **$55.25** across all yard sizes
- Show the city pricing table directly on the page (give away the headline data)
- Brief form: **Email** (required) + **City dropdown** (required, the 10 OK cities from the report)
- CTA: "Send Me the Full Report" — emails them a branded PDF/HTML version with all the details
- After submit success: show inline "Check your inbox ✅" message with the city table

**Form logic:**
- Email validation (same regex as RouteAudit)
- City validation (must be one of the 10 OK cities)
- POST to `/api/rates`
- On success: show success state (not a redirect)
- On error: show error banner

### 2. `functions/api/rates.js` (CF Pages Function)

**Rate limiting:** Same 5/15min window as route-audit.js
**Validation:** Email regex + city must be in the valid set

**On valid submission:**
1. Send branded HTML email via Resend (from `invoices@mowgoapp.com`, reply-to `hermes.assistant.job@gmail.com`)
2. The email should include:
   - Full city pricing table with the 10 OK cities
   - Yard size breakdown table (1/8 acre → 1 acre)
   - Revenue math section (20 customers = $27K/yr etc.)
   - Honest caveats section
   - Soft MowGo branding at bottom: "Built by MowGo — scheduling software for Oklahoma lawn crews" with link
3. Insert into `lead_touches` table in Supabase:
   - `instant` (sent now — the report email)
   - `day3` (queued — follow-up: "how to raise prices")
   - `day7` (queued — follow-up: MowGo story)

**Lead_touches schema:**
```sql
source: 'rates_report'
lead_email: email
kind: 'instant' | 'day3' | 'day7'
channel: 'email'
status: 'sent' (instant) | 'queued' (day3, day7)
sent_at: now (instant)
```

**CORS:** Same as route-audit — allow mowgoapp.com origin

### 3. Update `client/src/App.jsx`

Add lazy import for Rates page and add route at `/rates`:
```js
const Rates = lazy(() => import('./pages/Rates'));
```
```jsx
<Route path="/rates" element={<Rates />} />
```

### 4. Email HTML content (inline in the function)

Use the rate data already in `/opt/data/mowgo/leads/what-to-charge-ok-report.md`:

State average: **$55.25**

City prices:
| City | Avg mow price |
|------|--------------|
| Broken Arrow | $67.08 |
| Claremore | $65.13 |
| Yukon | $59.36 |
| Edmond | $58.02 |
| Tulsa | $56.93 |
| Oklahoma City | $54.73 |
| Norman | $52.89 |
| Guthrie | $51.22 |
| Chickasha | $50.82 |
| Bethany | $48.01 |

Yard size table:
| Yard size | Weekly | Bi-weekly | Monthly |
|-----------|--------|-----------|---------|
| 1/8 acre | $30.39 | $34.81 | $35.36 |
| 1/4 acre | $39.78 | $45.31 | $46.96 |
| 1/3 acre | $52.49 | $53.04 | $60.22 |
| 1/2 acre | $65.75 | $75.70 | $78.46 |
| 1 acre | $102.22 | $107.19 | $119.34 |

Revenue section: $52.49/cut → ~$1,365/yr per customer → 20 customers = $27,300/yr

Caveats section: market ceiling, yard size dominates, raise on new customers, reliability > rate bump

Footer: "Prepared by MowGo (mowgoapp.com) — scheduling, routing, and invoicing for Oklahoma lawn crews. Data: LawnStarter OK market, refreshed August 2026."

## Deploy
Standard CF Pages deploy: `git push origin main`