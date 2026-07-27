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
5. **Push notifications** — not implemented; would need APNs setup
6. **Photo attachments** — models support `photoUrl` but UI for camera capture isn't built yet
7. **Recurring jobs** — model fields exist (`isRecurring`, `recurrenceRule`) but no RRULE parsing
8. **Route optimization** — AI can give advice but no map integration yet
