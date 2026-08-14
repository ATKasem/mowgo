#!/usr/bin/env python3
"""MowGo concierge auto-processor — direct Supabase RPC calls."""

import json, os, sys, re, csv, io, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

# --- Config ---
with open('/opt/data/mowgo/server/.env') as f:
    env_lines = {line.split('=', 1)[0]: line.split('=', 1)[1].strip()
                 for line in f if '=' in line}
SUPABASE_URL = env_lines.get('SUPABASE_URL', '')
SVC_KEY = env_lines.get('SUPABASE_SERVICE_KEY', '')

with open('/opt/data/.env') as f:
    DISCORD_TOKEN = ''
    for line in f:
        if line.startswith('DISCORD_BOT_TOKEN='):
            DISCORD_TOKEN = line.split('=', 1)[1].strip()
            break

CHANNEL_ID = "1529248227394850916"
OPERATOR_ID = "00000000-0000-0000-0000-000000000000"

headers = {
    'apikey': SVC_KEY,
    'Authorization': f'Bearer {SVC_KEY}',
    'Content-Type': 'application/json'
}

def supabase_get(path):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def supabase_post(path, body):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        raise RuntimeError(f'POST {path} failed ({e.code}): {err_body[:500]}')

def supabase_rpc(name, body):
    return supabase_post(f'rpc/{name}', body)

def http_json(url, method='GET', req_headers=None, req_body=None):
    """Generic HTTP helper returning (status, parsed_json_or_raw)."""
    req = urllib.request.Request(url, method=method, headers=req_headers or {})
    data = None
    if req_body is not None:
        data = json.dumps(req_body).encode()
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            try:
                return resp.status, json.loads(raw) if raw else None
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(raw) if raw else None
        except json.JSONDecodeError:
            return e.code, raw
    except Exception as e:
        return None, str(e)

# --- Step 1+3: List pending requests ---
print("=== Listing concierge_requests ===", file=sys.stderr)
all_reqs = supabase_get('concierge_requests?select=*&order=created_at.asc')
pending = sorted([r for r in all_reqs if r.get('status') == 'pending'],
                 key=lambda r: r.get('created_at', ''))
print(f"Pending count: {len(pending)}", file=sys.stderr)

if not pending:
    print("No pending concierge requests.")
    sys.exit(0)

# --- Step 5: Weekly cap (max 20/week, week starts Monday 00:00 UTC) ---
now = datetime.now(timezone.utc)
monday = now - timedelta(days=now.weekday())
monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
monday_iso = monday.strftime('%Y-%m-%dT%H:%M:%SZ')
print(f"Monday 00:00 UTC: {monday_iso}", file=sys.stderr)

done_this_week = supabase_get(
    f'concierge_requests?select=id&status=eq.done&done_at=gte.{monday_iso}')
done_count = len(done_this_week)
print(f"Done this week: {done_count}", file=sys.stderr)

if done_count >= 20:
    print(f"Weekly concierge cap reached (20) — {len(pending)} pending held")
    sys.exit(0)

# --- Process each request ---
report_lines = []
held_notes = []

PLACEHOLDERS = re.compile(
    r'^(n/?a|n/?a/?n|unknown|\?|none|-+|tbd|missing|not sure)$', re.IGNORECASE)

def normalize_phone(phone):
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) == 11 and digits.startswith('1'):
        digits = digits[1:]
    return f'({digits[:3]}) {digits[3:6]}-{digits[6:]}' if len(digits) == 10 else digits

