# Lead Nurture — Resend API Key Fix

## Problem
Lead Nurture cron (Day-2/Day-7 emails) returning 401 "API key is invalid" since Aug 12.

## Diagnosis
Confirmed: Resend API key `re_RZ4SjXeb_EqZjmrasGRvPKKk343LkaG29` returns 401 on direct API test.

## Fix
1. Go to https://resend.com/api-keys
2. Generate a new API key
3. Update `/opt/data/.env`: `RESEND_API_KEY=<new_key>`
4. Test: `python3 -c "
import urllib.request, json
req = urllib.request.Request(
    'https://api.resend.com/emails',
    data=json.dumps({'from':'MowGo <invoices@mowgoapp.com>','to':'test@resend.dev','subject':'test','html':'<p>test</p>'}).encode(),
    method='POST')
req.add_header('Authorization', 'Bearer <NEW_KEY>')
req.add_header('Content-Type', 'application/json')
req.add_header('User-Agent', 'Mozilla/5.0')
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        print('OK:', r.read().decode())
except Exception as e:
    print('FAIL:', e)
"`

## Note
The lead_nurture.py code itself is correct (User-Agent header already added, line 88). The fix is purely a key rotation.