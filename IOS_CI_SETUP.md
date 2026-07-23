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
- Create a **private** GitHub repo called `mowflow-certs`
- Generate a GitHub Personal Access Token with `repo` scope
- Run locally on your Mac:
```bash
cd client
bundle exec fastlane match init
# Edit Matchfile — use the values from above
bundle exec fastlane match appstore
```
This generates signing certificates and stores them in the private repo.

## 4. GitHub Secrets
Add these to your repo (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `MATCH_PASSWORD` | Password you set during match setup |
| `MATCH_GIT_TOKEN` | GitHub PAT for mowflow-certs repo |
| `ASC_KEY_ID` | App Store Connect API Key ID |
| `ASC_ISSUER_ID` | App Store Connect API Issuer ID |
| `ASC_KEY` | Contents of the `.p8` file |

## 5. Update Fastlane Config
Edit `client/fastlane/Appfile` and `client/fastlane/Matchfile` — replace `REPLACE_WITH_*` with your actual values.

## That's It
Push to main → GitHub Action builds → TestFlight. 5-8 minute builds on Apple Silicon macOS runners. Free for public repos.
