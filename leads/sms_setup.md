# MowGo SMS Setup — Twilio A2P (2026-08-05)

## Account
- Account SID: AC0451d12fb21a6581c314160f9531151c (in /opt/data/.env)
- Auth Token: in /opt/data/.env
- Number: +1 (405) 914-5837
- Recovery code: in /opt/data/.env (TWILIO_RECOVERY_CODE)

## A2P Campaign (submitted 2026-08-05, IN REVIEW)
- Campaign SID: CMbadd01fd23d5a51b3cd5b00aeb923e40
- Brand registration SID: BN19575317315be86bb67c7107df20b9b1
- Messaging service SID: MG0deec4a947405fb26c7fb85bc41a5809
- Brand: My Starter Profile (Sole Proprietor)
- Status: In progress — Twilio says review can take 2-3 weeks; no A2P sends until approved
- Use case: Sole Proprietor · embedded links: Yes

## REJECTED 30896 (opt-in proof) → FIXED + RESUBMITTING 2026-08-05
- Error: opt-in details didn't show consent flow; needs website URL + privacy + terms + screenshots.
- Fix built & deployed (commit 31abc9a, 59351ee):
  - Opt-in page: https://mowgoapp.com/#/sms-optin (phone + consent checkbox + privacy/terms links)
  - Terms page: https://mowgoapp.com/#/terms (was missing)
  - Capture function: /api/sms-optin → Supabase table sms_optins (migration 024) — tested live
  - Screenshot: https://mowgoapp.com/sms-optin-screenshot.png
- New consent text (paste in Edit Campaign): see below
- NOTE: cold outreach to directory leads is separate from the opt-in page — page satisfies TCR proof; queue sends remain gated on approval.

## REJECTED 30913 (marketing/non-marketing consent mixing) → FIXED, RESUBMIT 2026-08-05
- Error: opt-in combined marketing consent with informational/transactional consent.
- Fix (commit 644c6fb, db288c6): page consent now MARKETING-ONLY + campaign-scoped:
  "I agree to receive marketing text messages from MowGo about lawn care pricing reports and offers. This consent is separate from any informational or transactional messages. Message & data rates may apply. Reply STOP to opt out. Consent applies only to MowGo and this campaign." — "product updates" removed; screenshot refreshed at same URL.
- Twilio consent field (paste): see below.

## Queue/sender
- Queue: leads/sms_queue.json (23 leads, tier priority)
- Sender: scripts/send_sms.py (10/day cap, weekdays 9am CT via cron 3f67268baeb6)
- Sends auto-retry daily until campaign approval; then texts start automatically
- Day-2/Day-7 follow-ups: extend send_sms.py after Day-1 wave clears
- Reply poller: TODO after approval (poll API inbound, post to #🌱mowgo-outreach)
