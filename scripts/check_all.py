#!/usr/bin/env python3
import urllib.request, json

sb_key = None
with open('/opt/data/.env') as f:
    for line in f:
        if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
            sb_key = line.strip().split('=', 1)[1]
            break
if not sb_key:
    raise SystemExit('SUPABASE_SERVICE_ROLE_KEY not found')

sb_url = 'https://vqgiynfrpsqddjrayczc.supabase.co'
url = f'{sb_url}/rest/v1/concierge_requests?select=id,business_name,status,user_id,created_at&order=created_at.desc'
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}', 'Content-Type': 'application/json'}
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
        print(f'Total requests: {len(data)}')
        statuses = {}
        for r in data:
            s = r.get('status','unknown')
            statuses[s] = statuses.get(s,0)+1
        print(f'Status breakdown: {json.dumps(statuses)}')
        for r in data[:20]:
            print(f'  {r["id"][:8]}... {r["business_name"][:40]:40s} {r["status"]:10s} {r["created_at"]}')
except Exception as e:
    print(f'Error: {e}')
