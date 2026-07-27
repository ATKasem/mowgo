# iOS CI/CD Setup (One-Time)

This is the one-time setup to get automated TestFlight builds working via GitHub Actions. After this, you never open Xcode again.

## 1. Apple Developer Account
- Get an Apple Developer account ($99/yr): https://developer.apple.com
- Note your Team ID (visible in https://developer.apple.com/account → Membership)

## 2. App Store Connect API Key
- Go to https://appstoreconnect.apple.com/access/api
- Create a new API Key with "App Manager" role
- Download the `.p8` file and note the Key ID and Issuer ID

## 3. Fastlane Match (Certificate Storage)
The signing certificates are stored in the same repo (`ATKasem/mowgo.git`) via Fastlane Match with git storage mode. Run locally on your Mac:
```bash
cd client
bundle install                          # install fastlane from Gemfile
bundle exec fastlane match init         # generates Matchfile (already configured)
bundle exec fastlane match appstore     # generates signing certificates
```
This generates signing certificates and stores them encrypted in the git repo.

> **Security note:** Match encrypts certificates with `MATCH_PASSWORD` before
> committing. Never commit the password or the decrypted certs.

## 4. GitHub Secrets
Add these to your repo (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `MATCH_PASSWORD` | Password you set during match setup |
| `MATCH_GIT_TOKEN` | GitHub PAT with `repo` scope for the main repo |
| `ASC_KEY_ID` | App Store Connect API Key ID |
| `ASC_ISSUER_ID` | App Store Connect API Issuer ID |
| `ASC_KEY` | Contents of the `.p8` file (paste the full PEM text) |

## 5. Update Fastlane Config
Edit `client/fastlane/Appfile` and `client/fastlane/Matchfile` — replace `REPLACE_WITH_*` with your actual values.

## 6. Verify the Workflow
Push to main (or use `workflow_dispatch` in GitHub Actions) to trigger a build.
The workflow:
1. Checks out the repo
2. Installs Node.js dependencies and builds the web app
3. Syncs the web build into the Capacitor iOS project
4. Installs Ruby + Fastlane via Bundler
5. Runs `bundle exec fastlane ios beta` → signs + archives + uploads to TestFlight

Builds take 5-8 minutes on Apple Silicon macOS runners.

## Troubleshooting

**"No Xcode project found"** — Make sure the iOS project exists at `client/ios/App/App.xcodeproj`. Run `npx cap sync ios` from `client/` if missing.

**"No matching provisioning profiles"** — Re-run `bundle exec fastlane match appstore` locally to regenerate certificates.

**"No shared scheme"** — The scheme `App` must be shared. In Xcode: Product → Scheme → Manage Schemes → check "Shared" for the App scheme. Commit the `.xcscheme` file.
