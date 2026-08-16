Read the spec at docs/plans/rates-lead-magnet-spec.md and the RouteAudit reference files (client/src/pages/RouteAudit.jsx, functions/api/route-audit.js, client/src/App.jsx), then build all files. Create the files. Update App.jsx with the route. Then run node --check on both new files.

IMPORTANT: The email HTML content in the spec has Southeast Oklahoma city data. Use EXACTLY this data for the email HTML (hardcode the tables):

City prices table:
Broken Arrow $67.08
Claremore $65.13
Yukon $59.36
Edmond $58.02
Tulsa $56.93
Oklahoma City $54.73
Norman $52.89
Guthrie $51.22
Chickasha $50.82
Bethany $48.01

State average: $55.25

Yard size table in email:
1/8 acre: Weekly $30.39, Bi-weekly $34.81, Monthly $35.36
1/4 acre: Weekly $39.78, Bi-weekly $45.31, Monthly $46.96
1/3 acre: Weekly $52.49, Bi-weekly $53.04, Monthly $60.22
1/2 acre: Weekly $65.75, Bi-weekly $75.70, Monthly $78.46
1 acre: Weekly $102.22, Bi-weekly $107.19, Monthly $119.34

Revenue section in email: $52.49/cut → ~$1,365/yr per customer (26 cuts) → 20 customers = $27,300/yr → 30 customers = $41,000/yr. Extras add 30%+.

Caveats in email: (1) market sets ceiling, your work sets price (2) yard size dominates (3) raise on new customers, grandfather loyal (4) reliability > rate bump

Footer: "Built by MowGo — scheduling, routing, and invoicing for Oklahoma lawn crews. Data: LawnStarter OK market, refreshed August 2026."

The lead_touches insert should use these column names:
source = 'rates_report'
lead_email
kind = 'instant' / 'day3' / 'day7'
channel = 'email'
status = 'sent' / 'queued'
sent_at

Use Prefer: 'return=minimal,resolution=ignore-duplicates' header just like route-audit does.

For the Resend email, use:
From: 'MowGo <invoices@mowgoapp.com>'
Reply-To: 'Hermes <hermes.assistant.job@gmail.com>'
Subject: 'Your Oklahoma Lawn Rates Report — What to Charge in Your City'

Do NOT use any i18n translation keys in Rates.jsx — hardcoded English only (like SmsOptIn.jsx uses).