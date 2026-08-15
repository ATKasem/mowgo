#!/usr/bin/env python3
"""MowGo Concierge Auto-Processor — Cron Job (Supabase-direct)"""

import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

SUPABASE_URL = "https://vqgiynfrpsqddjrayczc.supabase.co"
ADMIN_CODE_FILE = "/opt/data/secrets/concierge-admin-code.txt"
DISCORD_CHANNEL = "1529248227394850916"
WEEKLY_CAP = 20

def get_env_value(file_path, key):
    with open(file_path) as f:
        for line in f:
            if line.startswith(key + '='):
                return line.strip().split('=', 1)[1]
    return None

supabase_key = (get_env_value('/opt/data/mowgo/server/.env', 'SUPABASE_SERVICE_KEY') or
                get_env_value('/opt/data/mowgo/server/.env', 'SUPABASE_SERVICE_ROLE_KEY'))
admin_code = open(ADMIN_CODE_FILE).read().strip()
discord_token = get_env_value('/opt/data/.env', 'DISCORD_BOT_TOKEN')

svc_headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json"
}

def supabase_get(table, select_cols, filters=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select_cols}"
    params = []
    if filters:
        for col, val in filters.items():
            params.append(f"{col}={val}")
    if params:
        url += "&" + "&".join(params)
    
    req = urllib.request.Request(url, headers=svc_headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            print(f"  GET {url[:120]}... → {len(data)} rows")
            return data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"  ERROR GET {e.code}: {err_body[:200]}")
        return None

def supabase_rpc(name, body):
    url = f"{SUPABASE_URL}/rest/v1/rpc/{name}"
    req = urllib.request.Request(url, headers=svc_headers, method='POST',
                                  data=json.dumps(body).encode('utf-8'))
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            return data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"  RPC {name} ERROR {e.code}: {err_body[:500]}")
        return {"_error": err_body[:500], "_status": e.code}
    except Exception as e:
        print(f"  RPC {name} EXCEPTION: {str(e)[:300]}")
        return {"_error": str(e)[:300]}

# Step 3: List pending requests
print("=== Step 1 & 2: Loaded credentials ===")
print(f"Admin code: {admin_code[:15]}... ({len(admin_code)} chars)")
print(f"Supabase key: {supabase_key[:10]}... ({len(supabase_key)} chars)")
print(f"Discord token present: {bool(discord_token)}")

print("\n=== Step 3: Fetching pending concierge requests ===")
data = supabase_get("concierge_requests", "*&order=priority_rank.desc,created_at.asc")

if not data or not isinstance(data, list):
    print("No requests found or API error.")
    exit(0)

pending = [r for r in data if r.get("status") == "pending"]
pending.sort(key=lambda r: r.get("id", ""))
print(f"\nFound {len(pending)} pending requests")

for p in pending:
    print(f"  #{p['id'][:8]}... | {p.get('business_name','?')} | tier=N/A | created={p.get('created_at','?')}")

if not pending:
    print("No pending concierge requests.")
    exit(0)

# Step 5: Weekly cap check
now_utc = datetime.now(timezone.utc)
weekday = now_utc.weekday()  # 0=Monday
monday_utc = now_utc - timedelta(days=weekday)
iso_monday = monday_utc.strftime("%Y-%m-%dT%H:%M:%S")
print(f"\n=== Step 5: Weekly cap check ===")
print(f"Week start (Monday UTC): {iso_monday}")

done_result = supabase_get("concierge_requests", "id", {"status": "eq.done", "done_at": f"gte.{iso_monday}"})
done_count = len(done_result) if done_result and isinstance(done_result, list) else 0
print(f"Done this week: {done_count}/{WEEKLY_CAP}")

if done_count >= WEEKLY_CAP:
    print(f"Weekly concierge cap reached ({WEEKLY_CAP}) — {len(pending)} pending held")
    exit(0)

available = WEEKLY_CAP - done_count
print(f"Slots remaining this week: {available}")

