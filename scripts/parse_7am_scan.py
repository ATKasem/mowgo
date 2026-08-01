#!/usr/bin/env python3
"""Parse the fetched mowgo channel dump, list messages since last 7am scan."""
import json, datetime

SRC = '/tmp/hermes-results/call_00_KsXpWgVuaHoZ0EUX8YJs0164.txt'
CUTOFF = datetime.datetime(2026, 7, 31, 12, 5, 0, tzinfo=datetime.timezone.utc)

with open(SRC) as f:
    data = json.load(f)

msgs = sorted(data['messages'], key=lambda m: m['timestamp'])
new = [m for m in msgs if datetime.datetime.fromisoformat(m['timestamp']) >= CUTOFF]

print(f"TOTAL fetched: {len(msgs)} | Since last 7am scan ({CUTOFF}): {len(new)}")
print("=" * 100)
for m in new:
    ts = datetime.datetime.fromisoformat(m['timestamp'])
    print(f"\n--- {ts.strftime('%b %d %H:%M')}Z | {m['author']['username']} | id={m['id']} ---")
    content = m['content']
    # first 400 chars, then ellipsis marker if longer
    lines = content.split('\n')
    shown = '\n'.join(lines[:12])
    if len(lines) > 12 or len(content) > 1200:
        shown += f"\n...[TRUNCATED, total {len(lines)} lines / {len(content)} chars]"
    print(shown)
