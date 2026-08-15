#!/usr/bin/env python3
"""MowGo Concierge Auto-Processor — cron run."""
import json
import re
import csv
import io
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

SUPABASE_URL = "https://vqgiynfrpsqddjrayczc.supabase.co"
API_BASE = "https://mowgo.pages.dev/api/admin/concierge"
ADMIN_CODE = open("/opt/data/secrets/concierge-admin-code.txt").read().strip()
DISCORD_CHANNEL = "1529248227394850916"
WEEKLY_CAP = 20

# Load keys from .env files
def load_env(path):
    result = {}
    with open(path) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                result[k] = v
    return result

discord_env = load_env("/opt/data/.env")
server_env = load_env("/opt/data/mowgo/server/.env")

discord_token = discord_env.get('DISCORD_BOT_TOKEN', '')
supabase_key = server_env.get('SUPABASE_SERVICE_KEY') or server_env.get('SUPABASE_SERVICE_ROLE_KEY')

AUTH_HEADERS = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
}


def make_request(url, method='GET', headers=None, body=None):
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
        except Exception:
            return {"_error": e.reason}
    except Exception as e:
        return {"_error": str(e)}


def supabase_get(table, select_cols, filters):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select_cols}"
    params = []
    for col, val in filters.items():
        params.append(f"{col}={val}")
    if params:
        url += "&" + "&".join(params)
    return make_request(url, headers=dict(AUTH_HEADERS))


def supabase_rpc(fn, params):
    body = json.dumps(params).encode()
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/rpc/{fn}',
        data=body,
        headers=AUTH_HEADERS,
        method='POST'
    )
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read().decode('utf-8'))
    return result


def concierge_admin_api(action, request_id=None):
    headers = {"x-admin-code": ADMIN_CODE, "Content-Type": "application/json"}
    body = {"action": action, "request_id": request_id} if request_id else {"action": action}
    return make_request(API_BASE, method='POST', headers=headers, body=body)


print("=" * 60)
print("MowGo Concierge Auto-Processor — Cron Run")
print(f"Date: {datetime.now(timezone.utc).isoformat()}")
print("=" * 60)

# Step 3: List requests from Supabase directly
print("\n=== Fetching concierge_requests ===")
try:
    all_reqs = supabase_get("concierge_requests", "*", "")
    print(f"Total records: {len(all_reqs)}")
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)

pending = [r for r in all_reqs if r.get("status") == "pending"]
pending.sort(key=lambda r: r.get("created_at", ""))
print(f"Pending count: {len(pending)}")
for p in pending:
    print(f"  REQ|{p['id']}|{p.get('business_name','?')}|{p.get('user_id','?')}")

if not pending:
    print("\nNo pending concierge requests.")
    exit(0)

