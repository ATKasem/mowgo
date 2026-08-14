#!/bin/bash
# MowGo concierge auto-processor — direct Supabase access
set -uo pipefail

ADMIN_CODE="$(cat /opt/data/secrets/concierge-admin-code.txt | tr -d '\n')"
SUPABASE_URL="$(grep '^SUPABASE_URL=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"
SVC_KEY="$(grep '^SUPABASE_SERVICE_KEY=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"
DISCORD_TOKEN="$(grep '^DISCORD_BOT_TOKEN=' /opt/data/.env | cut -d= -f2- | tr -d '\r\n')"
CHANNEL="1529248227394850916"

AUTH_HEADERS="apikey: $SVC_KEY"
AUTH_HEADERS2="Authorization: Bearer $SVC_KEY"

# Step 3: List requests directly from Supabase
echo "=== Listing concierge requests ==="
REQUESTS=$(curl -s "${SUPABASE_URL}/rest/v1/concierge_requests?select=*&order=created_at.asc" \
  -H "$AUTH_HEADERS" -H "$AUTH_HEADERS2" -H "Content-Type: application/json")
echo "$REQUESTS" | python3 -c "import sys,json; data=json.load(sys.stdin); print(f'Total requests: {len(data)}')" 2>/dev/null || echo "Raw: $REQUESTS" | head -c 200

# Count pending
PENDING=$(echo "$REQUESTS" | python3 -c "
import sys,json
data=json.load(sys.stdin)
pending=[r for r in data if r.get('status')=='pending']
pending.sort(key=lambda r: r.get('created_at',''))
print(f'PENDING_COUNT={len(pending)}')
for r in pending:
    print(f'PENDING|{r[\"id\"]}|{r.get(\"business_name\",\"?\")}|{r.get(\"user_id\",\"?\")}|{r.get(\"created_at\",\"?\")}')
" 2>/dev/null) || echo "Parse error"

echo "$PENDING"
PENDING_COUNT=$(echo "$PENDING" | grep '^PENDING_COUNT=' | cut -d= -f2)
echo "Pending count: $PENDING_COUNT"

if [ -z "$PENDING_COUNT" ] || [ "$PENDING_COUNT" = "0" ]; then
  echo "No pending concierge requests."
  exit 0
fi

# Weekly cap check
MONDAY=$(python3 -c "
from datetime import datetime, timezone, timedelta
now = datetime.now(timezone.utc)
# Monday 00:00 UTC of current week
monday = now - timedelta(days=now.weekday())
monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
print(monday.isoformat())
")
echo "Monday 00:00 UTC: $MONDAY"

# Count done requests this week
DONE_COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/concierge_requests?select=id&status=eq.done&done_at=gte.${MONDAY}&order=created_at.asc" \
  -H "$AUTH_HEADERS" -H "$AUTH_HEADERS2" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "Done this week: $DONE_COUNT"

if [ -n "$DONE_COUNT" ] && [ "$DONE_COUNT" -ge 20 ] 2>/dev/null; then
  echo "Weekly concierge cap reached (20) — $PENDING_COUNT pending held"
  exit 0
fi

# Process each pending request
REPORT_LINES=()
HELD_LINES=()
SKIP_HELD_LINES=()

echo "$PENDING" | grep '^PENDING|' | while IFS='|' read -r _ REQ_ID BIZ_NAME USER_ID CREATED; do
  echo ""
  echo "=== Processing: $BIZ_NAME (ID: $REQ_ID) ==="
  
  # Tier check
  PROFILE_JSON=$(curl -s "${SUPABASE_URL}/rest/v1/profiles?select=tier,trial_ends_at&id=eq.${USER_ID}" \
    -H "$AUTH_HEADERS" -H "$AUTH_HEADERS2")
  TIER=$(echo "$PROFILE_JSON" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0].get('tier','') if data else '')" 2>/dev/null)
  echo "Tier: $TIER"
  
  if [ "$TIER" != "solo" ] && [ "$TIER" != "crew" ]; then
    echo "SKIP: $BIZ_NAME — tier $TIER not eligible"
    echo "HELD|$BIZ_NAME|tier $TIER not eligible" >> /tmp/concierge_held.txt
    continue
  fi
  
  # Import
  IMPORT_RESPONSE=$(curl -s -X POST "https://mowgo.pages.dev/api/admin/concierge" \
    -H "x-admin-code: $ADMIN_CODE" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"import\",\"request_id\":\"$REQ_ID\"}")
  echo "Import response: $IMPORT_RESPONSE"
  
  # Check if error (but "User is not on an active paid plan" is a valid error we handle)
  IMPORT_ERROR=$(echo "$IMPORT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null)
  if [ -n "$IMPORT_ERROR" ]; then
    echo "IMPORT FAILED: $IMPORT_ERROR"
    echo "HELD|$BIZ_NAME|$IMPORT_ERROR" >> /tmp/concierge_held.txt
    continue
  fi
  
  CREATED=$(echo "$IMPORT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('created',0))" 2>/dev/null)
  SKIPPED=$(echo "$IMPORT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('skipped',[]))" 2>/dev/null)
  CLEANED=$(echo "$IMPORT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cleaned',0))" 2>/dev/null)
  DUPLICATES=$(echo "$IMPORT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('duplicates',0))" 2>/dev/null)
  echo "Created: $CREATED, Cleaned: $CLEANED, Duplicates: $DUPLICATES"
  
  # Schedule
  SCHEDULE_RESPONSE=$(curl -s -X POST "https://mowgo.pages.dev/api/admin/concierge" \
    -H "x-admin-code: $ADMIN_CODE" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"schedule\",\"request_id\":\"$REQ_ID\"}")
  echo "Schedule response: $SCHEDULE_RESPONSE"
  
  SCHED_ERROR=$(echo "$SCHEDULE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null)
  if [ -n "$SCHED_ERROR" ]; then
    echo "SCHEDULE FAILED: $SCHED_ERROR"
    echo "HELD|$BIZ_NAME|schedule failed: $SCHED_ERROR" >> /tmp/concierge_held.txt
    continue
  fi
  
  JOBS_COUNT=$(echo "$SCHEDULE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('jobs',[])))" 2>/dev/null)
  echo "Jobs scheduled: $JOBS_COUNT"
  
  # Mark done
  DONE_RESPONSE=$(curl -s -X POST "https://mowgo.pages.dev/api/admin/concierge" \
    -H "x-admin-code: $ADMIN_CODE" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"done\",\"request_id\":\"$REQ_ID\"}")
  echo "Done response: $DONE_RESPONSE"
  
  # Build report line
  REPORT_LINE="✅ Concierge processed: $BIZ_NAME — $CREATED clients imported, $JOBS_COUNT jobs scheduled (first week)."
  if [ "$CLEANED" -gt 0 ] || [ "$DUPLICATES" -gt 0 ]; then
    REPORT_LINE="$REPORT_LINE 🧹 Organized $CLEANED rows, removed $DUPLICATES duplicates."
  fi
  SKIP_STR=$(echo "$SKIPPED" | python3 -c "import sys,json; s=json.loads(sys.stdin); print('; '.join([f'row {x.get(\"row\",\"?\")}: {x.get(\"message\",\"\")}' for x in s]))" 2>/dev/null)
  if [ -n "$SKIP_STR" ] && [ "$SKIP_STR" != "[]" ]; then
    REPORT_LINE="$REPORT_LINE ⚠️ Skipped rows: $SKIP_STR"
  fi
  echo "$REPORT_LINE" >> /tmp/concierge_report.txt
done

# Wait for all background jobs
wait

echo ""
echo "=== DONE ==="