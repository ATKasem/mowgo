# Android Play Store Setup (One-Time)

## 1. Google Play Developer Account
- $25 one-time fee: https://play.google.com/console/signup
- Note your developer name (shown on store)

## 2. Signing Key
Generate a signing keystore on your machine:
```bash
keytool -genkey -v -keystore mowgo-release.keystore -alias mowgo -keyalg RSA -keysize 2048 -validity 10000
```
Keep the keystore file and passwords safe — you can't recover them.

## 3. GitHub Secrets
Add to Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `ANDROID_KEYSTORE` | Base64 of mowgo-release.keystore (`base64 mowgo-release.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | Password from step 2 |
| `ANDROID_KEY_ALIAS` | `mowgo` (default from step 2) |
| `ANDROID_KEY_PASSWORD` | Password from step 2 (same as keystore or separate) |

## 4. Store Listing
Content is ready in `docs/PLAY_STORE.md` — copy into Play Console.

## 5. That's It
Push to main → GitHub Action builds → download AAB artifact → upload to Play Console.
Free on public repos, ~5-8 minute builds.
