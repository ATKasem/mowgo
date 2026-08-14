# MowGo Review Engine

Status: **BUILT, ARMED** — 0 trial users exist as of 2026-08-03 (tracker: 17 leads, 5 contacted, 0 converted). Engine fires automatically the moment users arrive. First-5 manual plan runs as soon as the first trial converts.

Goal: stack reviews on Capterra (rank driver) + Google (trust signal). Capterra only shows a rating once a product has reviews, and review count is a ranking factor in the lawn care category. 5 reviews = visible rating. 10+ = competitive with the Jobber/Housecall tier.

---

## Trigger conditions (any one fires the ask)

| Condition | Where detected | Action |
|---|---|---|
| Paid user, account age >= 14 days, >= 5 jobs created | Supabase query (profiles + jobs + subscriptions) | Auto-email Capterra ask |
| User replied positive in outreach thread ("this looks great", "signed up") | LEAD_TRACKER.md status = 🔵 or ✅ | Personal SMS/email ask from Aaron (highest conversion) |
| User stays active 30+ days | Supabase query | One nudge email, no more |
| User churns but used app 30+ days first | Supabase query | Skip. Never ask churned users. |

## Timing rules

- First ask: day 14 of paid. Never during free trial, never on day 1.
- One nudge max: day 30. After that, stop.
- Only ask users who actually used the product. A user with 0 jobs booked is a support problem, not a review source.
- Never offer payment, discounts, or gift cards for reviews. Capterra bans incentivized reviews and it poisons the data.

## Email template (Capterra ask)

Subject: 2 minutes that helps other owners

Hey [Name],

You've been running on MowGo for a couple weeks now. Glad to have you.

If it's been working for you, would you drop a quick review on Capterra? Takes about 2 minutes and it's the #1 way other lawn care owners find out we exist.

[Review link]

No pressure at all. If something's been annoying you, reply to this instead and I'll fix it.

— Aaron

Rules: under 100 words, one CTA, no em dashes, no "moreover". Link goes to the MowGo Capterra product page once the listing is live.

## SMS version (for leads that came through SMS outreach)

Hey [Name], real quick ask since you've been on MowGo a few weeks: if it's saving you time, drop a 2-min review on Capterra so other owners can find it. Link: [short link]. If something's broken, text me instead and I'll fix it. — Aaron

## First-5 plan (manual, highest priority)

The first 5 reviews decide whether the Capterra listing shows a rating. Hand-pick, don't automate:

1. The moment a trial user sends ANY positive signal (reply, feature request, "this saved me"), flag them in LEAD_TRACKER.md as 🔵 → add column note `REVIEW-ASK` .
2. Aaron texts them personally within 48 hours. Personal ask, not template. Reference something specific they said.
3. Direct them to the Capterra listing link. Offer nothing. The ask is "help other owners like you."
4. Log the ask date in LEAD_TRACKER.md. If no review in 7 days, drop it. Never push twice.

## Operationalization (when users exist)

- Supabase edge function `send-review-ask` scheduled via pg_cron: runs weekly, queries the day-14 trigger, sends via Resend/Supabase email.
- Review link shortener: `short-io` skill (aaronkasem@gmail.com account) so SMS stays under 320 chars.
- Track review count monthly in the marketing weekly cadence (mowgo-marketing skill).

## Success metrics

- 5 Capterra reviews within 60 days of first paid user (rating visible)
- 10 reviews within 120 days (competitive threshold)
- Review ask conversion target: 20-30% of asked users
