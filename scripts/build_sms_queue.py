#!/usr/bin/env python3
"""Build sms_queue.json from sms-scripts-batch1.md + tracker extras. Re-runnable."""
import re, json, pathlib

BASE = pathlib.Path("/opt/data/mowgo/leads")
raw = (BASE / "sms-scripts-batch1.md").read_text()

# priority tiers from the SEND ORDER section (number -> tier)
TIERS = {}
cur = None
for line in raw.splitlines():
    if line.startswith("**Tier"):
        m = re.search(r"\d", line)
        cur = "tier" + (m.group(0) if m else "3")
    elif line.startswith("## "):
        cur = None
    elif cur:
        for n in re.findall(r"(\d+)\s+[A-Za-z&']", line.strip()):
            TIERS[int(n)] = cur

leads = []
for m in re.finditer(r"^### (\d+)\. (.+?) \(([^)]*)\) — \(([\d\- ]+)\)", raw, re.M):
    num, name, city, phone = int(m.group(1)), m.group(2).strip(), m.group(3).strip(), m.group(4).strip()
    seg = raw[m.end():m.end()+2500]
    def day(n):
        mm = re.search(rf"- Day {n}: \"(.+?)\"", seg, re.S)
        return mm.group(1).strip() if mm else ""
    leads.append({"id": num, "name": name, "city": city,
                  "phone": "+1" + re.sub(r"\D", "", phone),
                  "day1": day(1), "day2": day(2), "day7": day(7),
                  "tier": TIERS.get(num, "tier3"), "status": "new",
                  "sent_at": None, "last_status": None})

# extras from Rule-of-100 (tracker leads with phones, not in batch1)
extras = [
 {"id": "t0-1", "name": "NG Outdoor", "city": "Edmond", "phone": "+14055883185",
  "day1": "Hey, this is Aaron. Saw NG Outdoor in Edmond — most crews your size schedule by phone. I made a one-page OKC rate report. Want it? Free.",
  "day2": "", "day7": "", "tier": "tier0", "status": "new", "sent_at": None, "last_status": None},
 {"id": "t0-2", "name": "Frankies Lawn Care", "city": "Norman", "phone": "+14057192170",
  "day1": "Hey, this is Aaron. Saw Frankies expanding from Norman into Noble and Slaughterville. I made a one-page Norman rate report. Want it? Free.",
  "day2": "", "day7": "", "tier": "tier0", "status": "new", "sent_at": None, "last_status": None},
]
existing = {l["phone"] for l in leads}
for e in extras:
    if e["phone"] not in existing:
        leads.append(e); existing.add(e["phone"])

json.dump(leads, open(BASE / "sms_queue.json", "w"), indent=2)
no_d1 = [l["name"] for l in leads if not l["day1"]]
print(f"Queue: {len(leads)} leads ({len([l for l in leads if l['tier']=='tier0'])} tier0, "
      f"{len([l for l in leads if l['tier']=='tier1'])} tier1, {len([l for l in leads if l['tier']=='tier2'])} tier2, "
      f"{len([l for l in leads if l['tier']=='tier3'])} tier3)")
print("Missing day1 text:", no_d1 or "none")
