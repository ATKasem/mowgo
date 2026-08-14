#!/bin/bash
set -uo pipefail
SUPABASE_URL="$(grep '^SUPABASE_URL=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"
SVC_KEY="$(grep '^SUPABASE_SERVICE_KEY=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"

# List all concierge requests
echo "=== ALL concierge_requests ==="
curl -s "${SUPABASE_URL}/rest/v1/concierge_requests?select=id,user_id,business_name,status,created_at" \
  -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY" | python3 -m json.tool

echo ""
echo "=== Profiles (operators/admins) ==="
curl -s "${SUPABASE_URL}/rest/v1/profiles?select=id,tier,email" \
  -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY" | python3 -m json.tool 2>/dev/null | head -60