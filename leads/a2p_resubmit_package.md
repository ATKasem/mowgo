# A2P Resubmit — 30913 Fix Package (2026-08-06)

**Rejection:** `30913 Campaign rejected: Marketing and informational consent must be separate`
Twilio docs: https://www.twilio.com/docs/messaging/guidelines/error-30913

## Root cause (what we did wrong)
The campaign was registered as **Marketing**, but the message flow let the
**reply-YES-for-the-rate-report** keyword grant *marketing* consent. The report
is informational content — so one opt-in action covered both categories.
That is 30913 exactly: "a single checkbox, form, or agreement covers both…"

## The fix (matches Twilio's four solutions)
1. **Separate opt-in controls** — two independent consents:
   - **Informational** (report delivery): reply `YES` — informational only.
   - **Marketing** (offers): separate unchecked checkbox on the website
     (`https://mowgoapp.com/#/sms-optin`) **or** reply `OFFERS` keyword.
     Neither grants the other.
2. **Every method listed in message_flow** (both are).
3. **Written consent** — checkbox is written; keywords are written (text-in
   flows are explicitly allowed by 30913).
4. **Evidence URL** — live page + hosted screenshot:
   - Page: `https://mowgoapp.com/#/sms-optin` (two checkboxes: informational
     + marketing, both unchecked by default, separated language, ~1–2/mo for
     marketing, "Msg&data rates may apply", STOP, optional to submit) ✅ verified live
   - Screenshot: `https://mowgoapp.com/sms-optin-screenshot.png` ✅ 200
   - Privacy: `https://mowgoapp.com/#/privacy` ✅ 200 · Terms: `https://mowgoapp.com/#/terms` ✅ 200

## ✅ Console checks (before resubmit)
1. Brand → Support email = business domain (`support@mowgoapp.com`), not gmail.
2. Brand → DBA = "MowGo".
3. Campaign → **Use case: Mixed** (not Marketing) — campaign sends informational
   report texts AND separate marketing offers. If the use-case dropdown is
   locked on the existing campaign, create a new campaign and select Mixed
   (one-time ~$15 campaign fee, refundable if rejected).

## 📋 Campaign Edit fields (paste these)

**Description:**
MowGo is a lawn care scheduling SaaS for small Oklahoma crews (mowgoapp.com).
This Mixed campaign sends (a) informational SMS: a free one-page lawn pricing
report for the recipient's city, delivered only after the recipient requests
it; informational flow is at most 3 messages (Day 1 ask, Day 2 follow-up, Day 7
final check) and stops there unless the recipient engages; and (b) marketing
SMS about MowGo's product, about 1-2 per month, sent only to recipients who
separately opted in to marketing. Max 10 messages per day across the campaign,
weekdays 9-11am local. Recipients can opt out anytime with STOP.

**Message flow (two separate consents):**
Recipients give two independent consents, collected separately. (1) INFORMATIONAL:
a recipient requests the free lawn pricing report and replies YES to confirm;
this consent is for the report only and does NOT enroll them in marketing.
(2) MARKETING: a separate opt-in via the opt-in page at
https://mowgoapp.com/#/sms-optin — one unified page with two separate
checkboxes for informational (pricing reports) and marketing (offers). The user
can check either, both, or neither. This is a single method that informs
recipients about both use cases with separated language per Twilio's requirements.
Checking consent is not required to submit the form. Screenshot:
https://mowgoapp.com/sms-optin-screenshot.png. Marketing consent never comes
from the YES keyword. Both consents are written (checkbox or keyword). Opt-out: reply STOP anytime (auto-confirmed); HELP keyword
supported. Privacy Policy: https://mowgoapp.com/#/privacy. Terms:
https://mowgoapp.com/#/terms. Privacy policy states mobile numbers are never
shared with third parties for marketing.

**Sample message #1 (Day-1 informational ask — consent solicitation):**
Hey, this is Aaron with MowGo. I put together the real OK rates — Edmond runs about $58 a cut. Want the one-pager? No cost, no pitch.

**Sample message #2 (informational — opt-in confirmation for YES):**
MowGo: Got it — your lawn pricing report is on its way. Reply STOP to cancel, HELP for help. Msg&data rates may apply.

**Sample message #3 (informational — report delivery):**
Your OKC metro report: avg mow $55.25, Broken Arrow $67, Bethany $48. Full one-pager: mowgoapp.com/rates. Want occasional MowGo offers? Reply OFFERS to opt in — separate consent, about 1-2/mo. Reply STOP to cancel.

**Sample message #4 (marketing — opt-in confirmation for OFFERS):**
MowGo: You're subscribed to marketing texts (about 1-2/mo). Reply STOP to cancel, HELP for help. Msg&data rates may apply.

**Sample message #5 (marketing — only after separate opt-in):**
Hi [Name], MowGo's route planner cuts drive time about 15-20% for OKC crews. See it: mowgoapp.com. Reply STOP to opt out.

**Opt-in keywords:** YES (informational), OFFERS (marketing), START (rejoin after STOP)
**Opt-in message (YES):** MowGo: Your lawn pricing report is confirmed — coming next. Reply STOP to cancel, HELP for help. Msg&data rates may apply.
**Opt-in message (OFFERS):** MowGo: You're in for marketing texts (about 1-2/mo). Reply STOP to cancel, HELP for help. Msg&data rates may apply.

**Messaging Service → Advanced (HELP/STOP):**
- HELP: MowGo help: reply STOP to cancel texts. Contact support@mowgoapp.com or (405) 914-5837. Msg&data rates may apply.
- STOP: You're unsubscribed from MowGo texts. No more messages will be sent. Reply START to rejoin.

## What's already verified live (no action)
- Opt-in page + screenshot + privacy + terms: all 200 (checked 2026-08-06).
- Two checkboxes: informational (pricing reports) and marketing (offers), both unchecked by default, separated language per Twilio 30913 requirements. Checkboxes are optional.
- No third-party sharing, HTTPS, no URL shorteners.

## Remaining risk (honest)
- TCR reviewers may still ask why cold directory leads receive message #2's
  OFFERS ask — the ask is a consent solicitation, not marketing content, and
  goes only to people who already requested the report. That's the documented
  Mixed-campaign pattern.
- If they bounce again, the nuclear option: split into TWO campaigns
  (informational-only + marketing-only). Costs one extra $15 fee.
