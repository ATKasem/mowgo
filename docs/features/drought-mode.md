# Drought Mode — Feature Spec

**Status:** 🚀 Banked (awaiting build)
**Owner:** Dev
**Priority:** HIGH — drought is the #1 national story summer 2026
**Market-first angle:** No lawn SaaS competitor ships a unified "Drought Mode" toggle

## Problem

Droughts are devastating lawn care crews nationwide in summer 2026. When watering restrictions hit:
- Clients cancel or skip weeks
- Crews lose revenue unpredictably
- Scheduling becomes chaos (cancel, rebook, cancel again)
- Level billing is the only way to smooth cash flow, but no competitor packages it as a drought response

## The Opportunity

MowGo can ship "Drought Mode" — a single toggle that:
1. Freezes recurring schedules (mark as "drought hold" instead of canceling)
2. Auto-levels invoices (average last 3 months → flat monthly drought rate)
3. Sends broadcast SMS to affected clients explaining the change
4. Auto-resumes schedules when drought ends

## Three Tracks

### Track 1: Level Billing (prerequisite)
- Average last 3 months of invoices for each client
- Offer "level billing" as a client preference
- Display "Drought Mode" toggle in crew dashboard
- **Effort:** Medium (backend + DB migration + UI toggle)

### Track 2: Drought Mode Toggle (UI)
- Single toggle on Today/Dashboard view
- "🔴 Drought Mode Active" banner
- All recurring jobs get "drought hold" status (not cancelled)
- SMS/email notification to all affected clients
- **Effort:** Small (frontend component + status flag)

### Track 3: Broadcast SMS (Twilio)
- When drought mode toggled ON: send SMS to all clients with active jobs
- "🌵 MowGo Drought Notice: Your [day] service is on hold due to water restrictions. No charges until service resumes. Questions? Reply."
- When drought mode toggled OFF: "🌱 Service resumes [date]. Your first visit is scheduled."
- **Effort:** Small (Twilio broadcast endpoint, already have Twilio integration)

## Copy Angles

- "Drought steals your revenue. MowGo smooths it."
- "Every other software charges you when it rains. We protect you when it doesn't."
- "Level billing is table-stakes. Drought Mode is the difference."
- "Your competitors lose clients to drought. You keep them on hold."

## Success Metrics

- Toggle adoption: % of active crews who enable Drought Mode
- Client retention: % of clients on hold who resume vs cancel
- Revenue smoothing: variance in monthly revenue before/after

## References

- Level billing is now table-stakes: LawnPro Free confirmed, ProBase free, GreenRoute free all offer it
- MowGo's $39/$79 flat pricing is already positioned against per-user pricing (Jobber, QuoteIQ)
- Drought Mode = MowGo's wedge vs free competitors (ProBase, LawnPro, GreenRoute)
- Intel Engine v51 pricing_intelligence: confirmed level billing is competitive negative without it

## Build Order

1. Level billing (backend: average calculation, DB: `clients.level_billing` boolean, `clients.flat_rate`)
2. Drought Mode toggle (frontend: Today.jsx, Dashboard.jsx banner)
3. Broadcast SMS (Twilio endpoint, already have send_sms.py infrastructure)
4. Auto-resume (scheduled job when drought flag expires)