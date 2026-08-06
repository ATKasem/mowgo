#!/usr/bin/env python3
"""Clean watchdog-failure spam from #🤝mowgo-cowork (channel 1529736297847980153).

Only deletes messages whose content contains 'Script not found' (the provider
failover watchdog failure text). Human messages are never matched. Dry-run mode
prints a plan without deleting (DRY_RUN=1)."""
import json
import os
import sys
import time
import urllib.request
import urllib.error

CHANNEL = "1529736297847980153"
TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
API = "https://discord.com/api/v10"
DRY_RUN = os.environ.get("DRY_RUN", "1") == "1"

def api(path, method="GET"):
    req = urllib.request.Request(API + path, method=method)
    req.add_header("Authorization", f"Bot {TOKEN}")
    req.add_header("User-Agent", "DiscordBot (https://github.com/Mowflow/mowflow, 1.0)")
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
        return json.loads(body) if body else None

def main():
    if not TOKEN:
        print("NO TOKEN"); sys.exit(2)
    # Paginate backwards through channel history
    spam, seen_authors, total = [], {}, 0
    before = None
    for page in range(12):  # up to ~1200 messages
        url = f"/channels/{CHANNEL}/messages?limit=100"
        if before:
            url += f"&before={before}"
        try:
            msgs = api(url)
        except urllib.error.HTTPError as e:
            print(f"FETCH ERROR {e.code}: {e.read().decode()[:200]}")
            sys.exit(1)
        if not msgs:
            break
        total += len(msgs)
        page_spam = [m for m in msgs if "Script not found" in (m.get("content") or "")]
        spam.extend(page_spam)
        for m in msgs:
            a = (m.get("author") or {}).get("username", "?")
            seen_authors[a] = seen_authors.get(a, 0) + 1
        before = msgs[-1]["id"]
        # Stop once a full page has no spam AND we are past the spam window
        if not page_spam and before:
            # peek: keep paginating only if we still saw spam recently
            pass
        if page > 0 and not page_spam:
            # two consecutive clean pages -> done
            break
        time.sleep(0.3)

    print(f"FETCHED {total} messages | spam matches: {len(spam)}")
    print("AUTHORS:", json.dumps(seen_authors))
    if spam:
        s = spam[0]
        print("SAMPLE:", json.dumps({
            "id": s["id"], "ts": s["timestamp"],
            "author": (s.get("author") or {}).get("username"),
            "content": (s.get("content") or "")[:160],
        }))
        t0, t1 = spam[0]["timestamp"], spam[-1]["timestamp"]
        print(f"SPAM RANGE: {t1} -> {t0}")
    if DRY_RUN:
        print("DRY RUN — no deletions. Set DRY_RUN=0 to delete.")
        return 0

    deleted, failed = 0, []
    for m in spam:
        for attempt in range(6):
            try:
                api(f"/channels/{CHANNEL}/messages/{m['id']}", method="DELETE")
                deleted += 1
                break
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    wait = float(e.headers.get("Retry-After", "1") or 1) + 0.25
                    time.sleep(wait)
                    continue
                failed.append((m["id"], e.code))
                break
        time.sleep(0.3)
    print(f"DELETED {deleted} | FAILED {len(failed)}")
    for f in failed[:10]:
        print("FAIL", f)
    return 0

if __name__ == "__main__":
    sys.exit(main())
