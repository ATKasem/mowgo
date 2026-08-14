#!/bin/bash
# ============================================================
#  MowGo iOS — one-click open in Xcode (run on your Mac)
#  Double-click this file, or run: bash MowGo-iOS.command
# ============================================================
set -e

REPO="$HOME/mowgo"
IOS="$REPO/ios-native"

echo ""
echo "🌱 MowGo iOS — opening in Xcode"
echo "================================"

# 1. Get the code (clone once, pull after that)
if [ ! -d "$REPO/.git" ]; then
  echo "📦 Cloning MowGo (iOS only)..."
  git clone --filter=blob:none --sparse https://github.com/ATKasem/mowgo.git "$REPO"
  cd "$REPO"
  git sparse-checkout set ios-native
else
  echo "⬆️  Pulling latest code..."
  cd "$REPO"
  git pull
  git sparse-checkout set ios-native 2>/dev/null || true
fi

cd "$IOS"

# 2. Install xcodegen if missing (generates the .xcodeproj)
if ! command -v xcodegen &>/dev/null; then
  echo "📦 Installing xcodegen (one time)..."
  brew install xcodegen
fi

# 3. Generate the Xcode project
echo "🔨 Generating Xcode project..."
rm -rf MowGo.xcodeproj MowGo.xcworkspace 2>/dev/null || true
xcodegen generate
git checkout project.yml 2>/dev/null || true

# 4. Open it
echo "✅ Done — opening Xcode..."
open MowGo.xcodeproj

echo ""
echo "In Xcode: pick an iPhone simulator, then press Run ▶"
echo "Stripe + Supabase are already configured (live keys in project.yml)."
echo ""
