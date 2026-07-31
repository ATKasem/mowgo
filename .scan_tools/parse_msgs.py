#!/usr/bin/env python3
"""Parse the persisted Discord fetch output for #mowgo."""
import json, sys

path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hermes-results/call_00_ZWehmLBCcEvPqHNmuOAg5826.txt'
with open(path) as f:
    data = json.load(f)
msgs = data['messages']
print(f"total messages: {len(msgs)}")
for m in msgs:
    author = m['author']['username']
    ts = m['timestamp']
    content = m['content'].replace('\n', ' ')[:160]
    print(f"{ts} | {author} | {m['id']} | {content}")
