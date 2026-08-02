#!/usr/bin/env python3
"""Generate raw channel dump markdown files for the nightly vault sync.

Usage:
  python3 gen_raw_dumps.py --src <persisted tool-output json> \
      --cutoff 2026-08-01T02:00:00Z --sync-ts "2026-08-02 02:00 UTC"

The SRC file is the persisted output of the discord fetch_messages tool call
(saved under /tmp/hermes-results/). TITLES maps new-message ids to display
titles; a title of None skips the message (footer-only trailer).
"""
import argparse
import datetime
import json
import re


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--src', required=True)
    p.add_argument('--cutoff', required=True, help='ISO UTC cutoff for "new" messages')
    p.add_argument('--sync-ts', required=True, help='Display timestamp, e.g. 2026-08-02 02:00 UTC')
    return p.parse_args()


def clean(content: str) -> str:
    """Strip cron boilerplate from message content."""
    lines = content.split('\n')
    out = []
    for ln in lines:
        s = ln.strip()
        if s.startswith('Cronjob Response:'):
            continue
        if s.startswith('(job_id:'):
            continue
        if s == '-------------' or s == '---':
            continue
        if re.match(r'^To stop or manage this job.*$', s):
            continue
        out.append(ln)
    text = '\n'.join(out)
    # collapse 3+ blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def ts_parts(m):
    ts = datetime.datetime.fromisoformat(m['timestamp'])
    return f"{ts.strftime('%b %d')}, {ts.strftime('%H:%M')}", ts.strftime('%b %d %H:%M')


def title_for(m, titles):
    t = titles.get(m['id'])
    if t:
        return t
    content = m['content']
    for ln in content.split('\n'):
        s = ln.strip()
        if s.startswith('# '):
            return s[2:].strip()
    for ln in content.split('\n'):
        s = ln.strip()
        if s and not s.startswith(('Cronjob', '(job_id', '-', 'To stop', '|')):
            return s[:90]
    return '(no title)'


