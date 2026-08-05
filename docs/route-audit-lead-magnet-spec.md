# SPEC: Free Route Audit lead magnet (web) — Hormozi lead-magnet framework

**Goal:** Capture qualified solo-operator leads with a reveal-a-problem lead magnet (§26), build an email list, and feed the concierge/signup flow. Web-only, no native changes.

## Framework (Hormozi §26)
- Type: **Reveal a Problem** (assessment — deprivation grows while waiting)
- Delivery: **Software + Information** (calculator → personalized report)
- Naming: Number + Outcome ("see the hours AND dollars you're losing every week")
- CTA: clear → exact action → reason now (real capacity scarcity)

## Page: `/#/route-audit` (new route, public, no login required)

### Section 1 — Hook
- Headline: **"Free Route Audit: see the hours — and dollars — you're losing to bad scheduling every week"**
- Sub: "Enter your numbers. We'll show you what an optimized route is worth to YOUR lawn business. No signup, no spam — just the math."
- 3 proof bullets (no invented numbers — use generic framing):
  - "See your estimated weekly hours wasted on backtracking"
  - "See the revenue left on the table each season"
  - "3 quick fixes you can apply this week"

### Section 2 — The form (qualification filter)
Fields (client-side validation, all required):
1. **First name** (text)
2. **Email** (valid email format — regex same as public.js)
3. **Zip code** (5-digit US)
4. **Lawns per week** (dropdown): "Under 10" / "10–25" / "25–50" / "50+"
5. **Crew size** (dropdown): "Just me (solo)" / "2–3" / "4+"
Submit button: **"Run my free audit →"** + scarcity line below: "We onboard 50 new crews this month — spots are filling."

### Section 3 — Qualification branching (client-side, instant)
- **Qualified (ICP):** lawns = "10–25" or "25–50" → after submit show success state: "Your audit is on its way to [email] — check your inbox in ~2 minutes." + CTA button: "Book your free setup call" → /#/login?mode=signup (concierge hook)
- **Unqualified:** lawns "Under 10" (too small — redirect to pricing with honest copy: "You might not need automation yet — here's what we offer when you grow") OR "50+" (too big — "MowGo is built for solo crews and small teams — check out these tools for larger operations" → links to Compare page). These still get the email report (list building) but NOT the concierge pitch.
- **Crew size:** solo/2–3 = ICP; 4+ = still give report, pitch Crew tier instead of solo.

## Backend: `functions/api/route-audit.js` (new CF Pages function)
- POST with { name, email, zip, lawns_bucket, crew_bucket }
- Validate: email regex, zip = 5 digits, buckets ∈ allowed sets. Rate-limit: 5 req/15min per IP (mirror public.js pattern — check how public.js does it and reuse).
- Compute report numbers (deterministic, honest, no fake precision):
  - `hours_wasted_week` = lawns_bucket_mid × 0.75 (avg 45 min/week saved per lawn from optimized routing — label as "estimate based on industry averages")
  - `revenue_impact_month` = hours_wasted_week × 4.33 × $45/hr (label as estimate)
  - `annual_impact` = revenue_impact_month × 12 × 0.6 (seasonal factor for lawn care — "lawn season ≈ 7 months")
  - Show the formula on the report page ("Here's the math") — honesty builds trust.
- Insert row into a new Supabase table `route_audits` (id, name, email, zip, lawns_bucket, crew_bucket, hours_wasted_week, revenue_impact_month, created_at) — **migration file needed** in supabase/migrations/ (e.g. 013_route_audits.sql) with RLS: no public read; service role only. Also add `email` index.
- Send email via **Resend REST API from the CF function** (no npm deps): POST https://api.resend.com/emails with header `Authorization: Bearer ${env.RESEND_API_KEY}` and body `{ from: 'MowGo <invoices@mowgoapp.com>', to: email, subject, html }` (from address matches existing server/index.js:329 pattern). NOTE: RESEND_API_KEY must be added to CF Pages env (Aaron manual step — the key exists in server/.env already).
- Email: personalized report — subject: "Your route audit: ~X hrs/week on the table"; body: the 3 numbers + the formula + 3 quick fixes (generic: batch jobs by zone, block recurring clients on the same day, leave 15-min buffers) + CTA "See how MowGo automates this" → landing page.
- Rate limiting: mirror public.js EXACTLY — module-level `const WINDOW_MS = 15*60*1000; const LIMIT = 5; const attempts = new Map();` + `allowed(ip)` using `cf-connecting-ip` header, 429 with 'Too many requests. Please try again later.'

## Files
- NEW `client/src/pages/RouteAudit.jsx` (page) + route in App.jsx
- NEW `functions/api/route-audit.js` (CF function)
- NEW `supabase/migrations/013_route_audits.sql`
- i18n: en.json + es.json `routeAudit` section (all strings, both locales)
- Landing.jsx: add a link/CTA to the audit (small section or hero secondary button "Try the free route audit" — placement TBD, keep minimal)
- Docs: this spec

## Constraints
- No changes to ios-native/, android-native/. No new npm deps (use existing Resend/axios/fetch patterns).
- No invented testimonials or fake numbers — all report numbers are labeled estimates with visible formulas.
- Rate limiting mandatory (5/15min/IP).
- i18n complete in both locales. `git diff --check` clean. Brace-balanced.
- Report: files changed, per-file notes, migration summary, env vars needed (RESEND_API_KEY in CF Pages), compile risks, deviations.
