# MowGo — Capacitor Native App Setup

## Prerequisites (on your Mac)
- Xcode 16+ (App Store)
- Node.js 22+ (`node --version`)
- Apple Developer account ($99/year) — https://developer.apple.com

## One-Time Setup

```bash
cd /path/to/mowgo/client

# Install deps
npm install

# Build the web app
npm run build

# Add iOS platform (creates ios/ directory)
npx cap add ios

# Sync web build to native project
npx cap sync

# Open in Xcode
npx cap open ios
```

## Every Update

```bash
npm run build && npx cap sync
```

Then in Xcode: Product → Archive → Distribute App.

## iOS Icons

All required sizes are in `public/icon-*.png`. Xcode picks them up automatically from the asset catalog.

## Key Files
- `capacitor.config.json` — app ID, name, splash screen config (green background)
- `public/app-icon-1024.png` — master icon for App Store
- `public/icon-*.png` — all iOS icon sizes
- `APP_STORE.md` — App Store metadata, description, keywords

## Notes
- Live URL: https://mowgo.pages.dev
- Privacy policy: https://mowgo.pages.dev/privacy
- Capacitor wraps the same code into a native iOS app — same features, native feel