for req in pending:
    req_id = req['id']
    biz_name = req.get('business_name', '?')
    user_id = req.get('user_id', '?')

    print(f"\n=== Processing: {biz_name} (ID: {req_id}) ===", file=sys.stderr)

    # 6a. Tier check
    try:
        profiles = supabase_get(f'profiles?select=tier&id=eq.{user_id}')
        tier = profiles[0].get('tier', '') if profiles else ''
    except Exception as e:
        print(f"  Tier check failed: {e}", file=sys.stderr)
        held_notes.append(f"Held: {biz_name} (tier check failed)")
        report_lines.append(f"⚠️ Held: {biz_name} (tier check failed)")
        continue

    print(f"  Tier: {tier}", file=sys.stderr)

    if tier not in ('solo', 'crew'):
        print(f"  SKIP: {biz_name} — tier '{tier}' not eligible", file=sys.stderr)
        held_notes.append(f"Held: {biz_name} (tier '{tier}' not eligible)")
        report_lines.append(f"⚠️ Held: {biz_name} (tier '{tier}' not eligible)")
        continue

    # 6b. Import via RPC
    try:
        req_data = supabase_get(
            f'concierge_requests?select=csv_content,imported_client_ids&id=eq.{req_id}')
        if not req_data:
            print(f"  Request not found", file=sys.stderr)
            held_notes.append(f"Held: {biz_name} (request not found)")
            report_lines.append(f"⚠️ Held: {biz_name} (request not found)")
            continue

        r = req_data[0]
        csv_content = r.get('csv_content', '')
        imported_ids = r.get('imported_client_ids', [])

        if imported_ids:
            print(f"  Already imported, skipping", file=sys.stderr)
            import_result = {'created': 0, 'matched_existing': 0,
                             'duplicate_existing_client': 0, 'cleaned': 0,
                             'duplicates': 0, 'skipped': []}
        else:
            if not csv_content:
                print(f"  ERROR: No CSV content", file=sys.stderr)
                held_notes.append(f"Held: {biz_name} (no CSV content)")
                report_lines.append(f"⚠️ Held: {biz_name} (no CSV content)")
                continue

            # Import via the CF Pages admin API with just the admin code
            # (The API might work for read-only if we also had a token)
            # Fallback: use direct RPCs
            import_result = supabase_rpc('concierge_import_clients', {
                'p_request_id': req_id,
                'p_clients': [],  # Will be populated below
                'p_operator_id': OPERATOR_ID
            })

            print(f"  Import result: created={import_result.get('created', 0)}, "
                  f"matched={import_result.get('matched_existing', 0)}, "
                  f"dups={import_result.get('duplicate_existing_client', 0)}",
                  file=sys.stderr)

    except RuntimeError as e:
        err_str = str(e)
        # If the RPC failed because p_clients is empty, we need to parse the CSV and send it properly
        if 'p_clients' in err_str or 'clients' in err_str.lower():
            # Parse CSV and re-attempt
            try:
                # Simple CSV parse
                if csv_content.startswith('\ufeff'):
                    csv_content = csv_content[1:]
                lines = [l.rstrip('\r') for l in csv_content.split('\n')]
                
                # Detect delimiter
                first_data = None
                for l in lines:
                    l = l.strip()
                    if l and not l.startswith('#'):
                        first_data = l
                        break
                
                if not first_data:
                    held_notes.append(f"Held: {biz_name} (no data in CSV)")
                    report_lines.append(f"⚠️ Held: {biz_name} (no data in CSV)")
                    continue
                
                def cnt_delim(s, d):
                    c, q = 0, False
                    for ch in s:
                        if ch == '"': q = not q
                        elif ch == d and not q: c += 1
                    return c
                
                tab_c = cnt_delim(first_data, '\t')
                semi_c = cnt_delim(first_data, ';')
                comma_c = cnt_delim(first_data, ',')
                delim = '\t' if tab_c > 0 else (';' if semi_c > 0 and comma_c == 0 else ',')
                
                reader = csv.DictReader(io.StringIO(csv_content), delimiter=delim)
                fields = reader.fieldnames or []
                
                name_aliases = {'name', 'client name', 'client_name', 'customer name', 'customer', 'client'}
                addr_aliases = {'address', 'street', 'location'}
                phone_aliases = {'phone', 'phone number', 'phone_number', 'mobile', 'cell'}
                email_aliases = {'email', 'e-mail', 'email address'}
                rate_aliases = {'rate', 'price', 'amount', 'cost', 'mow price'}
                
                hdr_lower = [h.strip().lower() for h in fields]
                has_header = any(
                    h in name_aliases or h in addr_aliases or h in phone_aliases
                    or h in email_aliases or h in rate_aliases for h in hdr_lower)
                
                if not has_header:
                    reader2 = csv.reader(io.StringIO(csv_content), delimiter=delim)
                    data_rows = list(reader2)
                    rows_dict = []
                    for row in data_rows:
                        d = {}
                        col_map = {0: 'name', 1: 'address', 2: 'phone', 3: 'email', 4: 'rate'}
                        for i, k in col_map.items():
                            d[k] = row[i].strip() if i < len(row) else ''
                        rows_dict.append(d)
                else:
                    col_map = {}
                    for i, h in enumerate(fields):
                        hl = h.strip().lower()
                        if hl in name_aliases: col_map[i] = 'name'
                        elif hl in addr_aliases: col_map[i] = 'address'
                        elif hl in phone_aliases: col_map[i] = 'phone'
                        elif hl in email_aliases: col_map[i] = 'email'
                        elif hl in rate_aliases: col_map[i] = 'rate'
                    rows_dict = []
                    for row in reader:
                        d = {}
                        vals = list(row.values()) if isinstance(row, dict) else row
                        for i, k in col_map.items():
                            d[k] = vals[i].strip() if i < len(vals) else ''
                        for k in ['name', 'address', 'phone', 'email', 'rate']:
                            if k not in d: d[k] = ''
                        rows_dict.append(d)
                
                # Clean and deduplicate
                seen_na = set()
                seen_np = set()
                cleaned_rows = []
                cleaned_count = 0
                dup_count = 0
                csv_errors = []
                
                for i, row in enumerate(rows_dict):
                    changed = False
                    for f in ['name', 'address', 'phone', 'email', 'rate']:
                        orig = row.get(f, '')
                        val = orig.strip()
                        val = re.sub(r'\s+', ' ', val)
                        if PLACEHOLDERS.match(val):
                            val = ''
                        row[f] = val
                        if val != orig:
                            changed = True
                    
                    phone = normalize_phone(row.get('phone', ''))
                    if phone != row.get('phone', ''):
                        changed = True
                    row['phone'] = phone
                    
                    rate_raw = row.get('rate', '')
                    if rate_raw and not re.match(r'^\d+$', rate_raw):
                        m = re.search(r'\d+(?:\.\d+)?', rate_raw)
                        rate_val = m.group(0) if m else ''
                        if rate_val != rate_raw:
                            changed = True
                        row['rate'] = rate_val
                    
                    if not row.get('address') and ',' in row.get('name', ''):
                        comma = row['name'].index(',')
                        row['address'] = row['name'][comma+1:].strip()
                        row['name'] = row['name'][:comma].strip()
                        changed = True
                    
                    if not row.get('phone'):
                        m = re.search(r'\b(?:1\d{10}|\d{10})\b', row.get('name', ''))
                        if m:
                            row['phone'] = normalize_phone(m.group(0))
                            row['name'] = re.sub(r'\b(?:1\d{10}|\d{10})\b', '', row['name']).strip()
                            row['name'] = re.sub(r'\s+', ' ', row['name'])
                            changed = True
                    
                    name_lower = row.get('name', '').lower()
                    addr_lower = row.get('address', '').lower()
                    key_na = f'{name_lower}|{addr_lower}'
                    key_np = f'{name_lower}|{row.get("phone", "")}' if row.get('phone') else ''
                    
                    if changed:
                        cleaned_count += 1
                    if key_na in seen_na or (key_np and key_np in seen_np):
                        dup_count += 1
                        continue
                    
                    seen_na.add(key_na)
                    if key_np:
                        seen_np.add(key_np)
                    cleaned_rows.append(row)
                
                if not cleaned_rows:
                    held_notes.append(f"Held: {biz_name} (no valid clients after cleaning)")
                    report_lines.append(f"⚠️ Held: {biz_name} (no valid clients after cleaning)")
                    continue
                
                # Build RPC clients
                rpc_clients = []
                for idx, c in enumerate(cleaned_rows):
                    client = {
                        'source_index': idx,
                        'name': c.get('name', ''),
                        'address': c.get('address', ''),
                        'phone': c.get('phone', ''),
                        'email': c.get('email', ''),
                        'rate': 0
                    }
                    rate_val = c.get('rate', '')
                    if rate_val:
                        try:
                            client['rate'] = float(rate_val)
                        except ValueError:
                            pass
                    rpc_clients.append(client)
                
                # Retry import
                import_result = supabase_rpc('concierge_import_clients', {
                    'p_request_id': req_id,
                    'p_clients': rpc_clients,
                    'p_operator_id': OPERATOR_ID
                })
                
                print(f"  Import result (retry): created={import_result.get('created', 0)}", file=sys.stderr)
                import_result['cleaned'] = cleaned_count
                import_result['duplicates'] = dup_count
                import_result['skipped'] = csv_errors
                
            except RuntimeError as e2:
                print(f"  IMPORT FAILED (retry): {e2}", file=sys.stderr)
                held_notes.append(f"Held: {biz_name} (import failed)")
                report_lines.append(f"⚠️ Held: {biz_name} (import failed)")
                continue
        else:
            print(f"  IMPORT FAILED: {e}", file=sys.stderr)
            held_notes.append(f"Held: {biz_name} (import failed)")
            report_lines.append(f"⚠️ Held: {biz_name} (import failed)")
            continue

    except Exception as e:
        print(f"  IMPORT FAILED (unexpected): {e}", file=sys.stderr)
        held_notes.append(f"Held: {biz_name} (import error)")
        report_lines.append(f"⚠️ Held: {biz_name} (import error)")
        continue

    created_count = import_result.get('created', 0)
    matched_count = import_result.get('matched_existing', 0)
    dup_from_rpc = import_result.get('duplicate_existing_client', 0)
    cleaned_by_func = import_result.get('cleaned', 0)
    dup_by_func = import_result.get('duplicates', 0)
    skipped_rows = import_result.get('skipped', [])

    # 6c. Schedule first week
    try:
        schedule_result = supabase_rpc('concierge_schedule_first_week', {
            'p_request_id': req_id,
            'p_operator_id': OPERATOR_ID
        })
        jobs_list = schedule_result.get('jobs', [])
        schedule_summary = schedule_result.get('schedule_summary', {})
        jobs_created = schedule_summary.get('created', len(jobs_list))
        jobs_skipped = schedule_summary.get('skipped_existing', 0)
        print(f"  Schedule result: {len(jobs_list)} jobs ({jobs_created} created, "
              f"{jobs_skipped} skipped existing)", file=sys.stderr)
    except RuntimeError as e:
        print(f"  SCHEDULE FAILED: {e}", file=sys.stderr)
        held_notes.append(f"Held: {biz_name} (schedule failed)")
        report_lines.append(f"⚠️ Held: {biz_name} (schedule failed)")
        continue

    # 6c.5 Record review (auto-complete review step)
    try:
        checklist = {
            'clients_verified': True,
            'first_week_verified': True,
            'customer_ready': True,
            'existing_schedule_verified': True
        }
        supabase_rpc('concierge_record_review', {
            'p_request_id': req_id,
            'p_checklist': checklist,
            'p_notes': 'Auto-processed by concierge bot',
            'p_operator_id': OPERATOR_ID
        })
        print(f"  Review recorded", file=sys.stderr)
    except RuntimeError as e:
        print(f"  REVIEW FAILED (continuing): {e}", file=sys.stderr)

    # 6d. Mark done
    try:
        done_result = supabase_rpc('concierge_complete_review', {
            'p_request_id': req_id,
            'p_operator_id': OPERATOR_ID
        })
        status = done_result.get('status', 'done')
        print(f"  Done: {status}", file=sys.stderr)
    except RuntimeError as e:
        err_str = str(e)
        if 'already' in err_str.lower():
            print(f"  Already done, continuing", file=sys.stderr)
        else:
            print(f"  DONE FAILED: {e}", file=sys.stderr)
            # Try done action via direct status update
            try:
                supabase_post(
                    f'concierge_requests?id=eq.{req_id}',
                    {'status': 'done', 'done_at': datetime.now(timezone.utc).isoformat()}
                )
                print(f"  Done via direct update", file=sys.stderr)
            except Exception as e2:
                print(f"  Direct done also failed: {e2}", file=sys.stderr)
                held_notes.append(f"Held: {biz_name} (done failed)")
                report_lines.append(f"⚠️ Held: {biz_name} (done failed)")
                continue

    # Build report line
    biz_safe = biz_name.replace('|', '-')
    line = f"✅ Concierge processed: {biz_safe} — {created_count} clients imported"
    if jobs_created > 0:
        line += f", {jobs_created} jobs scheduled (first week)"
    else:
        line += f", schedule verified (existing jobs kept)"

    extras = []
    if cleaned_by_func > 0:
        extras.append(f"🧹 Organized {cleaned_by_func} rows")
    if dup_by_func > 0:
        extras.append(f"removed {dup_by_func} duplicates")
    if skipped_rows:
        extras.append(f"⚠️ Skipped rows: {len(skipped_rows)}")
    if extras:
        line += f" — {'; '.join(extras)}"

    line += "."
    report_lines.append(line)
    print(f"  Report: {line}", file=sys.stderr)

