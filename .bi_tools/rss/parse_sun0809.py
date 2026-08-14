#!/usr/bin/env python3
"""BI sweep parser (Sun 2026-08-09): parse 8-sub RSS, dedupe vs state, report 48h new."""
import json, re, html, datetime, sys

STATE = "/opt/data/mowgo/.bi_state.json"
RSSDIR = "/opt/data/mowgo/.bi_tools/rss"
SUBS = ["lawncare", "smallbusiness", "landscaping", "sweatystartup",
        "Entrepreneur", "LawnCarePros", "CRM", "WhichCRM"]

def canon(url):
    u = url.strip().rstrip("/")
    u = re.sub(r"^https?://", "https://", u)
    u = u.split("?")[0].split("#")[0]
    return u.lower()

entries = []  # (sub, canon_url, title, updated_iso)
for sub in SUBS:
    path = f"{RSSDIR}/sweep_{sub}.xml"
    try:
        data = open(path, encoding="utf-8", errors="replace").read()
    except FileNotFoundError:
        print(f"{sub}: MISSING FILE"); continue
    if len(data) < 5000:
        print(f"{sub}: TOO SMALL ({len(data)})"); continue
    items = re.findall(r"<entry>(.*?)</entry>", data, re.S)
    for it in items:
        m = re.search(r'<link[^>]*href="([^"]+)"', it)
        if not m: continue
        url = canon(m.group(1))
        tm = re.search(r"<title>(.*?)</title>", it, re.S)
        title = html.unescape(re.sub(r"<[^>]+>", "", tm.group(1))).strip() if tm else ""
        pd = re.search(r"<updated>([^<]+)</updated>", it)
        date = pd.group(1)[:19] if pd else ""
        entries.append((sub, url, title, date))

state = json.load(open(STATE))
seen = {canon(u) for u in state["seen_reddit_urls"]}
print(f"Seen list: {len(seen)} (canonicalized) | Feed entries: {len(entries)}")

# 48h window
now = datetime.datetime(2026, 8, 9, 10, 0, 0)  # ~run time UTC
cutoff = now - datetime.timedelta(hours=48)
def parse_dt(s):
    try:
        return datetime.datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None

new_all, new_48h = [], []
for sub, url, title, date in entries:
    if url in seen:
        continue
    new_all.append((sub, url, title, date))
    dt = parse_dt(date)
    if dt and dt >= cutoff:
        new_48h.append((sub, url, title, date))

print(f"\nNEW total (never seen): {len(new_all)}")
print(f"NEW within 48h window: {len(new_48h)}")
print("\n=== 48h new entries ===")
for sub, url, title, date in sorted(new_48h, key=lambda x: x[3], reverse=True):
    print(f"{date} | r/{sub} | {url} | {title[:100]}")

# on-ICP heuristic for 48h entries
ICP = re.compile(r"(lawn|landscap|mow|mowing|yard|grass|crew|schedul|invoice|software|crm|app|jobber|client|customer|price|pricing|quote|estimate|pay)", re.I)
print("\n=== 48h entries matching ICP-ish keywords ===")
for sub, url, title, date in sorted(new_48h, key=lambda x: x[3], reverse=True):
    if ICP.search(title):
        print(f"{date} | r/{sub} | {url} | {title[:110]}")

# save new URLs for state update
with open(f"{RSSDIR}/new_urls_2026-08-09.json", "w") as f:
    json.dump([u for _, u, _, _ in new_all], f)
print(f"\nSaved {len(new_all)} new URLs to new_urls_2026-08-09.json")
