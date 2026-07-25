#!/bin/bash
# Run this on your Mac to create the MowFlow Xcode project
# Usage: bash setup.sh
set -e

echo "==> Creating MowFlow Xcode project..."

# Create fresh iOS app project
rm -rf MowFlow.app MowFlow.xcodeproj 2>/dev/null

# Use xcodegen if available, otherwise manual
if command -v xcodegen &>/dev/null; then
    echo "Using xcodegen..."
    cat > project.yml << 'YML'
name: MowFlow
options:
  bundleIdPrefix: com.mowflow
  deploymentTarget:
    iOS: "17.0"
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
        INFOPLIST_KEY_SUPABASE_URL: "https://vqgiynfrpsqddjrayczc.supabase.co"
        INFOPLIST_KEY_SUPABASE_ANON_KEY: "sb_publishable_C10u9M0wmcgAqDgkZoxm6g_eAsQSjpz"
        INFOPLIST_KEY_UIApplicationSceneManifest_Generation: YES
        INFOPLIST_KEY_UISupportedInterfaceOrientations: UIInterfaceOrientationPortrait
        INFOPLIST_KEY_UILaunchScreen_Generation: YES
        PRODUCT_BUNDLE_IDENTIFIER: com.mowflow.app
    dependencies:
      - package: stripe-ios
        product: StripePayments
packages:
  stripe-ios:
    url: https://github.com/stripe/stripe-ios.git
    from: 23.0.0
YML
    xcodegen generate
    rm project.yml
else
    echo "xcodegen not found — using SwiftPM approach"
    echo ""
    echo "Instead, do this in Xcode:"
    echo "  1. File → New → Project → iOS → App → MowFlow → Save"
    echo "  2. Delete ContentView.swift, Item.swift, MowFlowApp.swift from the project"
    echo "  3. Drag ALL files from the MowFlow/ folder into Xcode's MowFlow group"
    echo "  4. File → Add Package Dependencies → stripe-ios → StripePayments"
    echo "  5. Select MowFlow target → Build Settings → + → Add User-Defined:"
    echo "     INFOPLIST_KEY_SUPABASE_URL = https://vqgiynfrpsqddjrayczc.supabase.co"
    echo "     INFOPLIST_KEY_SUPABASE_ANON_KEY = sb_publishable_C10u9M0wmcgAqDgkZoxm6g_eAsQSjpz"
    echo "  6. Set iOS Deployment Target to 17.0"
    echo "  7. Cmd+R on iPhone simulator"
fi