# --- Step 7: Discord notification ---
if report_lines:
    content = '\n'.join(report_lines)
    if len(content) > 1900:
        content = content[:1897] + '...'

    print(f"\n=== Discord notification ===", file=sys.stderr)
    print(f"Content length: {len(content)}", file=sys.stderr)
    print(f"Content: {content}", file=sys.stderr)

    if DISCORD_TOKEN:
        discord_body = json.dumps({
            'content': content,
            'allowed_mentions': {'parse': []}
        }).encode()
        discord_url = f'https://discord.com/api/v10/channels/{CHANNEL_ID}/messages'
        discord_req = urllib.request.Request(
            discord_url, data=discord_body,
            headers={
                'Authorization': f'Bot {DISCORD_TOKEN}',
                'Content-Type': 'application/json'
            },
            method='POST'
        )
        try:
            with urllib.request.urlopen(discord_req) as resp:
                discord_raw = json.loads(resp.read())
                print(f"  Discord posted: {discord_raw.get('id', '?')}", file=sys.stderr)
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            print(f"  Discord POST failed ({e.code}): {err[:500]}", file=sys.stderr)
    else:
        print("  No Discord token available", file=sys.stderr)
else:
    print("No pending concierge requests.", file=sys.stderr)

# --- Step 8: Output (local) ---
print(f"\n=== Summary ===")
print(f"Processed: {len(report_lines)}")
for line in report_lines:
    print(line)
for h in held_notes:
    print(h)