# MowGo — App Store Listing (iOS)

## App Icon
- `icon-1024.png` — 1024×1024, no transparency, no rounded corners (Apple applies mask)

---

## App Store Description

MowGo is the simplest way for solo lawn care crews to manage their business from their phone. Schedule jobs, plan routes, track clients, and send invoices — all in one app built specifically for lawn care.

**WHY MOWGO**
Jobber runs $139/mo (or $99/mo billed annually) for the tools MowGo includes flat, plus $29/mo per extra crew member. Housecall Pro runs $79–$189/mo. Yardbook's free plan comes with in-app ads and manual recurring invoices. MowGo is the only app with free rain delay — tap once when it rains, your whole schedule moves. Built for 1-3 person lawn care crews.

**FREE TIER: 5 CLIENTS, FOREVER**
• Rain delay auto-reschedule — one tap, done
• Daily scheduling with drag-and-drop
• Client profiles — gate codes, pet instructions, mow notes
• Invoicing with Stripe payments
• Dark mode built in
• Works offline

**SOLO PLAN — $39/MONTH**
• Unlimited clients & jobs
• Online booking link — clients book themselves
• GPS route navigation
• Recurring job automation
• 14-day free trial

**CREW PLAN — $79/MONTH**
• Everything in Solo
• Job assignment & tracking
• Team dashboard
• Priority support

No per-user fees. No contracts. Cancel anytime.

---

## Keywords
lawn care, landscaping, scheduling, route planner, invoicing, lawn mowing, client management, field service, grass cutting, mowing schedule, yard work, landscape business, service business, job scheduler, lawn maintenance, small business

---

## Screenshots (6.7" iPhone — 1290×2796px)
Place screenshots in `screenshots/` folder. Required: 6-8 screenshots.

| # | Screen | Mode |
|---|--------|------|
| 1 | Home dashboard — greeting, stats, quick actions | Dark |
| 2 | Today schedule — job cards with rain delay button | Dark |
| 3 | Client detail — notes, gate codes, nav buttons | Light |
| 4 | Invoices — paid/unpaid with mark-as-paid | Dark |
| 5 | Jobs — date-grouped job list with filters | Dark |
| 6 | Dark mode showcase — Today tab | Dark |
| 7 | Landing page — pricing cards | Dark |
| 8 | Comparison page — MowGo vs competitors | Dark |

**How to take screenshots:**
1. Open Safari on iPhone → mowgoapp.com
2. Log in (or use Demo mode)
3. Take screenshot (side button + volume up)
4. Save to Photos
5. Trim status bar in Preview or Photoshop
6. Save as PNG at 1290×2796px

---

## App Preview Video (30 seconds, optional)
Screen record (Control Center → Screen Recording):
1. Today tab → mark job complete → invoice toast
2. Tap rain delay → confirm jobs moved
3. Clients tab → expand card → show gate codes
4. Toggle dark mode
5. Open the online booking link → show the client-facing self-scheduling page

---

## App Store Connect URLs
- **Privacy Policy:** https://mowgoapp.com/privacy
- **Support:** https://mowgoapp.com
- **Marketing:** https://mowgoapp.com/#/compare

---

## Pricing Tiers (App Store Connect)
| Tier | Price |
|------|-------|
| Free | $0.00 |
| Solo | $39.99/month |
| Crew | $79.99/month |

Free tier = 5 clients. Solo + Crew have 14-day trials.

---

## Review Notes (for App Review)
- Demo mode active — tap "Continue with Demo" on login, no account needed
- Stripe checkout uses live keys for subscription payments
- Rain delay is the headline feature — test it on Today tab
- Offline mode uses IndexedDB, syncs on reconnect
- Booking link — share your public booking page so clients self-schedule (no account needed)
