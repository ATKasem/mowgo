# MowGo iOS

Native iOS app — SwiftUI + iOS 17+ · Supabase · Stripe · AI Autopilot

## One-time setup (2 min)

### 1. Create a new Xcode project

```
Xcode → File → New → Project → iOS → App
Product Name: MowGo
Interface: SwiftUI
Language: Swift
```

Save it anywhere. This creates the app target with proper bundle ID.

### 2. Add the MowGo package

```
File → Add Package Dependencies → Add Local...
Select the ios-native/ folder (this folder)
```

Or simpler: **drag the `MowGo/` folder into the Xcode project navigator.**

### 3. Set the xcconfig

When generating the project with XcodeGen, `project.yml` attaches
`MowGo/Config.xcconfig` to both Debug and Release automatically:

```bash
cd ios-native
xcodegen generate
```

If you created the Xcode project manually instead:

```
Project Navigator → click MowGo project (blue icon at top)
→ Info tab → Configurations
→ Set Config.xcconfig for both Debug and Release
```

The `INFOPLIST_KEY_` prefix is Xcode's generated-Info.plist convention on both
devices and the simulator. At runtime those settings appear without the prefix,
as `SUPABASE_URL` and `SUPABASE_ANON_KEY`, which matches `SupabaseService`.
There are no simulator-specific key names.

### 4. Run

Select iPhone simulator → Cmd+R.

With valid Supabase credentials and no saved session, the first screen after
the splash is `LoginView`. If the simulator has authenticated this app before,
its Keychain session may be restored automatically. Delete MowGo from the
simulator and run again. If the session still restores (Keychain data can
survive app deletion), use **Device → Erase All Content and Settings** to test a
true first launch.

---

## Add Stripe + AI (optional)

```bash
# Set env vars then deploy edge functions
export SUPABASE_ACCESS_TOKEN=***
export STRIPE_SECRET_KEY=***
bash ios-native/deploy-edge-functions.sh
```

---

## Files

```
ios-native/
├── Package.swift             ← SPM manifest (Stripe dep)
├── Config.xcconfig           ← Build settings + Info.plist keys
├── deploy-edge-functions.sh  ← One-command deploy
├── edge-functions/           ← 4 Deno Edge Functions
├── MowGo/
│   ├── MowGoApp.swift      ← @main entry point
│   ├── Models/Models.swift   ← Job, Client, Invoice, UserProfile
│   ├── Services/
│   │   ├── SupabaseService   ← PostgREST + Auth
│   │   ├── AuthService       ← Session mgmt
│   │   ├── DataStore         ← ObservableObject state
│   │   ├── StripeService     ← Payments
│   │   └── ChatService       ← AI autopilot
│   └── Views/
│       ├── Auth/LoginView
│       ├── Home/HomeView
│       ├── Today/TodayView, NewJobFormView
│       ├── Clients/ClientsView, NewClientFormView
│       ├── Invoices/InvoicesView
│       ├── Chat/ChatView
│       ├── Payments/PaymentView
│       ├── Settings/SettingsView
│       └── Components/MainTabView, JobCardView, ReusableViews
```
