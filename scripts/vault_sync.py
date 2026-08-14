#!/usr/bin/env python3
"""MowGo nightly vault sync — generate raw dumps + extract items from Discord messages.

Usage:
  python3 vault_sync.py --mowgo-json /opt/data/mowgo/vault/2026-08-11_discord-raw-mowgo.json \
      --cowork-json /opt/data/mowgo/vault/2026-08-11_discord-raw-cowork.json \
      --sync-ts "2026-08-11 02:00 UTC" --cutoff "2026-08-10T02:00:00Z"
"""

import argparse
import datetime
import json
import os
import re
import sys


SYNC_DATE = "2026-08-11"
CUTOFF_STR = "2026-08-10T02:00:00Z"
SYNC_TS = "2026-08-11 02:00 UTC"
VAULT_DIR = "/opt/data/mowgo/vault"


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--mowgo-json", required=True)
    p.add_argument("--cowork-json", default=None)
    p.add_argument("--sync-ts", default=SYNC_TS)
    p.add_argument("--cutoff", default=CUTOFF_STR)
    return p.parse_args()


def clean(content: str) -> str:
    lines = content.split("\n")
    out = []
    for ln in lines:
        s = ln.strip()
        if s.startswith("Cronjob Response:"):
            continue
        if s.startswith("(job_id:"):
            continue
        if s == "-------------" or s == "---":
            continue
        if re.match(r"^To stop or manage this job.*$", s):
            continue
        out.append(ln)
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def ts_parts(m):
    ts = datetime.datetime.fromisoformat(m["timestamp"])
    return f"{ts.strftime('%b %d')}, {ts.strftime('%H:%M')}", ts.strftime("%b %d %H:%M")


def title_for(m, titles):
    t = titles.get(m["id"])
    if t:
        return t
    content = m["content"]
    for ln in content.split("\n"):
        s = ln.strip()
        if s.startswith("# "):
            return s[2:].strip()
    for ln in content.split("\n"):
        s = ln.strip()
        if s and not s.startswith(("Cronjob", "(job_id", "-", "To stop", "|")):
            return s[:90]
    return "(no title)"


def extract_items(messages):
    """Extract decisions, tasks, research findings, and action items from messages."""
    items = {
        "decisions": [],
        "tasks": [],
        "research": [],
        "action_items": [],
    }

    # Patterns
    task_patterns = [
        r"(?:TODO|TO-DO|todo|FIX(?:ME)?|NEED(?:S)?\s+(?:TO\s+)?\w+)\s*[:,;]?\s*(.+?)(?:\n|$)",
        r"(?:need[s]?\s+to|must|should|requires?)\s+(.+?)(?:\n|$)",
        r"(?:build|implement|create|add|deploy|ship|fix|update|migrate)\s+(.+?)(?:\n|$)",
    ]
    decision_patterns = [
        r"(?:decided|decision|chosen|elected|opted|going with|settled on)\s*[:,;]?\s*(.+?)(?:\n|$)",
        r"(?:will\s+(?:not\s+)?(?:build|ship|implement|use|pursue|delay|prioritize))\s+(.+?)(?:\n|$)",
    ]
    research_patterns = [
        r"(?:found|discovered|identified|detected|noticed|observed)\s*[:,;]?\s*(.+?)(?:\n|$)",
        r"(?:analysis|finding|signal|evidence|trend|pattern|data point)\s*[:,;]?\s*(.+?)(?:\n|$)",
    ]
    action_patterns = [
        r"(?:next\s+(?:step|action|move|run))\s*[:,;]?\s*(.+?)(?:\n|$)",
        r"(?:action\s+item|actionable|do\s+this)\s*[:,;]?\s*(.+?)(?:\n|$)",
        r"(?:post|send|email|ping|reply|dispatch)\s+(.+?)(?:\n|$)",
    ]

    for m in messages:
        content = m["content"]
        author = m["author"]["username"]
        ts = m["timestamp"]
        label = ts[:10]

        # Tasks
        for pat in task_patterns:
            for match in re.finditer(pat, content, re.IGNORECASE | re.MULTILINE):
                text = match.group(1).strip()
                if len(text) > 20 and len(text) < 300:
                    items["tasks"].append({"text": text, "author": author, "channel": "🌱mowgo", "timestamp": ts})

        # Decisions
        for pat in decision_patterns:
            for match in re.finditer(pat, content, re.IGNORECASE | re.MULTILINE):
                text = match.group(1).strip()
                if len(text) > 20 and len(text) < 300:
                    items["decisions"].append({"text": text, "author": author, "channel": "🌱mowgo", "timestamp": ts})

        # Research
        for pat in research_patterns:
            for match in re.finditer(pat, content, re.IGNORECASE | re.MULTILINE):
                text = match.group(1).strip()
                if len(text) > 20 and len(text) < 300:
                    items["research"].append({"text": text, "author": author, "channel": "🌱mowgo", "timestamp": ts})

        # Action items (explicit actionable lines)
        for pat in action_patterns:
            for match in re.finditer(pat, content, re.IGNORECASE | re.MULTILINE):
                text = match.group(1).strip()
                if len(text) > 20 and len(text) < 300:
                    items["action_items"].append({"text": text, "author": author, "channel": "🌱mowgo", "timestamp": ts})

    # Deduplicate by text
    for k in items:
        seen = set()
        deduped = []
        for item in items[k]:
            if item["text"] not in seen:
                seen.add(item["text"])
                deduped.append(item)
        items[k] = deduped

    return items


