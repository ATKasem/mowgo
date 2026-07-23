# MowFlow — Capacitor Native App Setup

## Prerequisites (on your Mac)
- Xcode 26+ (App Store)
- Node.js 22+ (`node --version`)
- Apple Developer account ($99/year) — https://developer.apple.com

## One-Time Setup

```bash
cd /path/to/mowflow/client

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
- `capacitor.config.ts` — app ID, name, splash screen config
- `public/app-icon-1024.png` — master icon for App Store
- `public/icon-*.png` — all iOS icon sizes
- `APP_STORE.md` — App Store metadata, description, keywords

## Notes
- Privacy policy: https://mowflow.netlify.app/privacy
- The web app runs at https://mowflow.netlify.app (auto-deploys from GitHub)
- Capacitor wraps the same code into a native iOS app — same features, native feel
