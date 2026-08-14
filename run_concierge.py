#!/usr/bin/env python3
"""MowGo concierge auto-processor."""
import json, sys, os
from datetime import datetime, timezone, timedelta
import urllib.request, urllib.parse, urllib.error

ADMIN_CODE = open('/opt/data/secrets/concierge-admin-code.txt').read().replace('\n', '')
env_text = open('/opt/data/mowgo/server/.env').read()
SUPABASE_URL = ''
SVC_KEY = ''
for line in env_text.splitlines():
    if line.startswith('SUPABASE_URL='):
        SUPABASE_URL = line.split('=', 1)[1].strip().strip('\r')
    elif line.startswith('SUPABASE_SERVICE_KEY='):
        SVC_KEY = line.split('=', 1)[1].strip().strip('\r')

dotenv_text = open('/opt/data/.env').read()
DISCORD_TOKEN = ''
for line in dotenv_text.splitlines():
    if line.startswith('DISCORD_BOT_TOKEN='):
        DISCORD_TOKEN = line.split('=', 1)[1].strip().strip('\r')

CHANNEL = "1529248227394850916"

def supabase_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        'apikey': SVC_KEY,
        'Authorization': f'Bearer {SVC_KEY}',
        'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def supabase_post(path, body):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={
        'apikey': SVC_KEY,
        'Authorization': f'Bearer {SVC_KEY}',
        'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def admin_api(action, request_id=None):
    url = "https://mowgo.pages.dev/api/admin/concierge"
    body = {'action': action}
    if request_id:
        body['request_id'] = request_id
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={
        'x-admin-code': ADMIN_CODE,
        'Content-Type': 'application/json'
    })
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()), None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        try:
            return json.loads(err_body), None
        except:
            return None, f"HTTP {e.code}: {err_body[:200]}"

def discord_notify(content):
    url = f"https://discord.com/api/v10/channels/{CHANNEL}/messages"
    data = json.dumps({
        'content': content[:1900],
        'allowed_mentions': {'parse': []}
    }).encode()
    req = urllib.request.Request(url, data=data, headers={
        'Authorization': f'Bot {DISCORD_TOKEN}',
        'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# Step 1: List all requests from Supabase
requests = supabase_get('concierge_requests?select=*&order=created_at.asc')
pending = [r for r in requests if r.get('status') == 'pending']
pending.sort(key=lambda r: r.get('created_at', ''))

if not pending:
    print("No pending concierge requests.")
    sys.exit(0)

print(f"Found {len(pending)} pending requests")

# Weekly cap check
now = datetime.now(timezone.utc)
monday = now - timedelta(days=now.weekday())
monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
monday_iso = monday.isoformat()

done_this_week = supabase_get(
    f"concierge_requests?select=id&status=eq.done&done_at=gte.{monday_iso}"
)
done_count = len(done_this_week)
print(f"Done this week: {done_count}")

if done_count >= 20:
    print(f"Weekly concierge cap reached (20) — {len(pending)} pending held")
    sys.exit(0)

# Process each pending
report_lines = []
held_lines = []

for req in pending:
    req_id = req['id']
    biz_name = req.get('business_name', 'Unknown')
    user_id = req.get('user_id', '')
    print(f"\n=== Processing: {biz_name} ({req_id}) ===")

    # Tier check
    try:
        profiles = supabase_get(f"profiles?select=tier&id=eq.{user_id}")
        tier = profiles[0].get('tier', '') if profiles else ''
    except Exception as e:
        print(f"  Tier check failed: {e}")
        tier = ''

    print(f"  Tier: {tier}")
    if tier not in ('solo', 'crew'):
        print(f"  SKIP: tier {tier} not eligible")
        held_lines.append(f"⚠️ Held: {biz_name} (tier {tier} not eligible)")
        continue

    # Import
    print("  Importing...")
    result, err = admin_api('import', req_id)
    if err:
        print(f"  Import error: {err}")
        held_lines.append(f"⚠️ Held: {biz_name} (import error: {err})")
        continue

    if result and 'error' in result:
        print(f"  Import FAILED: {result['error']}")
        held_lines.append(f"⚠️ Held: {biz_name} (import: {result['error']})")
        continue

    created = result.get('created', 0)
    skipped = result.get('skipped', [])
    cleaned = result.get('cleaned', 0)
    duplicates = result.get('duplicates', 0)
    print(f"  Created: {created}, Cleaned: {cleaned}, Duplicates: {duplicates}")

    # Schedule
    print("  Scheduling...")
    sched_result, sched_err = admin_api('schedule', req_id)
    if sched_err:
        print(f"  Schedule error: {sched_err}")
        held_lines.append(f"⚠️ Held: {biz_name} (schedule error: {sched_err})")
        continue

    if sched_result and 'error' in sched_result:
        print(f"  Schedule FAILED: {sched_result['error']}")
        held_lines.append(f"⚠️ Held: {biz_name} (schedule: {sched_result['error']})")
        continue

    jobs = sched_result.get('jobs', [])
    jobs_count = len(jobs)
    print(f"  Jobs scheduled: {jobs_count}")

    # Mark done
    print("  Marking done...")
    done_result, done_err = admin_api('done', req_id)
    if done_err:
        print(f"  Done error: {done_err}")
        held_lines.append(f"⚠️ Held: {biz_name} (done error: {done_err})")
        continue

    # Build report line
    line = f"✅ Concierge processed: {biz_name} — {created} clients imported, {jobs_count} jobs scheduled (first week)."
    if cleaned > 0 or duplicates > 0:
        line += f" 🧹 Organized {cleaned} rows, removed {duplicates} duplicates."
    if skipped and len(skipped) > 0:
        skip_msgs = [f"row {s.get('row', '?')}: {s.get('message', '')}" for s in skipped]
        line += f" ⚠️ Skipped rows: {'; '.join(skip_msgs)}"
    report_lines.append(line)
    print(f"  Report: {line}")

# Build and send Discord notification
if report_lines:
    content = '\n'.join(report_lines)
    if held_lines:
        content += '\n' + '\n'.join(held_lines)
    print(f"\nDiscord content:\n{content}")
    try:
        resp = discord_notify(content)
        print(f"Discord posted: {resp.get('id', 'unknown')}")
    except Exception as e:
        print(f"Discord post failed: {e}")

print(f"\nProcessing complete. {len(report_lines)} processed, {len(held_lines)} held.")