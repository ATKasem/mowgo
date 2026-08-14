#!/usr/bin/env python3
import json, os

# Read env
with open('/opt/data/mowgo/server/.env') as f:
    env = {line.split('=', 1)[0]: line.split('=', 1)[1].strip()
           for line in f if '=' in line}
SUPABASE_URL = env.get('SUPABASE_URL', '')
SVC_KEY = env.get('SUPABASE_SERVICE_KEY', '')

import urllib.request
headers = {
    'apikey': SVC_KEY,
    'Authorization': f'Bearer {SVC_KEY}',
    'Content-Type': 'application/json'
}

req = urllib.request.Request(
    f'{SUPABASE_URL}/rest/v1/concierge_requests?select=id,business_name,status,created_at&order=created_at.asc',
    headers=headers)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
print(f'Total: {len(data)}')
pending = [r for r in data if r.get('status') == 'pending']
print(f'Pending: {len(pending)}')
for r in data:
    sid = (r.get('id') or '?')[:12]
    biz = r.get('business_name') or '?'
    st = r.get('status') or '?'
    ct = (r.get('created_at') or '?')[:16]
    print(f'  {sid}... | {biz} | status={st} | created={ct}')