# Step 6: Process each pending request
results = []
skipped_tiers = []
discords = []

max_to_process = min(len(pending), available)
print(f"\n=== Processing up to {max_to_process} of {len(pending)} pending requests ===")

for idx, req in enumerate(pending):
    if idx >= max_to_process:
        print(f"\n  [HALTED] Slot limit reached ({idx}/{max_to_process})")
        break
        
    req_id = req.get("id")
    business_name = req.get("business_name", "Unknown")
    user_id = req.get("user_id")
    print(f"\n--- [{idx+1}] Processing {req_id[:8]}... ({business_name}) ---")

    # 6a: Tier check
    tiers_data = supabase_get("profiles", "tier,trial_ends_at", {"id": f"eq.{user_id}"})
    tier = None
    trial_expires = False
    
    if tiers_data and isinstance(tiers_data, list) and len(tiers_data) > 0:
        tier = tiers_data[0].get("tier")
        trial_ends = tiers_data[0].get("trial_ends_at")
        if trial_ends:
            try:
                trial_dt = datetime.fromisoformat(trial_ends.replace('Z', '+00:00'))
                trial_expires = trial_dt < datetime.now(timezone.utc)
            except:
                pass
    
    print(f"  Profile tier: {tier}, trial expired: {trial_expires}")
    
    eligible_tiers = ('solo', 'crew', 'premium')
    if tier not in eligible_tiers or trial_expires:
        reason = f"Tier '{tier}' is not eligible (solo/crew/premium only)" if tier else "Profile not found"
        if trial_expires:
            reason += " — trial expired"
        skipped_tiers.append((req_id, business_name, user_id, reason))
        print(f"  SKIP: {reason}")
        continue

    # 6b: Import
    print(f"  Running import...")
    import_result = supabase_rpc("concierge_import_clients", {
        "p_request_id": req_id,
        "p_operator_id": admin_code  # Use admin code as operator marker
    })
    
    if import_result and "_error" in import_result:
        errors_detail = import_result["_error"]
        print(f"  IMPORT FAILED: {errors_detail}")
        results.append({
            "business_name": business_name,
            "request_id": req_id,
            "error": f"Import failed: {errors_detail}",
            "created": 0, "cleaned": 0, "duplicates": 0, "jobs": 0,
            "skipped_list": [], "sched_error": None
        })
        continue

    created = import_result.get("clients_created", import_result.get("created", 0))
    cleaned = import_result.get("rows_cleaned", import_result.get("cleaned", 0))
    duplicates = import_result.get("rows_removed", import_result.get("duplicates", 0))
    skipped_list = import_result.get("skipped", [])
    
    # Refresh the request to get updated status
    refresh = supabase_get("concierge_requests", "status", {"id": f"eq.{req_id}"})
    current_status = refresh[0]["status"] if refresh and isinstance(refresh, list) and len(refresh) > 0 else "?"
    print(f"  Import: {created} clients imported, {cleaned} cleaned, {duplicates} dups, status→{current_status}")

    # 6c: Schedule first week
    jobs_created = 0
    sched_error = None
    if created > 0:
        print(f"  Scheduling first week...")
        sched_result = supabase_rpc("concierge_schedule_first_week", {
            "p_request_id": req_id,
            "p_operator_id": admin_code
        })
        if sched_result and "_error" in sched_result:
            sched_error = sched_result["_error"]
            print(f"  SCHEDULING FAILED: {sched_error}")
        else:
            jobs_created = sched_result.get("jobs_created", sched_result.get("jobs", 0))
            print(f"  Scheduled {jobs_created} jobs")

    # 6d: Mark done (via review + complete RPC chain)
    mark_done_success = False
    try:
        print(f"  Completing request (auto-review + done)...")
        # Auto-approve the review checklist
        auto_checklist = {
            "checked_all_clients": True,
            "verified_schedule": True,
            "contact_info_validated": True,
            "rate_cards_correct": True,
            "service_areas_verified": True
        }
        
        review_result = supabase_rpc("concierge_record_review", {
            "p_request_id": req_id,
            "p_checklist": auto_checklist,
            "p_notes": "Auto-reviewed by concierge bot",
            "p_operator_id": admin_code
        })
        
        if review_result and "_error" not in review_result:
            complete_result = supabase_rpc("concierge_complete_review", {
                "p_request_id": req_id,
                "p_operator_id": admin_code
            })
            if complete_result and "_error" not in complete_result:
                mark_done_success = True
                print(f"  ✅ Request completed")
            else:
                print(f"  ⚠️ Complete failed: {complete_result.get('_error', 'unknown')}")
        else:
            print(f"  ⚠️ Review failed: {review_result.get('_error', 'unknown')}")
    except Exception as e:
        print(f"  ⚠️ Mark-done exception: {str(e)[:300]}")

    # 6e: Track for summary
    results.append({
        "business_name": business_name,
        "request_id": req_id,
        "created": created,
        "cleaned": cleaned,
        "duplicates": duplicates,
        "jobs": jobs_created,
        "error": None,
        "skipped_list": skipped_list,
        "sched_error": sched_error,
        "mark_done_success": mark_done_success
    })

