# MowFlow iOS

Native iOS app for lawn care business management — scheduling, clients, invoicing, AI assistant, and Stripe payments.

**Stack:** SwiftUI + iOS 17+ · Supabase (PostgREST + Auth) · Stripe · OpenRouter (AI)

---

## Quick Start (5 steps)

### 1. Open in Xcode

```bash
git clone <your-repo-url> mowflow-ios
cd mowflow-ios
```

Open `Package.swift` in Xcode:
```
File → Open → select Package.swift → Open
```

Xcode will resolve the SPM dependency (Stripe iOS SDK). Wait for it to finish — this may take a minute.

### 2. Set 3 Build Settings

In Xcode: **Project Navigator → click the MowFlow project → Build Settings tab → search for each setting.**

Or use the provided xcconfig file: **Project → Info → Configurations → set `Config.xcconfig` for both Debug and Release.**

If setting manually, add these as **User-Defined** build settings in the target:

| Setting | Value |
|---------|-------|
| `SUPABASE_URL` | `https://vqgiynfrpsqddjrayczc.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_C10u9M0wmcgAqDgkZoxm6g_eAsQSjpz` |
| `StripePublishableKey` | `pk_live_your_stripe_key_here` |

> **Without these values**, the app launches in **Demo Mode** with sample data — no backend needed to preview the UI.

### 3. Run

Select an iPhone simulator (iPhone 15 / 16 recommended) and press **⌘R**.

That's it — the app runs in demo mode. Sign in / sign up requires the Supabase backend to be live.

### 4. Deploy Edge Functions (optional — for AI + payments)

The AI assistant and Stripe payments require 4 Supabase Edge Functions. They live in `edge-functions/`.

**Prerequisites:**
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`brew install supabase/tap/supabase`)
- Logged in: `supabase login`
- Linked to your project: `supabase link --project-ref vqgiynfrpsqddjrayczc`

**Set secrets (once):**
```bash
cd edge-functions

# AI Chat — OpenRouter
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
supabase secrets set OPENROUTER_MODEL=openai/gpt-4o-mini  # optional

# Stripe payments
supabase secrets set STRIPE_SECRET_KEY=sk_live_your_key_here
supabase secrets set STRIPE_PRICE_SOLO=price_xxx   # Stripe Price ID for $19/mo
supabase secrets set STRIPE_PRICE_CREW=price_xxx   # Stripe Price ID for $49/mo
```

**Deploy all 4 functions:**
```bash
supabase functions deploy ai-chat
supabase functions deploy create-payment-intent
supabase functions deploy confirm-payment
supabase functions deploy create-checkout-session
```

**Verify:**
```bash
supabase functions list
# Should show all 4 functions
```

### 5. Test

- **Demo Mode:** Launch app → Home tab → everything works with sample data
- **Auth:** Launch → Login → Sign up with email/password → creates account in Supabase
- **AI Chat:** Tab "AI" → ask a question → calls OpenRouter via edge function
- **Payments:** Invoices tab → tap "Pay" → triggers Stripe flow (needs Stripe secret key)

---

## Project Structure

```
ios-native/
├── Package.swift                  ← Open this in Xcode
├── MowFlow/
│   ├── Config.xcconfig            ← Build settings (reference)
│   ├── MowFlowApp.swift           ← App entry point
│   ├── Config.xcconfig            ← Build settings (SPM auto-generates Info.plist)
│   ├── Color+Hex.swift            ← Hex color helper
│   ├── Assets.xcassets/           ← App icon + accent color
│   ├── Models/
│   │   └── Models.swift           ← Job, Client, Invoice, UserProfile
│   ├── Services/
│   │   ├── SupabaseService.swift  ← REST API wrapper (auth + CRUD)
│   │   ├── AuthService.swift      ← Auth state machine
│   │   ├── DataStore.swift        ← Data layer + demo fallback
│   │   ├── ChatService.swift      ← AI chat via Edge Function
│   │   └── StripeService.swift    ← Payments via Edge Functions
│   └── Views/
│       ├── Auth/LoginView.swift
│       ├── Home/HomeView.swift
│       ├── Today/TodayView.swift
│       ├── Today/NewJobFormView.swift
│       ├── Clients/ClientsView.swift
│       ├── Clients/NewClientFormView.swift
│       ├── Chat/ChatView.swift
│       ├── Invoices/InvoicesView.swift
│       ├── Payments/PaymentView.swift
│       ├── Settings/SettingsView.swift
│       └── Components/
│           ├── MainTabView.swift
│           ├── JobCardView.swift
│           └── ReusableViews.swift
├── edge-functions/                ← Deploy to Supabase
│   ├── ai-chat/index.ts
│   ├── create-payment-intent/index.ts
│   ├── confirm-payment/index.ts
│   └── create-checkout-session/index.ts
├── BUILD_NOTES.md                 ← Detailed change log
├── .gitignore
└── README.md                      ← You are here
```

---

## Features

| Feature | Status | Notes |
|---------|--------|-------|
| Demo mode | ✅ | Works without any backend — sample jobs, clients, invoices |
| Auth (sign in / sign up) | ✅ | Supabase Auth with session persistence |
| Today's schedule | ✅ | Jobs with status toggle, rain delay |
| Clients | ✅ | CRUD, pet instructions, key codes |
| AI Autopilot | ✅ | Chat with lawn care AI via OpenRouter |
| Invoicing | ✅ | Create, track, mark paid |
| Stripe payments | ✅ | PaymentIntent via Edge Functions |
| Subscriptions | ✅ | Free / Solo ($19) / Crew ($49) tiers |
| Dark mode | ✅ | Toggle in Settings |
| Pull-to-refresh | ✅ | On all data views |
| Accessibility | ✅ | Dynamic Type, haptic feedback, labels |

---

## Troubleshooting

**"Supabase not configured" / Demo Mode:**
- You didn't set the 3 build settings. Add them as User-Defined settings in the target, or set them in the xcconfig file.

**Stripe import errors:**
- Make sure Xcode finished resolving the SPM dependency. Try Product → Clean Build Folder.

**Edge Function deploy fails:**
- Run `supabase link --project-ref vqgiynfrpsqddjrayczc` first.
- Check `supabase secrets list` to verify env vars are set.

**AI chat returns "Connection error":**
- Verify `OPENROUTER_API_KEY` is set: `supabase secrets list`
- Check function logs: `supabase functions logs ai-chat`
