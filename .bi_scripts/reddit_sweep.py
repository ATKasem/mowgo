#!/usr/bin/env python3
"""Paced Reddit RSS sweep for MowGo BI — parse titles, links, updated dates."""
import json, time, urllib.request, xml.etree.ElementTree as ET

SUBS = ["LawnCarePros", "lawncare", "landscaping", "smallbusiness",
        "sweatystartup", "Entrepreneur", "CRM", "WhichCRM"]

NS = {"a": "http://www.w3.org/2005/Atom"}
out = []
for sub in SUBS:
    url = f"https://www.reddit.com/r/{sub}/new/.rss?limit=25"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) MowGo-BI/1.0 (monitoring)"})
    entries = []
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read().decode("utf-8", "replace")
        root = ET.fromstring(data)
        for e in root.findall("a:entry", NS):
            title = e.findtext("a:title", "", NS)
            l = e.find("a:link", NS)
            link = l.get("href", "") if l is not None else ""
            updated = e.findtext("a:updated", "", NS)
            entries.append({"sub": sub, "title": title, "url": link, "updated": updated})
        print(f"OK   r/{sub}: {len(entries)} entries")
    except Exception as ex:
        print(f"FAIL r/{sub}: {ex}")
    out.extend(entries)
    time.sleep(6)  # pacing to avoid 429

with open("/opt/data/mowgo/.bi_scripts/reddit_sweep_out.json", "w") as f:
    json.dump(out, f, indent=1)
print("TOTAL:", len(out))
