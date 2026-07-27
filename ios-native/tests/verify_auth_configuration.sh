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

echo "Auth configuration checks passed"
