# MowGo Capterra Listing Kit

Status: **NO LISTING EXISTS YET.** Capterra search shows no MowGo profile. Must be added via vendor flow.

## BLOCKER FIRST: mowgo.app does not resolve

- Registered 2026-06-24 at Cloudflare registrar. Nameservers already point at Cloudflare (arvind/deb.ns.cloudflare.com).
- The zone EXISTS at those nameservers (SOA resolves) but has **zero DNS records**. The Pages project "mowgo" has only mowgo.pages.dev attached.
- Every outreach template, Reddit reply, and tip card sends people to https://mowgo.app. Clicking it goes nowhere. This is very likely a big reason 5 emailed leads produced 0 responses.
- Live site right now: https://mowgo.pages.dev (200 OK).

### Fix (5 minutes, dashboard)

1. Log into dash.cloudflare.com with the account that owns the mowgo.app zone (the one showing nameservers arvind/deb; if it isn't the aaronkasem@gmail.com account, try the other CF login).
2. Open the mowgo.app zone.
3. Add DNS record: `CNAME mowgo.app -> mowgo.pages.dev` (Proxied).
4. Add DNS record: `CNAME www -> mowgo.app` (Proxied).
5. If the zone is in the SAME account as Pages: Pages project `mowgo` -> Custom domains -> Add `mowgo.app` (CF auto-creates the CNAME).
6. Verify: open https://mowgoapp.com in a browser. Should load the app.
7. Re-test checkout once on the custom domain (webhook allowlist in send-push/send-webhook already includes mowgo.app, and Stripe webhook should accept both, but verify one live payment).

Also note: a past scan flagged checkout dead after an Aug 2 deploy (functions missing). Aug 3 scan says 13 env vars restored, but do a logged-in test checkout on the custom domain before sending the next round of outreach.

## Claim flow (after DNS is live)

1. Go to https://www.capterra.com/vendors/ and click "Get listed" / "Add your software".
2. Create vendor account with the business email (use the email that will get verification: aaronkasem@gmail.com or a mowgo.app address).
3. Add product: search "lawn care" category, add MowGo as new product.
4. Complete product profile (copy below).
5. Verify website ownership: Capterra offers email verification to an address at your domain OR a meta tag / HTML file. Easiest with CF: add the meta tag to index.html in the repo and deploy, or create verification.html in public/ and deploy.
6. Submit. Capterra reviews the listing (typically 1-2 weeks for a new product in a category).
7. Then start the review engine (marketing/review-engine.md) to stack the first 5 reviews so the rating becomes visible.

## Pre-filled product profile copy

- **Product name:** MowGo
- **Website URL:** https://mowgoapp.com
- **Category:** Lawn Care Software
- **Pricing:** $39/mo Solo, $79/mo Crew. Free tier: 5 clients, no card required. No per-user fees, no transaction fees beyond Stripe.
- **Short description (50 words):** Scheduling, routing, invoicing, and rain delay alerts built for lawn care owners. Free tier for solo operators, flat $39/mo with no per-user or transaction fees. Auto-invoicing, client notifications, and route planning for 1-5 crew operations.
- **Features to select:** Scheduling, Invoicing, Route optimization, Client management, Recurring jobs, Mobile app, Notifications, Payment processing (Stripe), Estimates, Time tracking (optional: only select features actually shipped)
- **Target market:** Small lawn care businesses, 1-5 crews
- **Competitors shown in category:** Jobber ($169+/mo), Housecall Pro, RealGreen, Arborgold

## Positioning notes for the listing

- Price is the weapon: $39 flat vs Jobber/Housecall at $100-300/mo. Capterra reviews regularly cite price as the #1 switch reason in this category.
- Category page ranks by review count + recency. 10+ fresh reviews beats a polished profile.
- Do NOT list features that aren't shipped. Capterra buyers compare checklists; a missing feature is fine, a broken claim gets you a 1-star review.
