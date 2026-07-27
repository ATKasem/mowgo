# MowGo Feature Roadmap

> Last updated: 2026-07-27
> Tracking requested features, in-progress work, and planned additions.

## Current Version — v1.0 (Live)
- ✅ Drag & drop schedule
- ✅ Rain delay auto-reschedule (one-tap)
- ✅ Offline mode
- ✅ Dark mode
- ✅ Free tier (5 clients, no credit card)
- ✅ Stripe payments
- ✅ Recurring jobs
- ✅ Client notes & codes (gate codes, pets, mow height)
- ✅ GPS navigation
- ✅ Auto invoicing
- ✅ Crew / team management
- ✅ iOS app (App Store)
- ✅ Android app (Google Play)
- ✅ AI estimates & measurements
- ✅ Competitor comparison page (/compare)

## 🟢 Planned — Short Term

### Online Booking Link (📌 HIGH PRIORITY)
**Why:** Competitor DoorstepHQ offers online booking. Customers expect to book from your website without calling.
**Est:** 1-2 days dev
**Status:** Not started
**Notes:** Simple shareable link → calendar/availability check → booking creates a new job in the system. Could be a public page at `book.mowgo.app/[business-id]`.

### QuoteIQ Alternative Landing Page (/quoteiq-alternative)
**Why:** QuoteIQ just axed their free plan. Multiple Reddit threads from displaced users searching for a replacement. SEO target: "QuoteIQ alternative."
**Est:** 1 day content + dev
**Status:** In progress
**Notes:** Use JobberPriceIncrease.jsx as template. Highlight rain delay + free tier + no per-user fees vs QuoteIQ's 1% tx fee on top of Stripe.

### Google Alerts Monitoring
**Why:** LawnBoss jumped 281→829 pros in one month. GreenBrain launched with weather delay claims. Need early warning.
**Status:** Needs Google account setup

## 🟡 Medium Term

### MowFlow vs Everyone Comparison Page
**Status:** Exists at /compare — keep updated with new competitors (GreenBrain, Servinix, GreenSpace CRM)
**Notes:** Rain delay is our #1 proven differentiator vs ALL competitors.

### Jobber Price Increase SEO Blog Post
**Status:** Exists at /jobber-price-increase — already live
**Notes:** Jobber appears in ~50% of CRM Reddit threads. Update pricing periodically.

### Offline Mode — Expand
**Status:** Basic offline storage exists in lib/offlineStorage.js
**Notes:** GreenRoute brags about it. Our implementation works but needs more testing in low-signal rural areas.

## 🟠 Future Consideration

### Advanced Weather Integration
- Hourly radar overlays in schedule view
- Automated client SMS on rain delay triggers

### Client Portal / Self-Service
- Clients can view upcoming services
- Clients can reschedule (with approval)

### Multi-Crew / Fleet Routing
- Assign multiple crews from a single dashboard
- Optimized route sequencing across crews

### Public API
- Zapier / Make integration
- Webhook notifications for job events

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-27 | Created roadmap. Added booking link as #1 short-term priority. Added QuoteIQ alternative page to in-progress. |
