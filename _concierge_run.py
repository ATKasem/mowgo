#!/usr/bin/env python3
"""MowGo concierge auto-processor for scheduled runs."""
import urllib.request
import json
import sys
from datetime import datetime, timezone, timedelta

# ---- Config ----
ADMIN_CODE = "MowGo-c0ncierge-2026-a9f2k8"
SUPABASE_URL = "https://vqgiynfrpsqddjrayczc.supabase.co"

with open('/opt/data/mowgo/server/.env') as f:
    supabase_key = None
    for line in f:
        if line.startswith('SUPABASE_SERVICE_KEY='):
            supabase_key = line.strip().split('=', 1)[1]

if not supabase_key:
    raise ValueError("No SUPABASE_SERVICE_KEY found")

discord_token = None
with open('/opt/data/.env') as f:
    for line in f:
        if line.startswith('DISCORD_BOT_TOKEN='):
            discord_token = line.strip().split('=', 1)[1]
            break

if not discord_token:
    raise ValueError("No DISCORD_BOT_TOKEN found")

print(f"Service key loaded (len={len(supabase_key)})")
print(f"Discord token loaded (len={len(discord_token)})")

def api_get(url, headers=None):
    req = urllib.request.Request(url)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def api_post(url, payload, extra_headers=None):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("x-admin-code", ADMIN_CODE)
    req.add_header("Content-Type", "application/json")
    if extra_headers:
        for k, v in extra_headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