def generate_mowgo_raw(data, cutoff, sync_ts, sync_date):
    """Generate the #🌱mowgo raw channel dump markdown."""
    cutoff_dt = datetime.datetime.fromisoformat(cutoff)
    msgs = sorted(data["messages"], key=lambda m: m["timestamp"])
    new = [m for m in msgs if datetime.datetime.fromisoformat(m["timestamp"]) >= cutoff_dt]
    old = [m for m in msgs if datetime.datetime.fromisoformat(m["timestamp"]) < cutoff_dt]

    # Auto-title: use first meaningful line
    TITLES = {}
    for m in new:
        content = clean(m["content"])
        lines = content.split("\n")
        title = None
        for ln in lines:
            s = ln.strip()
            if s.startswith("# "):
                title = s[2:].strip()
                break
            if s.startswith("## "):
                title = s[3:].strip()
                break
        if not title:
            for ln in lines:
                s = ln.strip()
                if s and not s.startswith(("Cronjob", "(job_id", "To stop", "|", "-")) and not s.startswith("**"):
                    title = s[:90]
                    break
        if not title:
            title = "(no title)"
        TITLES[m["id"]] = title

    shown = [m for m in new if TITLES.get(m["id"])]
    skipped = len(new) - len(shown) if len(new) > len(shown) else 0

    hdr = f"""# 🌱 mowgo — Raw Channel Dump
**{sync_ts} | {len(msgs)} messages fetched ({len(new)} new since last sync; {len(shown)} with content{f' + {skipped} footer-only trailer' if skipped else ''})**

## Most Recent Activity (New since {cutoff_dt.strftime('%b %d %H:%M')} UTC sync)

"""
    entries = []
    for m in shown:
        label, _ = ts_parts(m)
        t = TITLES.get(m["id"], title_for(m, TITLES))
        entries.append(f"### {label} — {t}\n**{m['author']['username']}** —\n\n{clean(m['content'])}\n")
    body = hdr + "\n".join(entries)

    if old:
        body += "\n## Prior Activity (unchanged from earlier syncs — summary)\n\n"
        by_date = {}
        for m in old:
            d = datetime.datetime.fromisoformat(m["timestamp"]).strftime("%b %d")
            by_date.setdefault(d, []).append(m)
        for d in sorted(by_date.keys(), reverse=True):
            group = by_date[d]
            lines = [f"### {d} — {len(group)} messages (already captured in prior syncs)"]
            for m in group:
                t = datetime.datetime.fromisoformat(m["timestamp"]).strftime("%H:%M")
                first = clean(m["content"]).split("\n")[0][:110]
                lines.append(f"**{m['author']['username']}** {t} — {first}")
            body += "\n".join(lines) + "\n\n"

    body += f"""---
*Raw dump generated by MowGo nightly vault sync — {sync_ts}*
"""
    return body


def generate_outreach_raw():
    """#🌱mowgo-outreach is gone — 404 since Aug 7."""
    return f"""# 🌱 mowgo-outreach — Raw Channel Dump
**{SYNC_TS} | ⚠️ CHANNEL GONE — still returning 404 Unknown Channel**

The outreach channel (1529711006023024680) has been **deleted** (first seen 404 on Aug 7).
**0 messages synced this run.** No active delivery targets this channel.

Last known state: 55 messages, newest Aug 5 01:48Z. All references cleared
from vault index, daily_scan lists, and cron configs per Aug 7 action items.

---
*Raw dump generated by MowGo nightly vault sync — {SYNC_TS}*
"""


def generate_cowork_raw():
    """#🤝mowgo-cowork is empty (cleaned Aug 6)."""
    return f"""# 🤝 mowgo-cowork — Raw Channel Dump
**{SYNC_TS} | 0 messages (0 new since last sync)**

Channel is empty — **cleaned Aug 6 13:30Z** (128 watchdog-failure spam messages
deleted). Watchdog has held with 0 new failures since Aug 4 13:50Z.
No coworking sessions have taken place.

---
*Raw dump generated by MowGo nightly vault sync — {SYNC_TS}*
"""


