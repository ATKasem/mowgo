# MowGo iOS Native — Build Notes

**Date:** 2025-07-25  
**File count:** 22 Swift files (was 17)

---

## Files Modified (17)

| File | Changes |
|------|---------|
| `MowGo/Services/SupabaseService.swift` | Removed hardcoded anon key → reads from Info.plist via build settings. Added token persistence (save/restore/clear), token expiry tracking, auto-refresh on 401 with retry guard, `requestFunction()` for Edge Functions, `fetchProfile()`, request timeout. |
| `MowGo/Services/AuthService.swift` | Removed `isDemoMode = true` hardcode → now checks `SupabaseService.isConfigured`. Session restore on launch. Profile loading after auth. Demo mode only when Info.plist keys are missing. |
| `MowGo/Services/DataStore.swift` | All CRUD methods now work in both live and demo mode (guard on `sb.isConfigured`). Falls back to demo data gracefully. Added `refreshable` support. |
| `MowGo/MowGoApp.swift` | Updated splash screen. Added accessibility label on splash image. |
| `MowGo/Views/Auth/LoginView.swift` | Added `@FocusState` field management, `submitLabel`, `scrollDismissesKeyboard(.interactively)`, `DynamicTypeSize` capping, haptic feedback on submit, demo button only shown when `isDemoMode`. |
| `MowGo/Views/Home/HomeView.swift` | Added `.refreshable` pull-to-refresh, haptic feedback on quick actions, Dynamic Type support. |
| `MowGo/Views/Today/TodayView.swift` | Added `.refreshable`, haptic feedback on rain delay warning, Dynamic Type on date header. |
| `MowGo/Views/Today/NewJobFormView.swift` | Added haptic feedback on save. |
| `MowGo/Views/Clients/ClientsView.swift` | Added `.refreshable`, haptic on expand, Dynamic Type on names/details, `@FocusState` + keyboard toolbar on forms, `.sheet` for new client. |
| `MowGo/Views/Clients/NewClientFormView.swift` | Added `@FocusState` field navigation, `.submitLabel` chains, `textContentType` hints, keyboard toolbar "Done" button, `.scrollDismissesKeyboard(.interactively)`, haptic on save. |
| `MowGo/Views/Invoices/InvoicesView.swift` | Integrated Stripe payment — "Pay" button now opens `PaymentView` sheet. Haptic feedback on pay action. Renamed button to credit card icon. |
| `MowGo/Views/Components/MainTabView.swift` | Added "AI" tab for ChatView (tab index 3). Added `sensoryFeedback(.selection)` on tab switch. |
| `MowGo/Views/Components/JobCardView.swift` | Added `.buttonStyle(.plain)`, haptic on toggle, pet/lock icons for access info, Dynamic Type support, `.contentTransition(.symbolEffect(.replace))` for checkmark animation. |
| `MowGo/Views/Components/ReusableViews.swift` | Unchanged (already clean). |
| `MowGo/Views/Settings/SettingsView.swift` | Added subscription tiers view (Free/Solo/Crew), dynamic tier info from profile, version from Info.plist, backend status indicator, haptic on sign out, dark mode toggle with icon. |
| `MowGo/Color+Hex.swift` | Unchanged. |
| `MowGo/Package.swift` | Added `stripe-ios` SPM dependency. |

## Files Created (5)

| File | Description |
|------|-------------|
| `MowGo/Info.plist` | Build configuration — `SupabaseURL`, `SupabaseAnonKey` via `$(SUPABASE_URL)` build settings. Safe defaults for all UIKit manifest keys. |
| `MowGo/Services/StripeService.swift` | Stripe integration via Supabase Edge Functions — `createPaymentIntent()`, `confirmPayment()`, `createCheckoutSession()`. Reads publishable key from Info.plist. |
| `MowGo/Services/ChatService.swift` | AI Autopilot — sends conversation history to `ai-chat` Edge Function, maintains 20-message context window, system prompt for lawn care domain. |
| `MowGo/Views/Chat/ChatView.swift` | Full chat UI — message bubbles, typing indicator (animated dots via `.animation`), suggested prompts, input bar with send button, scroll-to-bottom. |
| `MowGo/Views/Payments/PaymentView.swift` | Invoice payment UI + subscription plan cards (Free/Solo/Crew) with Stripe Checkout redirect for upgrades. |

---

## Code Review

### ✅ What's Good
- **Clean architecture** — clear separation of Models / Services / Views
- **MainActor isolation** on all `ObservableObject` classes — no thread-safety issues
- **Proper @EnvironmentObject** injection through the view hierarchy
- **Demo mode fallback** — app works fully without backend (great for preview/testing)
- **Supabase REST API** — direct PostgREST calls, no heavy SDK dependency
- **Token persistence** — session survives app restarts via UserDefaults
- **Auto-refresh** — expired tokens are refreshed transparently
- **Dynamic Type** — `dynamicTypeSize(...)` caps applied on key text views
- **Haptic feedback** — `UIImpactFeedbackGenerator` on all interactive actions
- **Accessibility** — `.accessibilityHidden()`, `.accessibilityLabel()` on key elements
- **Pull-to-refresh** — `.refreshable` on all data views
- **Keyboard management** — `@FocusState`, `.submitLabel`, `scrollDismissesKeyboard`
- **Dark mode toggle** — works via `@AppStorage` + `.preferredColorScheme`

### ⚠️ Issues Found & Fixed
1. **Hardcoded anon key** — moved to Info.plist build settings ✅
2. **`isDemoMode = true` always** — now checks `sb.isConfigured` ✅
3. **`fatalError` on missing config** — replaced with empty-string fallback ✅
4. **Infinite 401 retry loop** — added `isRetry` flag ✅
5. **Timer-based typing indicator** — replaced with proper `.animation` modifier ✅
6. **No session persistence** — added UserDefaults save/restore ✅

