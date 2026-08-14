#!/bin/bash
set -uo pipefail
SUPABASE_URL="$(grep '^SUPABASE_URL=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"
SVC_KEY="$(grep '^SUPABASE_SERVICE_KEY=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"

echo "=== concierge_requests ==="
curl -s "${SUPABASE_URL}/rest/v1/concierge_requests?select=*" \
  -H "apikey: ${SVC_KEY}" -H "Authorization: Bearer ${SVC_KEY}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Count: {len(data)}')
for r in data:
    print(f'  {r.get(\"id\",\"?\")[:8]}... | {r.get(\"business_name\",\"?\")} | {r.get(\"status\",\"?\")} | user={r.get(\"user_id\",\"?\")[:8]}...')
"
echo "=== profiles count ==="
curl -s "${SUPABASE_URL}/rest/v1/profiles?select=id,tier" \
  -H "apikey: ${SVC_KEY}" -H "Authorization: Bearer ${SVC_KEY}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Count: {len(data)}')
for r in data[:5]:
    print(f'  {r.get(\"id\",\"?\")[:8]}... | tier={r.get(\"tier\",\"?\")}')
if len(data) > 5:
    print(f'  ... and {len(data)-5} more')
"