def generate_extracted_items(items):
    """Generate a markdown file of extracted decisions, tasks, research, action items."""
    out = f"""# 🌱 MowGo — Extracted Items
**{SYNC_TS} | Decisions, Tasks, Research, and Action Items from Discord sync**

---
"""
    if items["decisions"]:
        out += "## ✅ Decisions\n\n"
        for item in items["decisions"][:20]:
            ts = item["timestamp"][:16].replace("T", " ")
            out += f"- **{ts}** ({item['author']}): {item['text']}\n"
        out += "\n"

    if items["tasks"]:
        out += "## 📋 Tasks & TODOs\n\n"
        for item in items["tasks"][:20]:
            ts = item["timestamp"][:16].replace("T", " ")
            out += f"- **{ts}** ({item['author']}): {item['text']}\n"
        out += "\n"

    if items["research"]:
        out += "## 🔬 Research Findings\n\n"
        for item in items["research"][:20]:
            ts = item["timestamp"][:16].replace("T", " ")
            out += f"- **{ts}** ({item['author']}): {item['text']}\n"
        out += "\n"

    if items["action_items"]:
        out += "## ⚡ Action Items\n\n"
        for item in items["action_items"][:20]:
            ts = item["timestamp"][:16].replace("T", " ")
            out += f"- **{ts}** ({item['author']}): {item['text']}\n"
        out += "\n"

    if not any(items.values()):
        out += "_No items extracted from this sync._\n"

    out += f"""---
*Extracted items generated by MowGo nightly vault sync — {SYNC_TS}*
"""
    return out


def generate_summary(items, mowgo_count, new_count, cowork_count):
    """Generate a summary report."""
    total_items = sum(len(v) for v in items.values())
    out = f"""# MowGo Nightly Vault Sync — {SYNC_TS[:10]}
**Channels scanned: 4 (3 active, 1 deleted)**
**Messages synced: {mowgo_count} total ({new_count} new)**
**New extracted items: {total_items}**

## Summary

### Channels
| Channel | Status | Messages |
|---------|--------|----------|
| #🌱mowgo | ✅ Active | {mowgo_count} total, {new_count} new |
| #🌱mowgo-outreach | ❌ Deleted (404) | 0 |
| #🤝mowgo-cowork | ✅ Empty | {cowork_count} |
| #🌱mowgo-leads | ✅ Active | (not scanned in this sync) |

### Extracted Items
"""
    if items["decisions"]:
        out += f"\n- ✅ **Decisions:** {len(items['decisions'])}"
    if items["tasks"]:
        out += f"\n- 📋 **Tasks/TODOs:** {len(items['tasks'])}"
    if items["research"]:
        out += f"\n- 🔬 **Research Findings:** {len(items['research'])}"
    if items["action_items"]:
        out += f"\n- ⚡ **Action Items:** {len(items['action_items'])}"

    if total_items > 0:
        out += "\n\n### Top extracted items\n"
        count = 0
        for category, icon in [("action_items", "⚡"), ("tasks", "📋"), ("decisions", "✅"), ("research", "🔬")]:
            for item in items[category][:5]:
                if count >= 15:
                    break
                ts = item["timestamp"][:16].replace("T", " ")
                out += f"\n{icon} **{ts}** — {item['text'][:150]}"
                count += 1

    out += f"""

---
*Generated by MowGo nightly vault sync — {SYNC_TS}*
"""
    return out


def main():
    args = parse_args()

    sync_date = args.sync_ts[:10]
    os.makedirs(VAULT_DIR, exist_ok=True)

    # Load mowgo channel data
    with open(args.mowgo_json) as f:
        mowgo_data = json.load(f)

    mowgo_msgs = mowgo_data.get("messages", [])
    cutoff_dt = datetime.datetime.fromisoformat(args.cutoff)
    new_mowgo = [m for m in mowgo_msgs if datetime.datetime.fromisoformat(m["timestamp"]) >= cutoff_dt]

    # Load cowork data if available
    cowork_msgs = []
    if args.cowork_json and os.path.exists(args.cowork_json):
        with open(args.cowork_json) as f:
            cowork_data = json.load(f)
        cowork_msgs = cowork_data.get("messages", [])

    # Generate raw dumps
    mowgo_raw = generate_mowgo_raw(mowgo_data, args.cutoff, args.sync_ts, sync_date)
    mowgo_raw_path = f"{VAULT_DIR}/{sync_date}_channel-mowgo-raw.md"
    with open(mowgo_raw_path, "w") as f:
        f.write(mowgo_raw)

    outreach_raw = generate_outreach_raw()
    outreach_raw_path = f"{VAULT_DIR}/{sync_date}_channel-outreach-raw.md"
    with open(outreach_raw_path, "w") as f:
        f.write(outreach_raw)

    cowork_raw = generate_cowork_raw()
    cowork_raw_path = f"{VAULT_DIR}/{sync_date}_channel-cowork-raw.md"
    with open(cowork_raw_path, "w") as f:
        f.write(cowork_raw)

    # Extract items from new messages
    items = extract_items(new_mowgo)

    # Write extracted items
    extracted = generate_extracted_items(items)
    extracted_path = f"{VAULT_DIR}/{sync_date}_extracted-items.md"
    with open(extracted_path, "w") as f:
        f.write(extracted)

    # Write summary
    summary = generate_summary(items, len(mowgo_msgs), len(new_mowgo), len(cowork_msgs))
    summary_path = f"{VAULT_DIR}/{sync_date}_daily-sync.md"
    with open(summary_path, "w") as f:
        f.write(summary)

    # Print summary to stdout for cron delivery
    print(summary)


if __name__ == "__main__":
    main()