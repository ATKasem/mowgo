#!/usr/bin/env python3
"""MowGo Email Campaign Tracker — generates weekly funnel report.
Reads master_leads.json for sent/replied/bounced stats.
Delivers to stdout for cron delivery."""

import json
from datetime import datetime, timedelta

LEADS = "/opt/data/mowgo/leads/master_leads.json"
LOG = "/opt/data/mowgo/leads/email_replies_log.json"

with open(LEADS) as f:
    data = json.load(f)

leads = data["leads"]
stats = data["stats"]

# Count pipeline stages
total = len(leads)
sent = [l for l in leads if l.get("sent")]
sent_today = [l for l in sent if l.get("sent_date", "").startswith(datetime.now().strftime("%Y-%m-%d"))]
unsent_verified = [l for l in leads if l.get("verified_email") and not l.get("sent")]
bounced = [l for l in leads if l.get("last_event") == "bounced"]
replied = [l for l in leads if l.get("last_event") == "replied"]

# Read reply log if exists
replies = []
try:
    with open(LOG) as f:
        replies = json.load(f)
except:
    pass

# Weekly stats
week_ago = datetime.now() - timedelta(days=7)
sent_this_week = [l for l in sent if l.get("sent_date", "") and datetime.fromisoformat(l["sent_date"]) > week_ago]
replies_this_week = [r for r in replies if datetime.fromisoformat(r["timestamp"]) > week_ago]

print("📊 MOWGO EMAIL CAMPAIGN — WEEKLY REPORT")
print(f"{'='*50}")
print(f"Period: {week_ago.strftime('%b %d')} – {datetime.now().strftime('%b %d')}")
print(f"")
print(f"📤 PIPELINE")
print(f"  Total leads:       {total}")
print(f"  Unsent & verified: {len(unsent_verified)}")
print(f"  Sent all time:     {len(sent)}")
print(f"  Sent this week:    {len(sent_this_week)}")
print(f"  Sent today:        {len(sent_today)}")
print(f"")
print(f"📬 RESPONSES")
print(f"  Replies this week: {len(replies_this_week)}")
print(f"  Total replies:     {len(replies)}")
print(f"  Bounced:           {len(bounced)}")
print(f"")
print(f"📈 RATES")
sent_count = len(sent) if len(sent) > 0 else 1
print(f"  Reply rate:        {len(replies)/sent_count*100:.1f}% ({len(replies)}/{len(sent)})")
print(f"  Bounce rate:       {len(bounced)/sent_count*100:.1f}% ({len(bounced)}/{len(sent)})")
print(f"  Pipeline left:     {len(unsent_verified)//100} days @ 100/day")
print(f"")

if replies_this_week:
    print(f"💬 RECENT REPLIES")
    for r in replies_this_week[-5:]:
        print(f"  [{r['timestamp'][:10]}] {r.get('from_name','?')}: \"{r.get('body','')[:100]}\"")
    print("")

print(f"✅ Next send: Mon 8:07am CT")