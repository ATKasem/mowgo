#!/usr/bin/env python3
"""Dump full content of new messages (since 2026-07-31 02:00 UTC) to a text file."""
import json
import datetime

SRC = '/tmp/hermes-results/call_00_lzl1dovwPa12er2B6dNG8192.txt'
OUT = '/opt/data/mowgo/vault/.tmp_new_messages.txt'

with open(SRC) as f:
    data = json.load(f)

cutoff = datetime.datetime(2026, 7, 31, 2, 0, 0, tzinfo=datetime.timezone.utc)
new = sorted(
    (m for m in data['messages'] if datetime.datetime.fromisoformat(m['timestamp']) >= cutoff),
    key=lambda m: m['timestamp'],
)

with open(OUT, 'w') as f:
    f.write(f"NEW MESSAGES: {len(new)}\n")
    f.write('=' * 80 + '\n')
    for m in new:
        f.write(f"\n--- {m['timestamp']} | {m['author']['username']} | id={m['id']} ---\n")
        f.write(m['content'])
        f.write('\n')

print(f"wrote {len(new)} messages to {OUT}")
