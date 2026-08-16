Do the following in order:

## 1. Apply the migration to the live Supabase database

Run: `npx supabase db query --linked --file supabase/migrations/20260816120000_lead_touches_rates_report.sql`

This widens the CHECK constraints on lead_touches to accept source='rates_report' and kind='day3'.

## 2. Update scripts/lead_nurture.py

The script currently processes kind='day2' and kind='day7'. Add kind='day3' support for the rates report funnel.

### Changes needed:

**a) Add day3 email content** — a rates-specific follow-up after they got the report. The hook: "How to raise prices" (they just got the rate data, now they need to act on it):

```python
# Day-3: rates report follow-up — how to raise prices (only for rates_report source)
DAY3_EMAIL_SUBJECT = "How to raise your prices (the right way)"
DAY3_EMAIL_HTML = (
    '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6">'
    '<h1>You got the rates. Now what?</h1>'
    '<p>The data in the report is real — but raising prices is where most crews freeze.</p>'
    '<p><strong>3 rules for a clean price bump:</strong></p>'
    '<ol>'
    '<li><strong>Raise on new customers first.</strong> Grandpa\'s Lawn Service doesn\'t know what your other customers pay. New prospects have nothing to compare against.</li>'
    '<li><strong>Grandfather your loyal ones.</strong> The customer who\'s been with you 3 years and pays on time? Keep them at their current rate. The value of a reliable payer beats a $5 bump.</li>'
    '<li><strong>Anchor with the high number.</strong> When quoting a new job, say "$65 for bi-weekly, $52 for weekly" — not "$52 for weekly, $65 for bi-weekly." The first number sets the anchor.</li>'
    '</ol>'
    '<p><a href="https://mowgoapp.com/#/">MowGo helps you track every client\'s rate, schedule, and history in one place →</a></p>'
    '</body></html>'
)
```

**b) Add day3 to EMAIL_CONTENT:**
```python
EMAIL_CONTENT = {"day2": (DAY2_EMAIL_SUBJECT, DAY2_EMAIL_HTML), "day3": (DAY3_EMAIL_SUBJECT, DAY3_EMAIL_HTML), "day7": (DAY7_EMAIL_SUBJECT, DAY7_EMAIL_HTML)}
```

**c) Add day3 to DAY_OFFSET:**
```python
DAY_OFFSET = {"day2": 2, "day3": 3, "day7": 7}
```

**d) Add day3 to the kind iteration loop** (around line 181):
Currently it does: `for kind in ("day2", "day7"):`
Change to: `for kind in ("day2", "day3", "day7"):`

That's it. After making these changes, verify the script parses correctly with: `python3 -c "import ast; ast.parse(open('scripts/lead_nurture.py').read()); print('syntax OK')"`

Do NOT change the day2 or day7 content — just add day3 support.