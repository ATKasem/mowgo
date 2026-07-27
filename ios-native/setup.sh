#!/bin/bash
# MowGo iOS — one-command setup
# Run on your Mac: bash setup.sh
# Requires: xcodegen (brew install xcodegen)
#
# Uses project.yml (checked into repo). CI uses it as-is.
# Locally, env vars are injected before xcodegen runs.
set -e

echo ""
echo "🌱 MowGo iOS Setup"
echo "===================="
echo ""

# ── Check for xcodegen ──
if ! command -v xcodegen &>/dev/null; then
    echo "📦 Installing xcodegen..."
    brew install xcodegen
fi

# ── Clean previous build ──
rm -rf MowGo.xcodeproj MowGo.xcworkspace 2>/dev/null

# ── Inject credentials if available ──
if [ -n "$SUPABASE_URL" ]; then
    echo "🔑 Injecting Supabase credentials..."
    sed -i '' "s|\$(SUPABASE_URL)|${SUPABASE_URL}|g" project.yml
    sed -i '' "s|\$(SUPABASE_ANON_KEY)|${SUPABASE_ANON_KEY}|g" project.yml
fi
if [ -n "$STRIPE_PUBLISHABLE_KEY" ]; then
    sed -i '' "s|\$(STRIPE_PUBLISHABLE_KEY)|${STRIPE_PUBLISHABLE_KEY}|g" project.yml
fi

# ── Generate Xcode project ──
echo "🔨 Generating Xcode project..."
xcodegen generate

# ── Restore project.yml for next run ──
git checkout project.yml 2>/dev/null || true

# ── Done ──
echo ""
echo "✅ Done! Opening Xcode..."
echo ""
if [ -z "$SUPABASE_URL" ]; then
    echo "   ⚠️  No Supabase configured — app runs in DEMO MODE."
    echo "   To connect your backend:"
    echo "     export SUPABASE_URL='https://your-project.supabase.co'"
    echo "     export SUPABASE_ANON_KEY='sb_publishable_...'"
    echo "     export STRIPE_PUBLISHABLE_KEY='pk_live_...'"
    echo "     bash setup.sh"
fi
echo ""

open MowGo.xcodeproj
