#!/usr/bin/env python3
"""Analyze the fetched mowgo channel messages."""
import json
import datetime

SRC = '/tmp/hermes-results/call_00_lzl1dovwPa12er2B6dNG8192.txt'
with open(SRC) as f:
    data = json.load(f)

msgs = data['messages']
print('total messages:', len(msgs))
msgs_sorted = sorted(msgs, key=lambda m: m['timestamp'])
print('oldest:', msgs_sorted[0]['timestamp'], msgs_sorted[0]['id'])
print('newest:', msgs_sorted[-1]['timestamp'], msgs_sorted[-1]['id'])

cutoff = datetime.datetime(2026, 7, 31, 2, 0, 0, tzinfo=datetime.timezone.utc)
new = [m for m in msgs_sorted if datetime.datetime.fromisoformat(m['timestamp']) >= cutoff]
print('new since 2026-07-31 02:00 UTC:', len(new))

from collections import Counter
print('authors overall:', Counter(m['author']['username'] for m in msgs_sorted))
print('authors new:', Counter(m['author']['username'] for m in new))

print()
print('=== CHRONOLOGICAL LISTING ===')
for m in msgs_sorted:
    ts = m['timestamp']
    author = m['author']['username']
    content = m['content'][:120].replace('\n', ' ')
    flag = 'NEW' if datetime.datetime.fromisoformat(ts) >= cutoff else 'old'
    print(f"[{flag:3}] {ts} {author:14} {m['id']} | {content}")
