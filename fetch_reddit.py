#!/usr/bin/env python3
"""Fetch Reddit thread JSON and print title, date, and text."""
import json, sys, urllib.request
from datetime import datetime, timezone

url = sys.argv[1]
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.load(resp)
    post = data[0]['data']['children'][0]['data']
    title = post.get('title','')
    selftext = post.get('selftext','')
    created = post.get('created_utc',0)
    ts = datetime.fromtimestamp(created, tz=timezone.utc).isoformat()
    print(f"URL: {url}")
    print(f"Title: {title}")
    print(f"Created: {ts}")
    print(f"Selftext: {selftext[:800]}")
    # Also grab top comments
    print("\n--- TOP COMMENTS ---")
    for child in data[1]['data']['children'][:6]:
        if child['kind'] == 't1':
            c = child['data']
            print(f'[{c.get("score",0)}] {c.get("author","?")}: {c.get("body","")[:300]}')
    print("--- END ---")
except Exception as e:
    print(f"ERROR: {e}")
