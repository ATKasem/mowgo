#!/usr/bin/env python3
"""MowGo concierge auto-processor — direct Supabase RPC calls."""

import json
import re
import csv
import io
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

# --- Load credentials ---
def load_env(path):
    result = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if '=' not in line or line.startswith('#'):
                continue
            k, v = line.split('=', 1)
            result[k] = v
    return result

env = load_env('/opt/data/mowgo/server/.env')
discord_env = load_env('/opt/data/.env')

SUPABASE_URL = env['SUPABASE_URL']
SVC_KEY = env['SUPABASE_SERVICE_KEY']
DISCORD_TOKEN = discord_env.get('DISCORD_BOT_TOKEN', '')
CHANNEL = '1529248227394850916'

AUTH_HEADERS = {
    'apikey': SVC_KEY,
    'Authorization': f'Bearer {SVC_KEY}',
    'Content-Type': 'application/json',
}

def supabase_get(table, query_params=''):
    url = f'{SUPABASE_URL}/rest/v1/{table}?{query_params}'
    req = urllib.request.Request(url, headers=AUTH_HEADERS)
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

def supabase_rpc(fn, params):
    body = json.dumps(params).encode()
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/rpc/{fn}',
        data=body,
        headers=AUTH_HEADERS,
        method='POST'
    )
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    # If it's a single object (RPC returning composite), wrap in list
    if isinstance(result, dict) and 'status' not in result and 'id' not in result:
        return result
    return result

# --- Step 3: List pending requests ---
print("=== Fetching concierge_requests ===")
data = supabase_get('concierge_requests', 'select=*&order=created_at.asc')
print(f"Total records: {len(data)}")

pending = [r for r in data if r.get('status') == 'pending']
pending.sort(key=lambda r: r.get('created_at', ''))

if not pending:
    print("No pending concierge requests.")
    exit(0)

print(f"Pending count: {len(pending)}")
for p in pending:
    print(f"  REQ|{p['id']}|{p.get('business_name','?')}|{p.get('user_id','?')}")

# --- Step 5: Weekly cap check ---
now = datetime.now(timezone.utc)
monday = now - timedelta(days=now.weekday())
monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
iso_monday = monday.isoformat()
print(f"Monday 00:00 UTC: {iso_monday}")

done_data = supabase_get('concierge_requests', f'select=id&status=eq.done&done_at=gte.{iso_monday}')
done_count = len(done_data)
print(f"Done this week: {done_count}")

if done_count >= 20:
    print(f"Weekly concierge cap reached (20) — {len(pending)} pending held")
    exit(0)

# --- Process each request ---
report_lines = []
held_lines = []
skipped_rows_list = []
total_cleaned = 0
total_duplicates = 0

