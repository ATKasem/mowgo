#!/usr/bin/env python3
import urllib.request, json

# Read credentials
sb_key = None
with open('/opt/data/.env') as f:
    for line in f:
        if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
            sb_key = line.strip().split('=', 1)[1]
            break
if not sb_key:
    raise SystemExit('SUPABASE_SERVICE_ROLE_KEY not found in .env')

sb_url = 'https://vqgiynfrpsqddjrayczc.supabase.co'
url = f'{sb_url}/rest/v1/concierge_requests?select=id,business_name,status,user_id,created_at&status=eq.pending&order=created_at.asc'

headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}', 'Content-Type': 'application/json', 'prefer': 'count=exact'}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
        print(f'Results: {len(data)}')
        for r in data:
            print(json.dumps(r))
except Exception as e:
    print(f'Error: {e}')
