#!/bin/bash
set -uo pipefail
SUPABASE_URL="$(grep '^SUPABASE_URL=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"
SVC_KEY="$(grep '^SUPABASE_SERVICE_KEY=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"

echo "=== Raw select=status ==="
curl -s -w "\nHTTP:%{http_code}" "${SUPABASE_URL}/rest/v1/concierge_requests?select=status" \
  -H "apikey: ${SVC_KEY}" -H "Authorization: Bearer ${SVC_KEY}" | tail -c 2000
echo ""
echo ""
echo "=== done this week (raw) ==="
MONDAY="2026-08-10T00:00:00+00:00"
curl -s -w "\nHTTP:%{http_code}" "${SUPABASE_URL}/rest/v1/concierge_requests?select=id&status=eq.done&done_at=gte.${MONDAY}" \
  -H "apikey: ${SVC_KEY}" -H "Authorization: Bearer ${SVC_KEY}" | tail -c 2000