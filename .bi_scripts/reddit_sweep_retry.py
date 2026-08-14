#!/usr/bin/env python3
"""Retry failed subs from reddit_sweep with longer pacing."""
import json, time, urllib.request, xml.etree.ElementTree as ET

SUBS = ["lawncare", "landscaping", "smallbusiness", "sweatystartup", "Entrepreneur", "CRM"]
NS = {"a": "http://www.w3.org/2005/Atom"}
out = []
for sub in SUBS:
    url = f"https://www.reddit.com/r/{sub}/new/.rss?limit=25"
    ok = False
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) MowGo-BI/1.1 (monitoring; retry)"})
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read().decode("utf-8", "replace")
            root = ET.fromstring(data)
            entries = []
            for e in root.findall("a:entry", NS):
                title = e.findtext("a:title", "", NS)
                l = e.find("a:link", NS)
                link = l.get("href", "") if l is not None else ""
                updated = e.findtext("a:updated", "", NS)
                entries.append({"sub": sub, "title": title, "url": link, "updated": updated})
            out.extend(entries)
            print(f"OK   r/{sub}: {len(entries)} entries (attempt {attempt+1})", flush=True)
            ok = True
            break
        except Exception as ex:
            print(f"FAIL r/{sub} attempt {attempt+1}: {ex}", flush=True)
            time.sleep(15 + attempt * 10)
    if not ok:
        print(f"GAVE UP r/{sub}", flush=True)
    time.sleep(25)

with open("/opt/data/mowgo/.bi_scripts/reddit_sweep_retry_out.json", "w") as f:
    json.dump(out, f, indent=1)
print("RETRY TOTAL:", len(out), flush=True)
