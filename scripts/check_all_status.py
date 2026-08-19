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

# Check counts per status
for status in ['pending', 'importing', 'review', 'done', 'skipped']:
    url = f'{sb_url}/rest/v1/concierge_requests?select=id,status&status=eq.{status}'
    headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            print(f'{status}: {len(data)}')
    except Exception as e:
        print(f'{status}: error - {e}')
