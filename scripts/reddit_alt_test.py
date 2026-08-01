#!/usr/bin/env python3
"""Try alternate Reddit access paths (old.reddit, different UAs)."""
import urllib.request, json, sys

urls = [
    "https://old.reddit.com/r/LawnCarePros/comments/1v6ce6e.json?limit=3",
    "https://www.reddit.com/r/LawnCarePros/new/.json?limit=5",
    "https://api.reddit.com/r/sweatystartup/new?limit=5",
]
uas = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
]
for u in urls:
    for ua in uas:
        try:
            req = urllib.request.Request(u, headers={"User-Agent": ua, "Accept": "application/json"})
            r = urllib.request.urlopen(req, timeout=12)
            body = r.read()[:200].decode("utf-8", "replace")
            print(f"OK  {u[:55]} | {ua[:30]} -> {r.status} {body[:80]}")
            sys.exit(0)
        except Exception as e:
            print(f"ERR {u[:55]} | {ua[:30]} -> {e}")
