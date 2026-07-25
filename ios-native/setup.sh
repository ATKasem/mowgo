#!/bin/bash
# MowFlow iOS — one-command setup
# Run on your Mac: bash setup.sh
# Requires: xcodegen (brew install xcodegen)
set -e

echo ""
echo "🌱 MowFlow iOS Setup"
echo "===================="
echo ""

# ── Check for xcodegen ──
if ! command -v xcodegen &>/dev/null; then
    echo "📦 Installing xcodegen..."
    brew install xcodegen
fi

# ── Clean old project ──
rm -rf MowFlow.xcodeproj MowFlow.xcworkspace project.yml 2>/dev/null

# ── Check for credentials ──
if [ -z "$SUPABASE_URL" ]; then
    echo ""
    echo "⚠️  SUPABASE_URL not set."
    echo "   The app will run in DEMO MODE until you configure it."
    echo "   To connect your Supabase backend later:"
    echo "     export SUPABASE_URL='https://your-project.supabase.co'"
    echo "     export SUPABASE_ANON_KEY='sb_publishable_...'"
    echo "     export STRIPE_PUBLISHABLE_KEY='pk_live_...'"
    echo "     bash setup.sh   # re-run to apply"
    echo ""
fi

# ── Write project.yml ──
cat > project.yml << YML
name: MowFlow
options:
  bundleIdPrefix: com.mowflow
  deploymentTarget:
    iOS: "17.0"
  xcodeVersion: "16.0"
targets:
  MowFlow:
    type: application
    platform: iOS
    sources:
      - path: MowFlow
    settings:
      base:
        GENERATE_INFOPLIST_FILE: YES
        INFOPLIST_KEY_CFBundleDisplayName: MowFlow
        INFOPLIST_KEY_CFBundleIdentifier: com.mowflow.app
        INFOPLIST_KEY_CFBundleShortVersionString: "1.0.0"
        INFOPLIST_KEY_CFBundleVersion: "1"
        INFOPLIST_KEY_UIApplicationSceneManifest_Generation: YES
        INFOPLIST_KEY_UISupportedInterfaceOrientations: UIInterfaceOrientationPortrait
        INFOPLIST_KEY_UILaunchScreen_Generation: YES
        INFOPLIST_KEY_UIStatusBarStyle: UIStatusBarStyleDarkContent
        INFOPLIST_KEY_UIViewControllerBasedStatusBarAppearance: NO
        PRODUCT_BUNDLE_IDENTIFIER: com.mowflow.app
        # ── Credentials (set via env vars or edit below) ──
        INFOPLIST_KEY_SUPABASE_URL: "${SUPABASE_URL:-}"
        INFOPLIST_KEY_SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}"
        INFOPLIST_KEY_StripePublishableKey: "${STRIPE_PUBLISHABLE_KEY:-}"
    dependencies:
      - package: stripe-ios
        product: StripePayments
packages:
  stripe-ios:
    url: https://github.com/stripe/stripe-ios.git
    from: 23.0.0
YML

# ── Generate Xcode project ──
echo "🔨 Generating Xcode project..."
xcodegen generate
rm -f project.yml

# ── Done ──
echo ""
echo "✅ Done! Opening Xcode..."
echo ""
echo "   To connect your backend (optional):"
echo "     export SUPABASE_URL='https://your-project.supabase.co'"
echo "     export SUPABASE_ANON_KEY='sb_publishable_...'"
echo "     bash setup.sh"
echo ""
echo "   Without credentials, the app runs in DEMO MODE."
echo ""

open MowFlow.xcodeproj