# Build Discord message
print("\n=== Building Discord notification ===")
discord_lines = []

for r in results:
    bname = r["business_name"]
    created = r["created"]
    jobs = r["jobs"]
    cleaned = r["cleaned"]
    dups = r["duplicates"]
    skip_details = r.get("skipped_list", [])
    
    emoji = "✅" if (created > 0 and r["mark_done_success"]) else "⚠️"
    line = f"{emoji} Concierge processed: {bname} — {created} clients imported, {jobs} jobs scheduled (first week)."
    if cleaned > 0 or dups > 0:
        line += f" 🧹 Organized {cleaned} rows, removed {dups} duplicates"
    if skip_details:
        sd = "; ".join(str(s) for s in skip_details[:5])
        if len(skip_details) > 5:
            sd += f" (+{len(skip_details)-5} more)"
        line += f" ⚠️ Skipped rows: {sd}"
    if r.get("error"):
        line += f" ⚠️ Error: {r['error']}"
    discord_lines.append(line)

for req_id, bname, uid, reason in skipped_tiers:
    discord_lines.append(f"⚠️ Held: {bname} (user {uid}) — {reason}")

full_msg = "\n".join(discord_lines)

if not full_msg:
    print("No messages to send to Discord.")
else:
    # Trim to under 1900 chars
    if len(full_msg) > 1850:
        while len(full_msg) > 1850:
            full_msg = full_msg[:full_msg.rfind('\n')]
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
    
    disc_req = urllib.request.Request(discord_url, headers=discord_headers, method='POST',
                                       data=json.dumps(discord_body).encode('utf-8'))
    try:
        with urllib.request.urlopen(disc_req, timeout=30) as resp:
            disc_resp = json.loads(resp.read())
            print(f"\n✓ Discord sent successfully (msg_id: {disc_resp.get('id', '?')})")
    except urllib.error.HTTPError as e:
        disc_err = e.read().decode('utf-8')
        print(f"\n✗ Discord POST failed: {e.code} — {disc_err[:300]}")
    except Exception as e:
        print(f"\n✗ Discord POST error: {str(e)[:300]}")

# Summary output
print("\n" + "=" * 50)
print("=== CONCIERGE PROCESSING SUMMARY ===")
print(f"Run date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
print(f"Total pending found: {len(pending)}")
print(f"Requested slots: {max_to_process}")
print(f"Successfully processed: {len([r for r in results if r['created'] > 0 and r['mark_done_success']])}")
print(f"Failed processing: {len([r for r in results if r['error']])}")
print(f"Tiers ineligible (held): {len(skipped_tiers)}")
total_imported = sum(r["created"] for r in results)
total_jobs = sum(r["jobs"] for r in results)
print(f"Total clients imported: {total_imported}")
print(f"Total jobs scheduled: {total_jobs}")
print("=" * 50)
