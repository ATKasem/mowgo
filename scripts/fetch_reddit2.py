#!/usr/bin/env python3
"""Fetch Reddit thread JSON with better User-Agent."""
import json, sys, urllib.request
from datetime import datetime, timezone

url = sys.argv[1]
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
})
try:
    resp = urllib.request.urlopen(req, timeout=15)
    data = json.load(resp)
    post = data[0]['data']['children'][0]['data']
    title = post.get('title','')
    selftext = post.get('selftext','')
    created = post.get('created_utc',0)
    num_comments = post.get('num_comments',0)
    ups = post.get('ups',0)
    ts = datetime.fromtimestamp(created, tz=timezone.utc).isoformat()
    subreddit = post.get('subreddit','')
    url_perm = post.get('permalink','')
    print(f"Title: {title}")
    print(f"Subreddit: r/{subreddit}")
    print(f"Created: {ts}")
    print(f"Score: {ups} | Comments: {num_comments}")
    print(f"URL: https://www.reddit.com{url_perm}")
    if selftext:
        print(f"Selftext: {selftext[:600]}")
    print("\n--- TOP COMMENTS ---")
    count = 0
    for child in data[1]['data']['children']:
        if child['kind'] == 't1':
            c = child['data']
            print(f'[{c.get("score",0)}] u/{c.get("author","?")}: {c.get("body","")[:300]}')
            count += 1
            if count >= 5:
                break
    print("--- END ---")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.reason}")
    print(f"URL tried: {url}")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
