# MowGo Marketing Playbook
**Last updated:** 2026-07-23
**Product:** MowGo — Simple scheduling, routing, and invoicing for house lawn care crews
**URL:** https://mowgo.netlify.app
**Target:** Solo operators and 1-3 person lawn care crews

---

## 1. Target Audience

### Primary: "Maria"
Runs a 2-person house lawn care business. 25-40 recurring clients. Schedules via texts and a notebook. Invoices via Venmo or cash. Loses ~$400/month in missed appointments and late payments. Would pay $49/month for something that actually works.

### Where they hang out
| Channel | Audience | Intent |
|---------|----------|--------|
| r/sweatystartup | Solo cleaners + service businesses | Asking for advice, tool recs |
| r/smallbusiness | Broader small biz owners | Software recommendations |
| r/entrepreneurridealong | Service biz startups | Sharing journeys, asking for tools |
| r/cleaning_business | Niche — cleaning specific | Low volume but high intent |
| Facebook "Cleaning Business Owners" groups | Older demographic, very active | High engagement, trust-based |
| Nextdoor | Local recommendations | Word of mouth |
| TikTok/IG reels | Younger cleaners | Before/after cleaning content |

---

## 2. Channels & Tactics

### Channel 1: Reddit (free, high-leverage)
**Goal:** 5-10 beta users from Reddit within 30 days

**Daily actions:**
1. Search r/sweatystartup, r/smallbusiness, r/entrepreneurridealong for:
   - "what software do you use for cleaning"
   - "how do you manage scheduling"
   - "best app for cleaners"
   - "invoicing for lawn care business"
   - "tired of Jobber" / "Jobber too expensive"
2. Reply helpfully — NOT pitching. "I actually built something for this — happy to DM if you want to try it free."
3. Post value content once a week:
   - "How I built a scheduling app for lawn care crews in 4 weeks" (r/entrepreneurridealong)
   - "Stop losing $400/month to missed appointments" (r/sweatystartup)
   - "I analyzed 50 lawn care business owners — here's what they all struggle with" (r/smallbusiness)

**Monitored subreddits (cron):**
- r/sweatystartup
- r/smallbusiness
- r/entrepreneurridealong
- r/cleaning_business
- r/SaaS

### Channel 2: Cold Email (free, targeted)
**Goal:** 3 conversations per week

**Source lists:**
- Google Maps: "house lawn care service" in target cities
- Yelp: lawn care businesses with < 10 reviews (small, likely no software)
- Facebook group members who mention scheduling problems

**Script:** "Saw your lawn care business on Google Maps. I built MowGo — dead simple scheduling + invoicing for small lawn care crews. Free tier (10 clients, no credit card). Would you be open to trying it and giving feedback? Happy to hop on a 5-min call."

### Channel 3: SEO (long game)
**Target keywords:**
- "best scheduling software for lawn care business"
- "lawn care business app"
- "lawn maintenance invoicing software"
- "free scheduling app for cleaners"
- "Jobber alternative for lawn care business"

**Content to create:**
- Comparison page: "MowGo vs Jobber for lawn care businesses"
- Blog: "5 signs you've outgrown pen and paper for your lawn care business"
- Blog: "How to stop losing money to missed cleaning appointments"
- Landing page for each keyword cluster

### Channel 4: Direct Outreach (highest conversion)
**Goal:** 5 beta users in OKC

**Method:**
1. Search Google Maps for "house lawn care service Oklahoma City"
2. Filter for businesses without websites (phone number only) — no software
3. Call or visit: "I'm a local dev who built a simple scheduling app for lawn care crews. Free to try. Can I show you on my phone?"
4. Track every conversation

### Channel 5: X/Twitter (build in public)
**Goal:** Build founder credibility, attract early adopters

**Post cadence:** 3-5x/week
**Content:**
- Build updates: "Just shipped rain delay for MowGo — one button moves all tomorrow's cleanings to the next day"
- Pain points: "Talked to 10 lawn care business owners. 8 of 10 still use pen and paper for scheduling."
- Lessons: "Building a SaaS taught me the difference between what I THINK users want and what they ACTUALLY need"

---

## 3. Content Calendar

| Day | Reddit | Cold Email | X | Other |
|-----|--------|------------|---|-------|
| Mon | Reply to 3 threads | Send 10 emails | Build update | — |
| Tue | Value post | Follow-ups | Pain point post | — |
| Wed | Reply to 3 threads | Send 10 emails | Lesson post | — |
| Thu | — | Follow-ups | Build update | Facebook group post |
| Fri | Reply to 3 threads | Send 10 emails | Pain point post | — |
| Sat | Value post | — | — | — |
| Sun | — | — | — | Weekly recap |

---

## 4. Messaging

### One-liner
> "Dead simple scheduling and invoicing for lawn care crews who've outgrown pen and paper."

### Problem statement
> "Most lawn care business owners run their schedule from texts, memory, and a notebook. They lose $400+/month in missed appointments. Jobber costs $119/month and is built for 10-person operations. MowGo is $49/month and does exactly what a 1-3 person crew needs."

### Key differentiators
1. **Free tier** — 10 clients, no credit card
2. **Rain delay** — one button reschedules everything (works for any weather/service disruption)
3. **$49 Solo** — includes what Jobber charges $119 for
4. **No per-user fees** — Jobber charges $29/extra user
5. **Mobile-first** — built for the phone in your pocket, not an office desktop

---

## 5. Success Metrics (30-day targets)

| Metric | Target | Current |
|--------|--------|---------|
| Beta users | 10 | 0 |
| Reddit replies posted | 60 | 0 |
| Cold emails sent | 200 | 0 |
| Website visitors | 500 | ? |
| Email signups | 25 | 0 |
| Paying users | 2 | 0 |

---

## 6. Infrastructure Needed

| Tool | Purpose | Status |
|------|---------|--------|
| Reddit monitor cron | Find threads to reply to | ❌ |
| Cold email cron | Send daily outreach | ❌ (needs script) |
| Competitor monitor | Track Jobber/HCP/ZenMaid changes | ❌ (war chest needs cleaning update) |
| Lead tracker | Google Sheet or Supabase table | ❌ |
| Analytics | Plausible or PostHog on landing page | ❌ |
| Stripe live keys | Accept payments | ❌ |

---

## 7. What We're NOT Doing (yet)

- ❌ Paid ads (Google/Facebook) — validate free channels first
- ❌ Content marketing/blog — build once we have users to write about
- ❌ Capterra/G2 — need real users/reviews first
- ❌ YouTube — high effort, low immediate return
- ❌ Affiliate/referral program — need user base first
