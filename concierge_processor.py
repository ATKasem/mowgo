#!/usr/bin/env python3
"""MowGo Concierge Auto-Processor"""

import json
import os
import subprocess
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

SUPABASE_URL = "https://vqgiynfrpsqddjrayczc.supabase.co"
ADMIN_CODE = "MowGo-c0ncierge-2026-a9f2k8"
API_BASE = "https://mowgo.pages.dev/api/admin/concierge"
DISCORD_CHANNEL = "1529248227394850916"
WEEKLY_CAP = 20


def get_env_value(file_path, key):
    with open(file_path) as f:
        for line in f:
            if line.startswith(key + '='):
                return line.strip().split('=', 1)[1]
    return None


# Step 1 & 2: Read credentials
admin_code = ADMIN_CODE  # From file
discord_token = get_env_value('/opt/data/.env', 'DISCORD_BOT_TOKEN')
supabase_key = get_env_value('/opt/data/mowgo/server/.env', 'SUPABASE_SERVICE_KEY') or \
               get_env_value('/opt/data/mowgo/server/.env', 'SUPABASE_SERVICE_ROLE_KEY')


def make_request(url, method='GET', headers=None, body=None):
    """Make an HTTP request and return parsed JSON."""
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, headers=headers, method=method)
    if body:
        req.data = json.dumps(body).encode('utf-8')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode('utf-8')
            return {"_error": json.loads(err_body)}
        except:
            return {"_error": e.reason}
    except Exception as e:
        return {"_error": str(e)}


