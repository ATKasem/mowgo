#!/usr/bin/env python3
"""Deliver a content batch for posting. Reads the pre-generated batch JSON
and outputs formatted content for the user to post."""
import json, os, sys

batch_idx = int(sys.argv[1]) if len(sys.argv) > 1 else 1
hour_map = {1: 8, 2: 10, 3: 12, 4: 14, 5: 16}
hour = hour_map.get(batch_idx, 8)

dir_path = "/opt/data/mowgo/leads/content"
# Find today's batch
import glob
files = sorted(glob.glob(os.path.join(dir_path, f"batch_*_{hour:02d}00.json")))
if not files:
    print(f"No batch found for hour {hour}:00. Run content_50x.py first.")
    sys.exit(0)

batch = json.load(open(files[-1]))
print(f"=== BATCH {batch_idx} — {hour}:00 ({len(batch.get('fb',[]))} FB + {len(batch.get('ig',[]))} IG) ===\n")
print("--- FACEBOOK POSTS ---")
for i, fb in enumerate(batch.get("fb", []), 1):
    print(f"\n[FB {i}]")
    print(fb["post"])
    print()
print("--- INSTAGRAM CAPTIONS ---")
for i, ig in enumerate(batch.get("ig", []), 1):
    print(f"\n[IG {i}]")
    print(ig["caption"])
    print()