### 📝 Remaining Items (for production)
1. **Stripe PaymentSheet** — the `PaymentView` has the plumbing but the actual `PaymentSheet.present()` call needs the Stripe iOS SDK in the Xcode project (the SPM dep is declared but needs `import StripePaymentsUI` and the actual sheet presentation code)
2. **Edge Functions** — the app expects these Supabase Edge Functions to exist:
   - `create-payment-intent` — creates a Stripe PaymentIntent
   - `confirm-payment` — marks invoice as paid after successful payment
   - `create-checkout-session` — creates a Stripe Checkout session for subscriptions
   - `ai-chat` — wraps an LLM for the AI assistant
3. **Info.plist build settings** — in Xcode, set these in your target's Build Settings:
   ```
   SUPABASE_URL = https://vqgiynfrpsqddjrayczc.supabase.co
   SUPABASE_ANON_KEY = sb_publishable_C10u9M0wmcgAqDgkZoxm6g_eAsQSjpz
   StripePublishableKey = pk_live_...
   ```
4. **Offline caching** — currently demo data on network failure; could add Core Data/SQLite cache
5. **Push notifications** — ✅ implemented (APNs Auth Key setup needed)
6. **Photo attachments** — models support `photoUrl` but UI for camera capture isn't built yet
7. **Recurring jobs** — model fields exist (`isRecurring`, `recurrenceRule`) but no RRULE parsing
8. **Route optimization** — AI can give advice but no map integration yet

---

## Push Notifications — Setup Guide

**Added:** 2026-07-29

### What Was Built
- **Device registration** — `PushNotificationService.swift` handles `UNUserNotificationCenter.requestAuthorization` + `UIApplication.registerForRemoteNotifications`
- **Token storage** — Device token saved to `profiles.device_token` via Supabase REST
- **Edge function** — `send-push` function sends APNs push notifications using JWT auth (ES256)
- **Triggers** — Push sent when:
  - A job is toggled to Done (notifies owner)
  - Rain delay is applied (notifies owner of rescheduled count)

### Files Added
| File | Description |
|------|-------------|
| `supabase/migrations/007_push_notifications.sql` | Adds `device_token TEXT` column to profiles |
| `supabase/functions/send-push/index.ts` | Edge function: looks up token, sends APNs push |
| `MowGo/Services/PushNotificationService.swift` | iOS push registration + token management |
| `MowGo/PushAppDelegate.swift` | UIApplicationDelegate adapter for token callbacks |

### Files Modified
| File | Changes |
|------|---------|
| `MowGo/MowGoApp.swift` | Added `@UIApplicationDelegateAdaptor(PushAppDelegate.self)`, `@StateObject push`, registration on auth |
| `MowGo/Services/SupabaseService.swift` | Added `updateDeviceToken(userId:token:)` method |
| `MowGo/Services/DataStore.swift` | Added `firePushJobCompleted()` and `firePushRainDelay()`, called from `toggleJobStatus` and `rainDelay` |

### Manual Steps Required

#### 1. Apple Developer Portal — APNs Auth Key
1. Go to [Apple Developer → Certificates, Identifiers & Profiles → Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Click **+** to create a new key
3. Enable **Apple Push Notifications service (APNs)**
4. Download the `.p8` file (save it — can only be downloaded once!)
5. Note the **Key ID** (10 characters, e.g. `ABC123DEFG`)
6. Note your **Team ID** (found in Membership details, e.g. `XYZ987UVWX`)

#### 2. Supabase — Set Edge Function Secrets
In Supabase Dashboard → **Project Settings → Edge Functions → Secrets**, add:
```
APNS_KEY_ID       = <your 10-char key ID>
APNS_TEAM_ID      = <your 10-char team ID>
APNS_AUTH_KEY     = <contents of .p8 file, including the PEM headers>
APNS_BUNDLE_ID    = com.mowgo.app
```

To set via CLI:
```bash
supabase secrets set APNS_KEY_ID=ABC123DEFG
supabase secrets set APNS_TEAM_ID=XYZ987UVWX
supabase secrets set APNS_AUTH_KEY="$(cat AuthKey_ABC123DEFG.p8)"
supabase secrets set APNS_BUNDLE_ID=com.mowgo.app
```

#### 3. Deploy the Edge Function
```bash
cd supabase
supabase functions deploy send-push
```

#### 4. Run the Migration
```bash
supabase db push
# Or via Dashboard → SQL Editor → paste contents of 007_push_notifications.sql
```

#### 5. Xcode — Enable Push Notifications
1. Open `MowGo.xcodeproj`
2. Select the **MowGo** target → **Signing & Capabilities**
3. Click **+ Capability** → **Push Notifications**
4. Ensure **Automatically manage signing** is on (or manually configure entitlements)
5. In **Build Settings**, ensure `ENABLE_PUSH_NOTIFICATIONS = YES`

#### 6. APNs Environment
- **Development/Sandbox**: The `send-push` function uses `api.push.apple.com` (production). For testing, change the URL in `send-push/index.ts` to `api.sandbox.push.apple.com`.
- **Production**: Use the default `api.push.apple.com`.

### Architecture Notes
- Token is stored as a hex string in `profiles.device_token`
- The edge function uses Web Crypto API (ES256 P-256) to sign APNs JWT — no external npm packages needed
- Invalid tokens (410 Gone) are auto-cleared from the database
- Push notifications only go to the authenticated user's own device (MVP scope)
- Future: extend to send push to crew members via business_id lookup