def supabase_get(table, select_cols, filters):
    """Query Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select_cols}"
    params = []
    for col, val in filters.items():
        params.append(f"{col}={val}")
    if params:
        url += "&" + "&".join(params)

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "count=exact"
    }
    return make_request(url, headers=headers)


def concierge_action(action, request_id=None):
    """Call the admin concierge API."""
    url = f"{API_BASE}?action={action}"
    headers = {
        "x-admin-code": admin_code,
        "Content-Type": "application/json"
    }
    if request_id:
        return make_request(url, method='POST', headers=headers, body={"action": action, "request_id": request_id})
    else:
        return make_request(url, headers=headers)


# Step 3: List pending requests
print("=== Fetching pending concierge requests ===")
requests_data = concierge_action('list')

if "_error" in requests_data:
    print(f"ERROR listing requests: {requests_data['_error']}")
    exit(1)

requests_list = requests_data.get("requests", [])
pending = [r for r in requests_list if r.get("status") == "pending"]
# Sort oldest first (by created_at or id)
pending.sort(key=lambda r: r.get("id", 0))

print(f"Found {len(pending)} pending requests")

if not pending:
    print("No pending concierge requests.")
    exit(0)

# Step 5: Weekly cap check
monday_utc = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
# Find Monday of current week
weekday = monday_utc.weekday()  # 0=Monday
monday_utc = monday_utc - timedelta(days=weekday)
iso_monday = monday_utc.strftime("%Y-%m-%dT%H:%M:%S")
print(f"Week start: {iso_monday}")

done_count_result = supabase_get("concierge_requests", "id!inner", {"status": "eq.done", "done_at": f"gte.{iso_monday}"})

done_count = 0
if isinstance(done_count_result, list):
    done_count = len(done_count_result)
elif isinstance(done_count_result, dict):
    count_header = done_count_result.get('content-range', '')
    if ' / ' in count_header:
        done_count = int(count_header.split(' / ')[1])

print(f"Done this week: {done_count}")

if done_count >= WEEKLY_CAP:
    held = len(pending)
    print(f"Weekly concierge cap reached ({WEEKLY_CAP}) — {held} pending held")
    exit(0)

# Step 6: Process each pending request
results = []
skipped_tiers = []
discords = []  # Lines for Discord summary

for req in pending:
    req_id = req.get("id")
    business_name = req.get("business_name", "Unknown")
    user_id = req.get("user_id")
    print(f"\n--- Processing request {req_id}: {business_name} ---")

    # 6a: Tier check
    tier_result = supabase_get("profiles", "tier", {"id": f"eq.{user_id}"})
    tier = None
    if isinstance(tier_result, list) and len(tier_result) > 0:
        tier = tier_result[0].get("tier")
    elif isinstance(tier_result, dict) and '_error' not in tier_result:
        pass  # Empty result
    
    print(f"  Tier for user {user_id}: {tier}")

    if tier not in ('solo', 'crew'):
        reason = f"Tier '{tier}' is not eligible (solo/crew only)" if tier else "Profile not found"
        skipped_tiers.append((req_id, business_name, user_id, reason))
        print(f"  SKIP: {reason}")
        continue

    # 6b: Import
    print("  Running import...")
    import_result = concierge_action('import', req_id)

    if "_error" in import_result:
        errors_detail = import_result.get("_error", "Unknown error")
        print(f"  IMPORT ERROR: {errors_detail}")
        results.append({
            "business_name": business_name,
            "request_id": req_id,
            "error": f"Import failed: {errors_detail}",
            "created": 0, "cleaned": 0, "duplicates": 0, "jobs": 0,
            "skipped_list": []
        })
        continue

    created = import_result.get("created", 0)
    skipped = import_result.get("skipped", [])
    cleaned = import_result.get("cleaned", 0)
    duplicates = import_result.get("duplicates", 0)
    print(f"  Import: {created} created, {cleaned} cleaned, {duplicates} duplicates, {len(skipped)} skipped rows")

    # 6c: Schedule first week
    jobs_created = 0
    sched_error = None
    if created > 0:
        print("  Scheduling first week...")
        sched_result = concierge_action('schedule', req_id)
        if "_error" in sched_result:
            sched_error = sched_result.get("_error", "Unknown error")
            print(f"  SCHEDULING ERROR: {sched_error}")
        else:
            jobs_created = sched_result.get("jobs", 0)
            print(f"  Scheduled {jobs_created} jobs")

    # 6d: Mark done
    print("  Marking done...")
    done_result = concierge_action('done', req_id)
    if "_error" in done_result:
        print(f"  MARK DONE ERROR: {done_result['_error']}")

    # 6e: Track for summary
    results.append({
        "business_name": business_name,
        "request_id": req_id,
        "created": created,
        "cleaned": cleaned,
        "duplicates": duplicates,
        "jobs": jobs_created,
        "error": None,
        "skipped_list": skipped,
        "sched_error": sched_error
    })

# Build Discord message
discord_lines = []
success_count = sum(1 for r in results if r["created"] > 0 and r["error"] is None)
total_imported = sum(r["created"] for r in results)
total_jobs = sum(r["jobs"] for r in results)

for r in results:
    bname = r["business_name"]
    created = r["created"]
    jobs = r["jobs"]
    cleaned = r["cleaned"]
    dups = r["duplicates"]
    
    line = f"✅ Concierge processed: {bname} — {created} clients imported, {jobs} jobs scheduled (first week)."
    if cleaned > 0 or dups > 0:
        line += f" 🧹 Organized {cleaned} rows, removed {dups} duplicates"
    if r.get("skipped_list"):
        skip_details = "; ".join(str(s) for s in r["skipped_list"][:5])
        if len(r["skipped_list"]) > 5:
            skip_details += f" (+{len(r['skipped_list'])-5} more)"
        line += f" ⚠️ Skipped rows: {skip_details}"
    if r.get("error"):
        line += f" ⚠️ Error: {r['error']}"
    discord_lines.append(line)

for req_id, bname, uid, reason in skipped_tiers:
    discord_lines.append(f"⚠️ Held: {bname} (user {uid}) — {reason}")

full_msg = "\n".join(discord_lines)

# Trim to under 1900 chars if needed
if len(full_msg) > 1800:
    while len(full_msg) > 1800:
        full_msg = full_msg[:full_msg.rfind('\n')]  # Remove last line
    full_msg = full_msg[:-1]  # Remove trailing newline
full_msg = full_msg.rstrip()

print(f"\n=== Discord message ({len(full_msg)} chars) ===")
print(full_msg)

# Send Discord notification
discord_url = f"https://discord.com/api/v10/channels/{DISCORD_CHANNEL}/messages"
discord_headers = {
    "Authorization": f"Bot {discord_token}",
    "Content-Type": "application/json"
}
discord_body = {"content": full_msg, "allowed_mentions": {"parse": []}}

print("\n=== Posting to Discord ===")
result = make_request(discord_url, method='POST', headers=discord_headers, body=discord_body)
print(f"Discord response: {json.dumps(result)}")

# Summary output
print(f"\n=== CONCIERGE PROCESSING SUMMARY ===")
print(f"Requests processed: {len(results)} successful imports")
print(f"Total clients imported: {total_imported}")
print(f"Total jobs scheduled: {total_jobs}")
print(f"Skipped (tier ineligible): {len(skipped_tiers)}")
print(f"Pending remaining: {len(pending) - len([r for r in results if r['error'] is None]) - len(skipped_tiers)}")
