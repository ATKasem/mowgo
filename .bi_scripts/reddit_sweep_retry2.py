#!/usr/bin/env python3
"""Paced retry for subs that 429'd + fetch top candidate thread content."""
import json, time, urllib.request, xml.etree.ElementTree as ET

SUBS = ["lawncare", "landscaping", "smallbusiness", "sweatystartup", "CRM", "WhichCRM"]
NS = {"a": "http://www.w3.org/2005/Atom"}
out = []
for sub in SUBS:
    url = f"https://www.reddit.com/r/{sub}/new/.rss?limit=25"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"})
    entries = []
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
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
    time.sleep(18)  # longer pacing to dodge 429

with open("/opt/data/mowgo/.bi_scripts/reddit_sweep_retry_out.json", "w") as f:
    json.dump(out, f, indent=1)
print("TOTAL:", len(out))
