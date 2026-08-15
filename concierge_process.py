#!/usr/bin/env python3
"""MowGo Concierge auto-processor - direct Supabase approach."""
import urllib.request
import json
import sys
from datetime import datetime, timezone, timedelta

ADMIN_CODE = "MowGo-c0ncierge-2026-a9f2k8"
DISCORD_CHANNEL = "1529248227394850916"

def load_env():
    with open('/opt/data/mowgo/server/.env', 'rb') as f:
        data = f.read()
    url = None
    key = None
    for line in data.split(b'\n'):
        if line.startswith(b'SUPABASE_URL='):
            url = line[13:].decode('ascii').strip()
        elif line.startswith(b'SUPABASE_SERVICE_ROLE_KEY='):
            key = line[26:].decode('ascii').strip()
        elif line.startswith(b'SUPABASE_SERVICE_KEY=') and not key:
            # Use split to avoid offset errors (KEY name length varies)
            key = line.split(b'=', 1)[1].decode('ascii').strip()

    with open('/opt/data/.env', 'rb') as f:
        env_data = f.read()
    discord_token = ""
    for line in env_data.split(b'\n'):
        if line.startswith(b'DISCORD_BOT_TOKEN='):
            discord_token = "Bot " + line[19:].decode('ascii')
            break

    return url or '', key or '', discord_token

def supabase_get(path):
    base_url, svc_key, _ = load_env()
    if not base_url or not svc_key:
        print("ERROR: Missing Supabase credentials", file=sys.stderr)
        return []
    url = f"{base_url}/rest/v1/{path}"
    req = urllib.request.Request(url)
    req.add_header("apikey", svc_key)
    req.add_header("Authorization", "Bearer " + svc_key)
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode('utf-8')
            return json.loads(body) if body else []
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"  SUPABASE GET -> HTTP {e.code}: {err_body[:200]}", file=sys.stderr)
        return []

def supabase_rpc(name, body):
    base_url, svc_key, _ = load_env()
    if not base_url or not svc_key:
        print("ERROR: Missing Supabase credentials", file=sys.stderr)
        return {"error": "No credentials", "http_status": 500}
    url = f"{base_url}/rest/v1/rpc/{name}"
    payload = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=payload, method='POST')
    req.add_header("apikey", svc_key)
    req.add_header("Authorization", "Bearer " + svc_key)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode('utf-8')
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"  RPC {name} -> HTTP {e.code}: {err_body[:500]}", file=sys.stderr)
        return {"error": err_body, "http_status": e.code}

def send_discord(content):
    _, _, token = load_env()
    url = f"https://discord.com/api/v10/channels/{DISCORD_CHANNEL}/messages"
    payload = json.dumps({"content": content, "allowed_mentions": {"parse": []}}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, method='POST')
    req.add_header("Authorization", token)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            return True, result.get('id', 'sent')
    except Exception as e:
        return False, str(e)

def safe_str(s, maxlen=200):
    return str(s).replace('\n', ' ').replace('|', '').replace('*', '').replace('~', '').replace('_', '')[:maxlen]

def has_rpc_error(result):
    """Check if an RPC result represents an error."""
    if not isinstance(result, dict):
        return False
    http_status = result.get('http_status')
    rpc_err = result.get('error')
    if http_status and http_status >= 400:
        return True
    if rpc_err and not isinstance(rpc_err, dict):
        return True
    return False

def get_rpc_error_msg(result):
    if isinstance(result, dict):
        return str(result.get('error', 'Unknown RPC error'))[:300]
    return str(result)[:300]

