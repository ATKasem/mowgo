#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

grep -q '@Published var isDemoMode = false' \
  "$ROOT/MowGo/Services/AuthService.swift"
grep -q 'isDemoMode = true' \
  "$ROOT/MowGo/Services/AuthService.swift"
grep -Fq 'SUPABASE_URL = https:/$()/vqgiynfrpsqddjrayczc.supabase.co' \
  "$ROOT/MowGo/Config.xcconfig"
grep -q '^SUPABASE_ANON_KEY = ' \
  "$ROOT/MowGo/Config.xcconfig"
grep -q 'INFOPLIST_KEY_SUPABASE_URL = \$(SUPABASE_URL)' \
  "$ROOT/MowGo/Config.xcconfig"
grep -q 'INFOPLIST_KEY_SUPABASE_ANON_KEY = \$(SUPABASE_ANON_KEY)' \
  "$ROOT/MowGo/Config.xcconfig"
grep -q 'Debug: MowGo/Config.xcconfig' "$ROOT/project.yml"
grep -q 'Release: MowGo/Config.xcconfig' "$ROOT/project.yml"
grep -Fq 'https://vqgiynfrpsqddjrayczc.supabase.co' \
  "$ROOT/MowGo/Services/SupabaseService.swift"
grep -Fq 'sb_publishable_C10u9M0wmcgAqDgkZoxm6g_eAsQSjpz' \
  "$ROOT/MowGo/Services/SupabaseService.swift"
grep -Fq 'pk_live_51TwFQhGwXKVLlr2Ip5FKKwDmcwcOyG9lTFgOr2k3ooyaoLhYYwdfKQOOfzBnwcFpFgl8hAe9QHRR80Af1Odv6WEy00PnQgQarj' \
  "$ROOT/MowGo/Services/StripeService.swift"

echo "Auth configuration checks passed"