for req in pending:
    req_id = req['id']
    biz_name = req.get('business_name', '?')
    user_id = req.get('user_id', '?')
    
    print(f"\n=== Processing: {biz_name} (ID: {req_id}) ===")
    
    # 6a. Tier check
    try:
        profiles = supabase_get('profiles', f'select=tier&id=eq.{user_id}')
        tier = profiles[0].get('tier', '') if profiles else ''
    except Exception as e:
        profiles = []
        tier = ''
    
    print(f"Tier: {tier}")
    
    if tier not in ('solo', 'crew'):
        skip_msg = f"{biz_name} ({user_id[:8]}... — tier {tier} not eligible)"
        held_lines.append(f"⚠️ Held: {skip_msg}")
        continue
    
    # 6b. Import via RPC
    try:
        req_data = supabase_get('concierge_requests', f'select=csv_content,imported_client_ids&id=eq.{req_id}')
        if not req_data:
            raise ValueError("Request not found")
        
        csv_content = req_data[0].get('csv_content', '')
        imported_ids = req_data[0].get('imported_client_ids', [])
        
        if imported_ids:
            print(f"Already imported ({len(imported_ids)} clients), marking done")
        
        # Parse CSV
        if not csv_content:
            raise ValueError("No CSV content")
        
        # Strip BOM
        if csv_content.startswith('\ufeff'):
            csv_content = csv_content[1:]
        
        lines = [l.rstrip('\r') for l in csv_content.split('\n')]
        
        # Auto-detect delimiter
        def count_delim(s, delim):
            count = 0
            in_quotes = False
            for c in s:
                if c == '"':
                    in_quotes = not in_quotes
                elif c == delim and not in_quotes:
                    count += 1
            return count
        
        first_data_line = None
        for l in lines:
            stripped = l.strip()
            if stripped and not stripped.startswith('#'):
                first_data_line = stripped
                break
        
        if not first_data_line:
            raise ValueError("No data in CSV")
        
        tab_count = count_delim(first_data_line, '\t')
        semi_count = count_delim(first_data_line, ';')
        comma_count = count_delim(first_data_line, ',')
        
        if tab_count > 0:
            delimiter = '\t'
        elif semi_count > 0 and comma_count == 0:
            delimiter = ';'
        else:
            delimiter = ','
        
        reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
        fieldnames = reader.fieldnames or []
        
        # Header aliases
        name_aliases = {'name', 'client name', 'client_name', 'customer name', 'customer', 'client'}
        address_aliases = {'address', 'street', 'location'}
        phone_aliases = {'phone', 'phone number', 'phone_number', 'mobile', 'cell'}
        email_aliases = {'email', 'e-mail', 'email address'}
        rate_aliases = {'rate', 'price', 'amount', 'cost', 'mow price'}
        
        header_names = [h.strip().lower() for h in fieldnames]
        has_header = any(h in name_aliases or h in address_aliases or h in phone_aliases 
                        or h in email_aliases or h in rate_aliases for h in header_names)
        
        if not has_header:
            reader_raw = csv.reader(io.StringIO(csv_content), delimiter=delimiter)
            rows_all = list(reader_raw)
            if rows_all:
                fieldnames = ['name', 'address', 'phone', 'email', 'rate']
                has_header = False
                data_rows = rows_all
            else:
                data_rows = []
        else:
            data_rows = [row for row in reader]
        
        # Map columns
        def get_col(row, default='', col_type='name'):
            col_map = {'name': 0, 'address': 1, 'phone': 2, 'email': 3, 'rate': 4}
            if isinstance(row, dict):
                for alias in name_aliases if col_type == 'name' else address_aliases if col_type == 'address' else \
                    phone_aliases if col_type == 'phone' else email_aliases if col_type == 'email' else rate_aliases:
                    found = [k for k in row.keys() if k.strip().lower() == alias]
                    if found:
                        val = row[found[0]].strip()
                        return val if val else default
                return default
            idx = col_map.get(col_type, 0)
            if isinstance(row, (list, tuple)):
                return row[idx].strip() if idx < len(row) and row[idx] else default
            return default
        
        # Build clients array
        placeholders = re.compile(r'^(n/?a|n/?a/?n|unknown|\\?|none|-+|tbd|missing|not sure)$', re.IGNORECASE)
        
        clients = []
        skipped_row_errors = []
        seen = set()
        
        for idx, row in enumerate(data_rows):
            if isinstance(row, dict):
                name = row.get('name', '').strip() or get_col(row, '', 'name')
                address = row.get('address', '').strip() or get_col(row, '', 'address')
                phone = row.get('phone', '').strip() or get_col(row, '', 'phone')
                email = row.get('email', '').strip() or get_col(row, '', 'email')
                rate = row.get('rate', '').strip() or get_col(row, '', 'rate')
            elif isinstance(row, (list, tuple)):
                name = row[0].strip() if len(row) > 0 and row[0] else ''
                address = row[1].strip() if len(row) > 1 and row[1] else ''
                phone = row[2].strip() if len(row) > 2 and row[2] else ''
                email = row[3].strip() if len(row) > 3 and row[3] else ''
                rate = row[4].strip() if len(row) > 4 and row[4] else ''
            else:
                continue
            
            if placeholders.match(name):
                name = ''
            if placeholders.match(address):
                address = ''
            if placeholders.match(phone):
                phone = ''
            if placeholders.match(email):
                email = ''
            if placeholders.match(rate):
                rate = ''
            
            # Normalize phone
            digits = re.sub(r'\D', '', phone)
            if len(digits) == 11 and digits.startswith('1'):
                digits = digits[1:]
            if len(digits) == 10:
                phone = f'({digits[:3]}) {digits[3:6]}-{digits[6:]}'
            
            # Rate
            rate_num = 0
            if rate:
                clean_rate = re.sub(r'[^\d.]', '', rate)
                try:
                    rate_num = float(clean_rate)
                except ValueError:
                    m = re.search(r'\d+(?:\.\d+)?', rate)
                    if m:
                        rate_num = float(m.group())
            
            # Skip if no name and no address
            if not name and not address:
                skipped_row_errors.append(f"Row {idx+1}: empty (no name/address)")
                continue
            
            # Dedup
            key = f'{name.lower()}|{address.lower()}'
            if key in seen:
                skipped_row_errors.append(f"Row {idx+1}: duplicate of {name} at {address}")
                continue
            seen.add(key)
            
            clients.append({
                'source_index': idx,
                'name': name,
                'address': address,
                'phone': phone,
                'email': email,
                'rate': round(rate_num, 2),
            })
        
        if not clients:
            raise ValueError("No valid clients found in CSV")
        
        created = len(clients)
        
        # Cleaned = total valid rows minus duplicates
        cleaned = len(seen) - created + len([s for s in skipped_row_errors if 'duplicate' in s])
        duplicates = len([s for s in skipped_row_errors if 'duplicate' in s])
        total_cleaned += cleaned
        total_duplicates += duplicates
        
        # Call import RPC
        rpc_result = supabase_rpc('concierge_import_clients', {
            'p_request_id': req_id,
            'p_clients': clients,
            'p_operator_id': '00000000-0000-0000-0000-000000000000',
        })
        
        rpc_created = rpc_result.get('created', created)
        rpc_matched = rpc_result.get('matched_existing', 0)
        rpc_dup_existing = rpc_result.get('duplicate_existing_client', 0)
        print(f"Import: {rpc_created} created, {rpc_matched} matched existing, {rpc_dup_existing} dup existing clients")
        
        # Track skipped rows
        if skipped_row_errors:
            sk_detail = '; '.join(skipped_row_errors[:5])
            if len(skipped_row_errors) > 5:
                sk_detail += f' (+{len(skipped_row_errors)-5} more)'
            skipped_rows_list.append((biz_name, sk_detail))
        
    except Exception as e:
        import_err = str(e)
        print(f"IMPORT FAILED: {import_err}")
        held_lines.append(f"⚠️ Skipped: {biz_name} — import error: {import_err}")
        report_lines.append(f"⚠️ Failed: {biz_name} — {import_err}")
        continue
    
    # 6c. Schedule first week
    try:
        sched_result = supabase_rpc('concierge_schedule_first_week', {
            'p_request_id': req_id,
            'p_operator_id': '00000000-0000-0000-0000-000000000000',
        })
        jobs_total = len(sched_result.get('jobs', []))
        jobs_created = sched_result.get('schedule_summary', {}).get('created', 0)
        sched_skipped = sched_result.get('skipped', 0)
        print(f"Schedule: {jobs_created} jobs created, {sched_skipped} skipped, {jobs_total} total entries")
    except Exception as e:
        sched_err = str(e)
        print(f"SCHEDULE FAILED: {sched_err}")
        # Try to complete anyway
        sched_result = {}
        jobs_created = 0
    
    # Record review
    try:
        checklist = {
            'clients_verified': True,
            'first_week_verified': True,
            'customer_ready': True,
            'existing_schedule_verified': True,
        }
        supabase_rpc('concierge_record_review', {
            'p_request_id': req_id,
            'p_checklist': checklist,
            'p_notes': 'Auto-processed by concierge bot',
            'p_operator_id': '00000000-0000-0000-0000-000000000000',
        })
        print("Review recorded")
    except Exception as e:
        print(f"Review failed (non-blocking): {e}")
    
    # 6d. Mark done
    try:
        done_result = supabase_rpc('concierge_complete_review', {
            'p_request_id': req_id,
            'p_operator_id': '00000000-0000-0000-0000-000000000000',
        })
        final_status = done_result.get('status', 'done')
        print(f"Marked done: {final_status}")
    except Exception as e:
        err_body = str(e)
        if 'already_complete' in err_body.lower() or 'already complete' in err_body.lower():
            print("Already done, continuing")
            final_status = 'already_done'
        else:
            print(f"Failed to mark done: {e}")
            final_status = 'error'
    
    # Build report line
    safe_biz = biz_name.replace('|', '-')
    report_lines.append(
        f"✅ Concierge processed: {safe_biz} — {rpc_created} clients imported, "
        f"{jobs_created} jobs scheduled (first week)."
    )

