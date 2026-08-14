#!/usr/bin/env python3
"""Summarize a persisted discord fetch_messages JSON output for review."""
import json, sys, datetime

path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/hermes-results/call_01_XqbVKyezj1DOoC8QwzFY0410.txt"
with open(path) as f:
    data = json.load(f)

msgs = sorted(data['messages'], key=lambda m: m['timestamp'])
print(f"TOTAL: {len(msgs)} messages\n")
for m in msgs:
    ts = m['timestamp']
    author = m['author']['username']
    bot = m['author'].get('bot', False)
    content = m['content'].replace('\n', ' ⏎ ')[:400]
    print(f"--- {ts} | {author} | bot={bot} | id={m['id']}")
    print(f"    {content}\n")