def main():
    args = parse_args()
    with open(args.src) as f:
        data = json.load(f)

    cutoff = datetime.datetime.fromisoformat(args.cutoff)
    msgs = sorted(data['messages'], key=lambda m: m['timestamp'])
    new = [m for m in msgs if datetime.datetime.fromisoformat(m['timestamp']) >= cutoff]
    old = [m for m in msgs if datetime.datetime.fromisoformat(m['timestamp']) < cutoff]
    sync_date = args.sync_ts[:10]

    # Titles for new messages (update per run). None = footer-only trailer, skip.
    TITLES = {
        '1532955784017744164': 'Intel Engine — Industry Trends (Run 1, 03:35 UTC)',
        '1532955785615773837': 'Intel Engine — Industry Trends (2/2)',
        '1533017251660169388': 'Intel Engine — Pricing Intelligence (Run 2, 07:39 UTC)',
        '1533017252662612088': 'Intel Engine — Pricing Intelligence (2/2)',
        '1533038416931848243': 'Stripe Health Check (1/2)',
        '1533038417615650960': 'Stripe Health Check (2/2)',
        '1533078647244853401': 'Intel Engine — Feature Ideas (Run 3, 11:43 UTC)',
        '1533078648117006498': 'Intel Engine — Feature Ideas (2/2)',
        '1533140107454976040': 'Intel Engine — Competitor Monitoring (Run 4, 15:47 UTC)',
        '1533140108423860244': 'Intel Engine — Competitor Monitoring (2/2)',
        '1533201476388782311': 'Intel Engine — Industry Trends (Run 5, 19:51 UTC)',
        '1533201476959076507': 'Intel Engine — Industry Trends (2/2)',
        '1533262516074053642': 'Intel Engine — Pricing Intelligence (Run 6, 23:55 UTC)',
        '1533262517063782491': 'Intel Engine — Pricing Intelligence (2/2)',
    }

    shown = [m for m in new if TITLES.get(m['id']) is not None]
    skipped = len(new) - len(shown)

    # ---------- mowgo channel ----------
    hdr = f"""# 🌱 mowgo — Raw Channel Dump
**{args.sync_ts} | {len(msgs)} messages fetched ({len(new)} new since last sync; {len(shown)} with content{f' + {skipped} footer-only trailer' if skipped else ''})**

## Most Recent Activity (New since {cutoff.strftime('%b %d %H:%M')} UTC sync)

"""
    entries = []
    for m in shown:
        label, _ = ts_parts(m)
        entries.append(f"### {label} — {title_for(m, TITLES)}\n**{m['author']['username']}** —\n\n{clean(m['content'])}\n")
    body = hdr + '\n'.join(entries)

    # Prior activity summary (grouped by date, brief)
    body += "\n## Prior Activity (unchanged from earlier syncs — summary)\n\n"
    by_date = {}
    for m in old:
        d = datetime.datetime.fromisoformat(m['timestamp']).strftime('%b %d')
        by_date.setdefault(d, []).append(m)

    for d in sorted(by_date.keys(), reverse=True):
        group = by_date[d]
        lines = [f"### {d} — {len(group)} messages (already captured in prior syncs)"]
        for m in group:
            t = datetime.datetime.fromisoformat(m['timestamp']).strftime('%H:%M')
            first = clean(m['content']).split('\n')[0][:110]
            lines.append(f"**{m['author']['username']}** {t} — {first}")
        body += '\n'.join(lines) + '\n\n'

    body += f"""---
*Raw dump generated by MowGo nightly vault sync — {args.sync_ts}*
"""
    out_mowgo = f'/opt/data/mowgo/vault/{sync_date}_channel-mowgo-raw.md'
    with open(out_mowgo, 'w') as f:
        f.write(body)
    print('mowgo raw written:', out_mowgo, len(body), 'chars')

    # ---------- outreach + cowork (unchanged channels) ----------
    outreach = f"""# 🌱 mowgo-outreach — Raw Channel Dump
**{args.sync_ts} | 23 messages (0 new since last sync)**

No new messages since Jul 26, 14:12 UTC. Outreach channel remains dormant.

## Most Recent Activity (from prior sync — unchanged)

### Jul 26, 14:12 — Reddit Monitor Summary
**HeremesV2** — 8 threads found (6 high, 2 medium priority). Templates A-F for engagement across r/LawnCarePros, r/CRM, r/lawncare, r/sweatystartup.

### Jul 26, 14:12 — Reddit Monitor (Threads 7-8)
**HeremesV2** — r/lawncare "Need advice on tools and software" (Template A), r/sweatystartup "Evaluate 6 figure landscaping plan" (Template E)

### Jul 26, 14:12 — Reddit Monitor (Threads 4-6)
**HeremesV2** — r/LawnCarePros "Current state of lawn care" (Template D), r/CRM "Best CRM for lawn care 2026" (Template A), r/sweatystartup "Scheduling lawn care customers" (Template C)

### Jul 26, 14:12 — Reddit Monitor (Threads 1-3)
**HeremesV2** — r/LawnCarePros "App features" (Template A), r/LawnCarePros "Best practices for customer payment" (Template C), r/LawnCarePros "New business" (Template B)

### Jul 25, 14:11 — Reddit Monitor Summary
**HeremesV2** — 10 threads across r/LawnCarePros, r/landscaping, r/sweatystartup

### Jul 24, 15:02 — Daily Outreach Actions
**HeremesV2** — Top 3 Reddit replies + cold outreach kickoff (3 leads: Mowzilla, Walter's, Aaron's) + Facebook engagement

### Jul 24, 14:07 — Reddit Monitor Summary
**HeremesV2** — 5 threads found (2 high, 3 medium). Reddit blocks all scraping (403).

### Jul 23, 15:02 — Daily Outreach Actions
**HeremesV2** — 3 Reddit replies queued + Facebook engagement plan

### Jul 23, 14:07 — Reddit Monitor Summary
**HeremesV2** — 4 threads found incl. GOLDEN r/landscaping "1-3 person crews" thread. All Reddit access 403-blocked.

### Jul 23, 04:48 — MowFlow Outreach System Setup
**HeremesV2** — Outreach system status: Reddit Monitor (daily 9am CST) + Daily Actions (10am CST weekdays). System files: facebook-groups.md, reply-templates.md, lead-tracker.md, reddit-monitor.md. First move: 6 warm leads via text/DM.

---
*Raw dump generated by MowGo nightly vault sync — {args.sync_ts}*
"""
    out_outreach = f'/opt/data/mowgo/vault/{sync_date}_channel-outreach-raw.md'
    with open(out_outreach, 'w') as f:
        f.write(outreach)

    cowork = f"""# 🤝 mowgo-cowork — Raw Channel Dump
**{args.sync_ts} | 0 messages (0 new since last sync)**

This channel remains empty. No coworking sessions have taken place yet.

---
*Raw dump generated by MowGo nightly vault sync — {args.sync_ts}*
"""
    out_cowork = f'/opt/data/mowgo/vault/{sync_date}_channel-cowork-raw.md'
    with open(out_cowork, 'w') as f:
        f.write(cowork)

    print('outreach + cowork written:', out_outreach, out_cowork)


if __name__ == '__main__':
    main()