sb_headers = {"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}

# Step 3: List requests
list_url = "https://mowgo.pages.dev/api/admin/concierge?action=list"
pending = []
api_error = None
try:
    list_data = api_get(list_url, {"x-admin-code": ADMIN_CODE})
    requests_list = list_data.get("requests", [])
    pending = [r for r in requests_list if r.get("status") == "pending"]
    pending.sort(key=lambda r: r.get("created_at", ""))
    print(f"Total requests: {len(requests_list)}, Pending: {len(pending)}")
    for p in pending:
        print(f"  - ID: {p.get('id')}, User: {p.get('user_id')}, Business: {p.get('business_name', 'N/A')}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    api_error = f"HTTP {e.code}: {e.reason} ({body})"
    print(f"Admin API error: {api_error}")
except Exception as e:
    api_error = str(e)
    print(f"Error listing requests: {e}")

if not pending:
    print("\nNo pending concierge requests.")
    sys.exit(0)

# Step 5: Weekly cap check
now = datetime.now(timezone.utc)
monday = now - timedelta(days=now.weekday())
monday_iso = monday.strftime("%Y-%m-%dT00:00:00Z")
print(f"\nCurrent week starts (ISO): {monday_iso}")

done_url = f"{SUPABASE_URL}/rest/v1/concierge_requests?select=id&status=eq.done&done_at=gte.{monday_iso}"
try:
    done_data = api_get(done_url, sb_headers)
    done_count = len(done_data) if isinstance(done_data, list) else 0
    print(f"Done requests this week: {done_count}")
except Exception as e:
    print(f"Error checking weekly cap: {e}")
    done_count = 0

if done_count >= 20:
    print(f"\nWeekly concierge cap reached (20) — {len(pending)} pending held")
    sys.exit(0)

remaining = 20 - done_count
print(f"Remaining capacity this week: {remaining}")

# Process each pending request
results = []
skipped_notes = []

for i, req_item in enumerate(pending):
    if i >= remaining:
        skipped_notes.append(req_item.get('business_name', req_item.get('user_id')) + " (weekly cap)")
        continue

    rid = req_item["id"]
    uid = req_item["user_id"]
    bname = req_item.get("business_name", "Unknown")
    print(f"\n--- Processing request {rid}: {bname} ---")

    # 6a: Tier check
    tier_url = f"{SUPABASE_URL}/rest/v1/profiles?select=tier&id=eq.{uid}"
    try:
        tier_data = api_get(tier_url, sb_headers)
        tier = tier_data[0]["tier"] if tier_data else None
        print(f"  Tier: {tier}")
        if not tier or tier not in ('solo', 'crew'):
            skipped_notes.append(bname + f" ({uid}) -- tier '{tier}' requires solo/crew")
            print("  SKIP: invalid tier")
            continue
    except Exception as e:
        skipped_notes.append(bname + f" ({uid}) -- profile lookup failed: {str(e)}")
        print(f"  SKIP: {e}")
        continue

    # 6b: Import
    import_payload = {"action": "import", "request_id": rid}
    try:
        import_resp = api_post("https://mowgo.pages.dev/api/admin/concierge", import_payload)
        created = import_resp.get("created", 0)
        cleaned = import_resp.get("cleaned", 0)
        duplicates = import_resp.get("duplicates", 0)
        skipped_rows = import_resp.get("skipped", [])
        if isinstance(skipped_rows, str):
            skipped_rows = [skipped_rows]
        if skipped_rows is None:
            skipped_rows = []

        if "error" in import_resp:
            err_msg = import_resp["error"]
            print(f"  Import error: {err_msg}")
            results.append({
                "business_name": bname,
                "request_id": rid,
                "created": created,
                "cleaned": cleaned,
                "duplicates": duplicates,
                "jobs_created": 0,
                "schedule_error": None,
                "import_error": err_msg,
                "skipped_list": skipped_rows,
            })
            continue

        print(f"  Import: created={created}, cleaned={cleaned}, duplicates={duplicates}, skipped={skipped_rows}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if hasattr(e, 'read') else str(e)
        print(f"  Import HTTP error: {e.code} - {err_body}")
        results.append({
            "business_name": bname,
            "request_id": rid,
            "created": 0, "cleaned": 0, "duplicates": 0,
            "jobs_created": 0, "schedule_error": None,
            "import_error": f"HTTP {e.code}: {err_body}",
            "skipped_list": [],
        })
        continue
    except Exception as e:
        print(f"  Import exception: {e}")
        results.append({
            "business_name": bname,
            "request_id": rid,
            "created": 0, "cleaned": 0, "duplicates": 0,
            "jobs_created": 0, "schedule_error": None,
            "import_error": str(e),
            "skipped_list": [],
        })
        continue

    # 6c: Schedule first week
    jobs_created = 0
    schedule_error = None
    sched_payload = {"action": "schedule", "request_id": rid}
    try:
        sched_resp = api_post("https://mowgo.pages.dev/api/admin/concierge", sched_payload)
        jobs_created = sched_resp.get("jobs_created", 0) or sched_resp.get("jobs", 0) or 0
        print(f"  Scheduled: {jobs_created} jobs")
    except Exception as e:
        schedule_error = str(e)
        print(f"  Schedule error: {e}")

    # 6d: Mark done
    done_payload = {"action": "done", "request_id": rid}
    try:
        done_resp = api_post("https://mowgo.pages.dev/api/admin/concierge", done_payload)
        print(f"  Marked done: {done_resp}")
    except Exception as e:
        print(f"  Mark done error: {e}")

    # Track result
    results.append({
        "business_name": bname,
        "request_id": rid,
        "created": created,
        "cleaned": cleaned,
        "duplicates": duplicates,
        "jobs_created": jobs_created,
        "schedule_error": schedule_error,
        "import_error": None,
        "skipped_list": skipped_rows,
    })

# Step 7: Build Discord summary
lines = []
total_cleaned = 0
total_dupes = 0

for r in results:
    imp_err = r.get("import_error")
    sc_err = r.get("schedule_error")
    jobs = r.get("jobs_created", 0)
    cr = r.get("created", 0)

    if imp_err and not sc_err and jobs == 0:
        lines.append(f"Warning: {r['business_name']}: {imp_err}")
    elif jobs > 0 or (cr > 0):
        entry = f"Concierge processed: {r['business_name']} - {cr} clients imported, {jobs} jobs scheduled (first week)."
        lines.append("OK: " + entry)
        total_cleaned += r.get("cleaned", 0)
        total_dupes += r.get("duplicates", 0)

    if sc_err and sc_err != schedule_error:
        pass
    if sc_err:
        lines.append(f"Warning: {r['business_name']}: scheduling failed - {sc_err}")

if total_cleaned > 0 or total_dupes > 0:
    lines.append(f"Organized {total_cleaned} rows, removed {total_dupes} duplicates")

for s in results:
    slist = s.get("skipped_list", []) or []
    if slist:
        names = ", ".join(str(x) for x in slist[:5])
        lines.append(f"Skipped rows for {s['business_name']}: {names}")

for sn in skipped_notes:
    lines.append(f"Held: {sn}")

summary = "\n".join(lines)
if len(summary) > 1900:
    summary = summary[:1897] + "..."

print(f"\n--- Discord Summary ---\n{summary}")

# Post to Discord
discord_url = "https://discord.com/api/v10/channels/1529248227394850916/messages"
discord_msg = json.dumps({"content": summary, "allowed_mentions": {"parse": []}})
req_discord = urllib.request.Request(discord_url, data=discord_msg.encode(), method="POST")
req_discord.add_header("Authorization", f"Bot {discord_token}")
req_discord.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req_discord) as resp:
        status = resp.status
        print(f"Discord posted: {status}")
except Exception as e:
    print(f"Discord post error: {e}")
    import traceback; traceback.print_exc()

# Final run summary
print(f"\n--- Run Summary ---")
ok_count = sum(1 for r in results if not r.get("import_error") and not r.get("schedule_error"))
err_count = sum(1 for r in results if r.get("import_error"))
sched_err_count = sum(1 for r in results if r.get("schedule_error"))
print(f"Processed: {len(results)} requests")
print(f"OK: {ok_count}, Import errors: {err_count}, Schedule errors: {sched_err_count}, Held: {len(skipped_notes)}")
for r in results:
    if r.get("import_error"):
        print(f"  ERROR: {r['business_name']} - {r['import_error']}")
    elif r.get("schedule_error"):
        print(f"  SCHED_ERR: {r['business_name']} - {r['schedule_error']}")
    else:
        print(f"  OK: {r['business_name']} - {r.get('created',0)} imported, {r['jobs_created']} jobs scheduled")
for sn in skipped_notes:
    print(f"  HELD: {sn}")
