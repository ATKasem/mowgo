#!/bin/bash
# MowGo concierge auto-processor
set -uo pipefail

ADMIN_CODE="$(cat /opt/data/secrets/concierge-admin-code.txt | tr -d '\n')"
SUPABASE_URL="$(grep '^SUPABASE_URL=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"
SVC_KEY="$(grep '^SUPABASE_SERVICE_KEY=' /opt/data/mowgo/server/.env | cut -d= -f2- | tr -d '\r\n')"
DISCORD_TOKEN="$(grep '^DISCORD_BOT_TOKEN=' /opt/data/.env | cut -d= -f2- | tr -d '\r\n')"
CHANNEL="1529248227394850916"

echo "ADMIN_CODE_LEN=${#ADMIN_CODE}"
echo "SUPABASE_URL=$SUPABASE_URL"
echo "SVC_KEY_LEN=${#SVC_KEY}"
echo "DISCORD_TOKEN_LEN=${#DISCORD_TOKEN}"

# Step 3: list requests
LIST_JSON="$(curl -s "https://mowgo.pages.dev/api/admin/concierge?action=list" -H "x-admin-code: $ADMIN_CODE")"
echo "=== LIST RESPONSE ==="
echo "$LIST_JSON"