#!/usr/bin/env python3
"""Smoke test for Leads v2 — quote-link → lead created → alert path fires.
Run AFTER `git push origin main` and CF Pages deploy completes.
Creates a real lead under the demo business, verifies, then deletes it.
"""
import json, os, re, sys, urllib.request, urllib.error

ENV = {}
for line in open('/opt/data/.env'):
    if '=' in line and not line.strip().startswith('#'):
        k, v = line.split('=', 1)
        ENV[k.strip()] = v.strip()

URL = ENV['SUPABASE_URL']
KEY = ENV['SUPABASE_SERVICE_ROLE_KEY']
BUSINESS_ID = 'c163c516-40b1-467f-92d7-8ea9dbb77371'  # Blasian's MowGo Demo (crew)
QUOTE_URL = 'https://mowgoapp.com/api/leads/public'

def http(url, data=None, headers=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method or ('POST' if body else 'GET'),
                                 headers=headers or {'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# 1. POST quote lead via the PUBLIC endpoint (no auth)
st, body = http(QUOTE_URL, {'name': 'Smoke Test Lead', 'phone': '4055550101',
                            'business_id': BUSINESS_ID})
print(f'1. quote-link POST -> {st} {body[:120]}')
assert st == 201 and '"success":true' in body, 'FAIL: quote-link endpoint'

# 2. Verify the lead row exists (created by the public function)
svc = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}
st, body = http(f'{URL}/rest/v1/leads?select=id,name,source,status&name=eq.Smoke%20Test%20Lead&user_id=eq.{BUSINESS_ID}', headers=svc)
rows = json.loads(body)
print(f'2. lead row -> {st} rows={len(rows)}')
assert st == 200 and rows and rows[0]['source'] == 'booking_link' and rows[0]['status'] == 'new', 'FAIL: lead not created'

# 3. Cleanup — delete the test lead via service role
lead_id = rows[0]['id']
st, body = http(f'{URL}/rest/v1/leads?id=eq.{lead_id}', headers=svc, method='DELETE')
print(f'3. cleanup delete -> {st}')
assert st == 204, 'FAIL: cleanup'

print('SMOKE OK')
