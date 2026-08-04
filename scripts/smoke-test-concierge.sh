#!/usr/bin/env bash
# Smoke test for concierge endpoints (run AFTER deploy + migration applied).
# Usage: bash scripts/smoke-test-concierge.sh [admin-code]
set -u
BASE="https://mowgo.pages.dev"
ADMIN_CODE="${1:-}"

pass=0; fail=0
check() { # $1 = description, $2 = actual, $3 = expected substring
  if [[ "$2" == *"$3"* ]]; then echo "✅ $1"; pass=$((pass+1)); else echo "❌ $1 — got: ${2:0:120}"; fail=$((fail+1)); fi
}

# 1. CORS preflight
OUT=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE/api/concierge-submit" \
  -H "Origin: https://mowgo.pages.dev" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,authorization")
check "concierge-submit OPTIONS 204" "$OUT" "204"

# 2. Submit with NO token + valid body → 401 (auth path)
OUT=$(curl -s -X POST "$BASE/api/concierge-submit" -H "Content-Type: application/json" -d '{"business_name":"Test","csv_content":"a,b"}')
check "submit no-token 401" "$OUT" "Invalid token"

# 3. Submit with FAKE token → 401 (env vars present, auth verifies)
OUT=$(curl -s -X POST "$BASE/api/concierge-submit" -H "Content-Type: application/json" -H "Authorization: Bearer fake-token-123" \
  -d '{"business_name":"Test","csv_content":"a,b"}')
check "submit fake-token 401" "$OUT" "Invalid token"

# 4. Admin list, no code → 401
OUT=$(curl -s "$BASE/api/admin/concierge?action=list")
check "admin no-code 401" "$OUT" "Unauthorized"

# 5. Admin list, wrong code → 401
OUT=$(curl -s "$BASE/api/admin/concierge?action=list" -H "x-admin-code: wrong-code")
check "admin wrong-code 401" "$OUT" "Unauthorized"

# 6. Admin list, correct code → 200 with requests (migration must be applied)
if [[ -n "$ADMIN_CODE" ]]; then
  OUT=$(curl -s -w "|%{http_code}" "$BASE/api/admin/concierge?action=list" -H "x-admin-code: $ADMIN_CODE")
  check "admin list 200" "$OUT" "|200"
  check "admin list has requests key" "$OUT" "requests"
else
  echo "⚠️  admin-code not passed — skipping list check (pass it as arg 1 to test)"
fi

echo "---"; echo "PASS: $pass  FAIL: $fail"
[[ $fail -eq 0 ]]
