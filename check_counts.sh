#!/bin/bash
set -uo pipefail
SUPABASE_URL="$(grep '^SUPABASE_URL=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"
SVC_KEY="$(grep '^SUPABASE_SERVICE_KEY=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"

# Count all statuses
curl -s "${SUPABASE_URL}/rest/v1/concierge_requests?select=status" \
  -H "apikey: ${SVC_KEY}" -H "Authorization: Bearer ${SVC_KEY}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Total: {len(data)}')
from collections import Counter
c = Counter(r.get('status') for r in data)
for s, n in c.most_common():
    print(f'  {s}: {n}')
"

# Also count done this week
MONDAY=$(python3 -c "
from datetime import datetime, timezone, timedelta
now = datetime.now(timezone.utc)
monday = now - timedelta(days=now.weekday())
monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
print(monday.isoformat())
")
echo "Monday: $MONDAY"
curl -s "${SUPABASE_URL}/rest/v1/concierge_requests?select=id&status=eq.done&done_at=gte.${MONDAY}" \
  -H "apikey: ${SVC_KEY}" -H "Authorization: Bearer ${SVC_KEY}" | python3 -c "import sys,json; print(f'Done this week: {len(json.load(sys.stdin))}')"