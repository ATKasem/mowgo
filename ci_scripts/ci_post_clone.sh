#!/bin/bash
# Xcode Cloud post-clone script for MowFlow Capacitor iOS
# Runs automatically after repo clone, before Xcode builds

set -e

echo "📦 MowFlow CI: Installing web dependencies..."
cd "$CI_WORKSPACE/client" || exit 1

# Use the same Node version as the project
export NODE_VERSION=$(cat .nvmrc 2>/dev/null || echo "22")
export HOMEBREW_NO_AUTO_UPDATE=1

# Install Node if needed (Xcode Cloud has nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if command -v nvm &>/dev/null; then
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"
fi

# Install dependencies + build web app
npm ci
npm run build

echo "📱 MowFlow CI: Syncing Capacitor..."
npx cap sync ios

echo "✅ MowFlow CI: Web build synced — Xcode can now archive"