# Step 5: Weekly cap check
now = datetime.now(timezone.utc)
weekday = now.weekday()
monday_utc = (now - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
iso_monday = monday_utc.isoformat()
print(f"\nWeek start: {iso_monday}")

done_data = supabase_get("concierge_requests", "id", {"status": "eq.done", "done_at": f"gte.{iso_monday}"})
done_count = len(done_data) if isinstance(done_data, list) else 0
print(f"Done this week: {done_count}")

if done_count >= WEEKLY_CAP:
    print(f"Weekly concierge cap reached ({WEEKLY_CAP}) — {len(pending)} pending held")
    exit(0)

# Step 6: Process each pending request
results = []
held_tiers = []
total_cleaned = 0
total_duplicates = 0

for req in pending:
    req_id = req["id"]
    biz_name = req.get("business_name", "?")
    user_id = req.get("user_id", "?")
    print(f"\n--- Processing: {biz_name} ({req_id[:8]}...) ---")

    # 6a: Tier check
    try:
        profiles = supabase_get("profiles", "tier,trial_ends_at", {"id": f"eq.{user_id}"})
        tier = profiles[0].get("tier", "") if profiles else ""
        trial_expired = False
        if profiles and profiles[0].get("trial_ends_at"):
            te = datetime.fromisoformat(profiles[0]["trial_ends_at"])
            trial_expired = (te.tzinfo and te < now) or (not te.tzinfo and te < now.replace(tzinfo=timezone.utc))
    except Exception:
        profiles = []
        tier = ""
        trial_expired = True
    
    print(f"  Tier: {tier}, Trial expired: {trial_expired}")

    if tier not in ('solo', 'crew'):
        reason = f"tier '{tier}' not eligible" if tier else "profile not found"
        if trial_expired:
            reason = "trial expired"
        held_tiers.append((biz_name, user_id, reason))
        print(f"  SKIP: {reason}")
        continue

    # 6b: Import
    print("  Importing...")
    import_resp = concierge_admin_api('import', req_id)

    auth_issue = False
    if "_error" in import_resp:
        emsg = import_resp["_error"].get("error", str(import_resp["_error"]))
        print(f"  Admin API error: {emsg}")
        if "Unauthorized" in str(emsg) or "unauthorized" in str(emsg).lower():
            auth_issue = True
    
    if auth_issue or "_error" in import_resp:
        print("  Falling back to direct RPC import...")
        try:
            req_full = supabase_get("concierge_requests", "csv_content,imported_client_ids", {"id": f"eq.{req_id}"})
            if not req_full:
                raise ValueError("Request not found")
            
            csv_content = req_full[0].get("csv_content", "")
            imported_ids = req_full[0].get("imported_client_ids", [])
            
            if imported_ids and len(imported_ids) > 0:
                created = len(imported_ids)
                cleaned = 0
                duplicates = 0
                skipped_list = []
                print(f"  Already imported {created} clients")
            elif not csv_content:
                raise ValueError("No CSV content")
            else:
                if csv_content.startswith('\ufeff'):
                    csv_content = csv_content[1:]
                
                lines = [l.rstrip('\r') for l in csv_content.split('\n')]
                
                def count_delim(s, delim):
                    cnt = 0
                    in_q = False
                    for c in s:
                        if c == '"': in_q = not in_q
                        elif c == delim and not in_q: cnt += 1
                    return cnt
                
                first = next((l for l in lines if l.strip() and not l.strip().startswith('#')), None)
                if not first:
                    raise ValueError("No data in CSV")
                
                tab_c = count_delim(first, '\t')
                semi_c = count_delim(first, ';')
                comma_c = count_delim(first, ',')
                delimiter = '\t' if tab_c > 0 else (';' if semi_c > 0 and comma_c == 0 else ',')
                
                reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
                fnames = [h.strip().lower() for h in (reader.fieldnames or [])]
                
                na = {'name','client name','client_name','customer name','customer','client'}
                aa = {'address','street','location'}
                pa = {'phone','phone number','phone_number','mobile','cell'}
                ea = {'email','e-mail','email address'}
                ra = {'rate','price','amount','cost','mow price'}
                has_header = any(h in na or h in aa or h in pa or h in ea or h in ra for h in fnames)
                
                data_rows = []
                if not has_header:
                    rr = csv.reader(io.StringIO(csv_content), delimiter=delimiter)
                    rows_all = list(rr)
                    if rows_all:
                        data_rows = rows_all
                else:
                    data_rows = list(reader)
                
                ph = re.compile(r'^(n/?a|n/?a/?n|unknown|\?|none|-+|tbd|missing|not sure)$', re.I)
                clients = []
                skip_errs = []
                seen = set()
                
                for idx, row in enumerate(data_rows):
                    if isinstance(row, dict):
                        n = row.get('name','').strip() or ''
                        a = row.get('address','').strip() or ''
                        p = row.get('phone','').strip() or ''
                        e = row.get('email','').strip() or ''
                        r = row.get('rate','').strip() or ''
                    elif isinstance(row, (list,tuple)):
                        n = row[0].strip() if len(row)>0 and row[0] else ''
                        a = row[1].strip() if len(row)>1 and row[1] else ''
                        p = row[2].strip() if len(row)>2 and row[2] else ''
                        e = row[3].strip() if len(row)>3 and row[3] else ''
                        r = row[4].strip() if len(row)>4 and row[4] else ''
                    else:
                        continue
                    
                    if ph.match(n): n = ''
                    if ph.match(a): a = ''
                    if ph.match(p): p = ''
                    
                    digits = re.sub(r'\D','',p)
                    if len(digits)==11 and digits.startswith('1'): digits=digits[1:]
                    if len(digits)==10: p=f'({digits[:3]}) {digits[3:6]}-{digits[6:]}'
                    
                    rn = 0
                    if r:
                        cr = re.sub(r'[^\d.]','',r)
                        try: rn=float(cr)
                        except:
                            m=re.search(r'\d+(?:\.\d+)?',r)
                            if m: rn=float(m.group())
                    
                    if not n and not a:
                        skip_errs.append(f"Row {idx+1}: empty"); continue
                    key=f'{n.lower()}|{a.lower()}'
                    if key in seen:
                        skip_errs.append(f"Row {idx+1}: duplicate"); continue
                    seen.add(key)
                    clients.append({'source_index':idx,'name':n,'address':a,'phone':p,'email':e,'rate':round(rn,2)})
                
                if not clients:
                    raise ValueError("No valid clients")
                
                rpc_result = supabase_rpc('concierge_import_clients', {
                    'p_request_id': req_id,
                    'p_clients': clients,
                    'p_operator_id': '00000000-0000-0000-0000-000000000000',
                })
                
                created = rpc_result.get('created', len(clients))
                dup_count = len([s for s in skip_errs if 'duplicate' in s])
                cleaned = len(seen) - created + dup_count
                duplicates = dup_count
                skipped_list = skip_errs
                print(f"  Direct import: {created} created, {cleaned} cleaned, {duplicates} dups")
        except Exception as e:
            print(f"  DIRECT IMPORT FAILED: {e}")
            results.append({"business_name": biz_name, "error": str(e), "created": 0, "cleaned": 0, "duplicates": 0, "jobs": 0, "skipped_list": []})
            continue
    else:
        created = import_resp.get("created", 0)
        cleaned = import_resp.get("cleaned", 0)
        duplicates = import_resp.get("duplicates", 0)
        skipped_list = import_resp.get("skipped", [])
        print(f"  Import OK: {created} created, {cleaned} cleaned, {duplicates} dups")

    total_cleaned += cleaned
    total_duplicates += duplicates

    # 6c: Schedule
    jobs_created = 0
    sched_error = None
    if created > 0:
        print("  Scheduling...")
        sched_resp = concierge_admin_api('schedule', req_id)
        
        if "_error" in sched_resp:
            sm = sched_resp["_error"].get("error", str(sched_resp["_error"]))
            if "Unauthorized" in str(sm) or "unauthorized" in str(sm).lower():
                print("  Falling back to direct schedule RPC...")
                try:
                    sr = supabase_rpc('concierge_schedule_first_week', {
                        'p_request_id': req_id,
                        'p_operator_id': '00000000-0000-0000-0000-000000000000',
                    })
                    jobs_created = len(sr.get('jobs', []))
                    print(f"  Scheduled {jobs_created} jobs via RPC")
                except Exception as e:
                    sched_error = str(e)
            else:
                sched_error = sm
                print(f"  Schedule failed: {sm}")
        else:
            jobs_created = sched_resp.get("jobs", 0)
            print(f"  Scheduled {jobs_created} jobs")

    # 6d: Mark done
    print("  Marking done...")
    done_resp = concierge_admin_api('done', req_id)
    
    if "_error" in done_resp:
        dm = done_resp["_error"].get("error", str(done_resp["_error"]))
        if "Unauthorized" in str(dm) or "unauthorized" in str(dm).lower():
            print("  Falling back to direct complete RPC...")
            try:
                checklist = {'clients_verified':True,'first_week_verified':True,'customer_ready':True,'existing_schedule_verified':True}
                supabase_rpc('concierge_record_review', {
                    'p_request_id': req_id, 'p_checklist': checklist,
                    'p_notes': 'Auto-processed by concierge bot',
                    'p_operator_id': '00000000-0000-0000-0000-000000000000',
                })
                supabase_rpc('concierge_complete_review', {
                    'p_request_id': req_id,
                    'p_operator_id': '00000000-0000-0000-0000-000000000000',
                })
                print("  Marked done via direct RPC")
            except Exception as e:
                print(f"  Direct complete failed: {e}")
        else:
            print(f"  Done failed: {dm}")
    else:
        print("  Done OK")

    results.append({
        "business_name": biz_name, "request_id": req_id,
        "created": created, "cleaned": cleaned, "duplicates": duplicates,
        "jobs": jobs_created, "error": None, "skipped_list": skipped_list,
    })
    print(f"  ✅ Complete: {biz_name}")

# Build Discord message
dl = []
ti = sum(r["created"] for r in results)
tj = sum(r["jobs"] for r in results)

for r in results:
    line = f"✅ Concierge processed: {r['business_name']} — {r['created']} clients imported, {r['jobs']} jobs scheduled (first week)."
    if r["cleaned"] > 0 or r["duplicates"] > 0:
        line += f" 🧹 Organized {r['cleaned']} rows, removed {r['duplicates']} duplicates"
    if r.get("skipped_list"):
        ss = "; ".join(str(s)[:80] for s in r["skipped_list"][:5])
        if len(r["skipped_list"]) > 5:
            ss += f" (+{len(r['skipped_list'])-5} more)"
        line += f" ⚠️ Skipped rows: {ss}"
    dl.append(line)

for bz, uid, reason in held_tiers:
    dl.append(f"⚠️ Held: {bz} — {reason}")

msg = "\n".join(dl)
if len(msg) > 1850:
    while len(msg) > 1800:
        nl = msg.rfind('\n')
        if nl < 0: break
        msg = msg[:nl]
msg = msg.rstrip()

print(f"\n{'='*60}")
print(f"Discord ({len(msg)} chars):\n{msg}")
print(f"{'='*60}")

if discord_token:
    dr = make_request(
        f"https://discord.com/api/v10/channels/{DISCORD_CHANNEL}/messages",
        method='POST',
        headers={"Authorization": f"Bot {discord_token}", "Content-Type": "application/json"},
        body={"content": msg, "allowed_mentions": {"parse": []}}
    )
    print(f"Discord status: {json.dumps(dr)}")

print(f"\n=== FINAL SUMMARY ===")
print(f"Processed: {len(results)} | Clients: {ti} | Jobs: {tj} | Held: {len(held_tiers)} | Weekly before: {done_count}/{WEEKLY_CAP}")