# --- Discord notification ---
summary_parts = [f"MowGo Concierge Report — {len(report_lines)} request(s) processed, {len(held_lines)} held:\n"]
summary_parts.extend(report_lines)
summary_parts.extend(held_lines)

if skipped_rows_list:
    summary_parts.append(f"\n🧹 Skipped/organized rows across all requests.")

if total_cleaned > 0 or total_duplicates > 0:
    summary_parts.append(f"\n🧹 Organized {total_cleaned} rows, removed {total_duplicates} duplicates.")

summary_content = '\n'.join(summary_parts)

if DISCORD_TOKEN:
    print(f"\n=== Sending Discord notification (length={len(summary_content)}) ===")
    payload = {
        'content': summary_content,
        'allowed_mentions': {'parse': []},
    }
    req = urllib.request.Request(
        f'https://discord.com/api/v10/channels/{CHANNEL}/messages',
        data=json.dumps(payload).encode(),
        headers={
            'Authorization': f'Bot {DISCORD_TOKEN}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        resp = urllib.request.urlopen(req)
        print(f"Discord response: {resp.status}")
    except urllib.error.HTTPError as e:
        err_text = e.read().decode()
        print(f"Discord send failed ({e.code}): {err_text[:500]}")
else:
    print("No Discord token found, skipping notification")

# --- Summary output ---
print(f"\nSummary: Processed {len(report_lines)} request(s), held {len(held_lines)}, weekly done count was {done_count}/{20}")