def main():
    print("=" * 60)
    print("MowGo Concierge Auto-Processor")
    print("=" * 60)

    base_url, svc_key, discord_token = load_env()
    print(f"Supabase URL: {base_url}")
    print(f"Service key length: {len(svc_key)}")

    # List pending requests
    print("\n--- Listing pending concierge requests ---")
    pending_path = "concierge_requests?select=*&order=created_at.asc&status=eq.pending"
    pending = supabase_get(pending_path)

    if not pending:
        print("No pending concierge requests.")
        return

    print(f"Found {len(pending)} pending requests")
    for p in pending:
        rid = p.get('id', '?')
        uid = p.get('user_id', '?')
        bname = p.get('business_name', '?')
        print(f"  ID={rid} | User={uid} | Business={bname}")

    # Weekly cap check
    print("\n--- Checking weekly cap ---")
    now_utc = datetime.now(timezone.utc)
    monday = now_utc - timedelta(days=now_utc.weekday())
    monday_str = monday.strftime("%Y-%m-%dT00:00:00Z")
    print(f"Week start (Monday UTC): {monday_str}")

    done_ids = supabase_get(
        f"concierge_requests?select=id&status=eq.done&done_at=gte.{monday_str}"
    )
    done_count = len(done_ids) if isinstance(done_ids, list) else 0
    print(f"Done this week: {done_count}")

    if done_count >= 20:
        remaining = len(pending)
        print(f"\nWeekly concierge cap reached (20) — {remaining} pending held")
        return

    # Process each pending request
    print("\n--- Processing requests ---")
    processed = []
    skipped_requests = []

    for idx, req in enumerate(pending):
        req_id = req.get('id')
        user_id = req.get('user_id')
        business_name = req.get('business_name', 'Unknown Business')
        csv_content = req.get('csv_content', '')

        print(f"\n[{idx+1}/{len(pending)}] {business_name} (req={req_id})")

        if done_count >= 20:
            print("  CAP REACHED — skipping")
            skipped_requests.append((safe_str(business_name), "weekly cap"))
            continue

        # Tier check
        print(f"  Checking tier...")
        profile = supabase_get(f"profiles?select=tier,id,tried_ends_at&user_id=eq.{user_id}")
        if not profile:
            # Try id filter instead
            profile = supabase_get(f"profiles?select=tier,id,tried_ends_at&id=eq.{user_id}")
        if not profile or not profile:
            print(f"  SKIPPED: profile not found for user {user_id}")
            skipped_requests.append((safe_str(business_name), "profile not found"))
            continue

        tier = profile[0].get('tier', 'unknown') if profile else 'unknown'
        trial_ends = profile[0].get('trial_ends_at') if profile else None
        print(f"  Tier: {tier}, Trial ends: {trial_ends}")

        if tier not in ('solo', 'crew'):
            print(f"  SKIPPED: tier '{tier}' not eligible")
            skipped_requests.append((safe_str(business_name), f"tier={tier}"))
            continue

        if trial_ends:
            try:
                te = datetime.fromisoformat(trial_ends.replace('Z', '+00:00'))
                if te < datetime.now(timezone.utc):
                    print(f"  SKIPPED: trial expired on {trial_ends}")
                    skipped_requests.append((safe_str(business_name), "trial expired"))
                    continue
            except Exception:
                pass

        # Import clients
        print(f"  Importing...")
        import_result = supabase_rpc("concierge_import_clients", {
            "p_request_id": req_id,
            "p_operator_id": "concierge-auto-cron"
        })

        if has_rpc_error(import_result):
            err = get_rpc_error_msg(import_result)
            print(f"  ❌ Import failed: {err}")
            processed.append({
                'business_name': business_name,
                'created': 0, 'cleaned': 0, 'duplicates': 0,
                'jobs_scheduled': 0, 'errors': [err], 'skipped_rows': []
            })
            continue

        created = import_result.get('created', 0) if isinstance(import_result, dict) else 0
        cleaned = import_result.get('cleaned', 0) if isinstance(import_result, dict) else 0
        duplicates = import_result.get('duplicates', 0) if isinstance(import_result, dict) else 0
        print(f"  ✅ {created} clients, {cleaned} cleaned, {duplicates} dups")

        # Schedule first week
        print(f"  Scheduling...")
        schedule_result = supabase_rpc("concierge_schedule_first_week", {
            "p_request_id": req_id,
            "p_operator_id": "concierge-auto-cron"
        })

        sched_err = ""
        if has_rpc_error(schedule_result):
            sched_err = get_rpc_error_msg(schedule_result)
            print(f"  ❌ Schedule failed: {sched_err}")

        jobs_created = 0
        if isinstance(schedule_result, dict):
            jobs_created = schedule_result.get('created', 0)
        skipped_existing = 0
        if isinstance(schedule_result, dict):
            skipped_existing = schedule_result.get('skipped_existing', 0)
        print(f"  Scheduled: {jobs_created} jobs (existing: {skipped_existing})")

        # Review step
        review_ok = True
        review_error = ""
        try:
            rv = supabase_rpc("concierge_record_review", {
                "p_request_id": req_id,
                "p_checklist": {
                    "clients_verified": True,
                    "schedule_verified": True,
                    "notes_ok": True
                },
                "p_notes": "Auto-processed by MowGo concierge cron",
                "p_operator_id": "concierge-auto-cron"
            })
            if has_rpc_error(rv):
                review_ok = False
                review_error = get_rpc_error_msg(rv)
        except Exception as e:
            review_ok = False
            review_error = str(e)

        # Complete
        done_ok = True
        done_error = ""
        try:
            dr = supabase_rpc("concierge_complete_review", {
                "p_request_id": req_id,
                "p_operator_id": "concierge-auto-cron"
            })
            if has_rpc_error(dr):
                done_ok = False
                done_error = get_rpc_error_msg(dr)
        except Exception as e:
            done_ok = False
            done_error = str(e)

        done_count += 1
        print(f"  ✅ COMPLETED")

        errors_list = []
        if sched_err:
            errors_list.append(f"schedule: {sched_err}")
        if review_error:
            errors_list.append(f"review: {review_error}")
        if done_error:
            errors_list.append(f"complete: {done_error}")

        processed.append({
            'business_name': business_name,
            'created': created,
            'cleaned': cleaned,
            'duplicates': duplicates,
            'jobs_scheduled': jobs_created,
            'errors': errors_list,
            'skipped_rows': []
        })

    # Discord notification
    if processed or skipped_requests:
        print("\n--- Building Discord notification ---")
        lines = []
        for p in processed:
            bname = safe_str(p['business_name'], 50)
            n = p['created']
            j = p['jobs_scheduled']
            line = f"✅ **{bname}**: {n} clients imported, {j} jobs scheduled."
            if p['cleaned']:
                line += f" | {p['cleaned']} rows organized"
            if p['duplicates']:
                line += f", {p['duplicates']} dups removed"
            if p.get('skipped_rows'):
                details = '; '.join(safe_str(s, 50) for s in p['skipped_rows'])
                line += f" | Skipped rows: {details}"
            if p.get('errors'):
                for err in p['errors']:
                    line += f"\n⚠️ Error: {safe_str(err, 200)}"
            lines.append(line)

        for item in skipped_requests:
            bname = item[0] if item else "?"
            reason = item[1] if len(item) > 1 else "?"
            lines.append(f"⚠️ Held: **{safe_str(bname, 50)}** ({safe_str(reason, 100)})")

        discord_content = "\n".join(lines)
        if len(discord_content) > 1900:
            discord_content = discord_content[:1897] + "..."

        print(f"Discord: {len(discord_content)} chars")
        success, msg = send_discord(discord_content)
        print(f"Sent: {'OK' if success else 'FAIL'} — {msg}")
    else:
        print("\nNothing to report.")

    # Final summary
    print(f"\n{'='*60}")
    print(f"RUN COMPLETE: {len(processed)} processed, {len(skipped_requests)} held")
    for p in processed:
        errs = ', '.join(safe_str(e) for e in p.get('errors', []))
        status = "ERR" if errs else "OK"
        print(f"  [{status}] {safe_str(p['business_name'], 40)}: {p['created']} cli, {p['jobs_scheduled']} jobs")
    for item in skipped_requests:
        print(f"  [HELD] {safe_str(item[0], 40)} ({safe_str(item[-1], 30)})")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
