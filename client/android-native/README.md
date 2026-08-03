# MowGo Android Native

Native Android app built with Kotlin + Jetpack Compose for MowGo lawn care scheduling SaaS.

## Tech Stack

- **Language:** Kotlin 2.1
- **UI:** Jetpack Compose (Material 3, dark-first theme)
- **Architecture:** ViewModel + StateFlow
- **Navigation:** Navigation Compose
- **Networking:** Retrofit + OkHttp + kotlinx.serialization
- **Backend:** Supabase (auth, PostgREST, Realtime)
- **Persistence:** DataStore (preferences)
- **Min SDK:** 26 (Android 8.0)
- **Target SDK:** 35

## Getting Started

1. Open `client/android-native/` in Android Studio
2. Sync Gradle
3. Create `local.properties` with your `sdk.dir` path
4. Run on emulator or device

## Structure

```
app/src/main/java/com/mowgo/app/
├── MowGoActivity.kt              # Entry point + nav graph
├── data/
│   ├── SupabaseClient.kt         # Supabase client singleton
│   └── auth/
│       └── AuthRepository.kt     # Auth data operations
├── ui/
│   ├── theme/
│   │   ├── Theme.kt              # M3 dark/light theme (matches iOS)
│   │   ├── Color.kt              # Color constants
│   │   └── Type.kt               # Typography
│   ├── navigation/
│   │   ├── NavRoutes.kt          # Route constants
│   │   └── BottomNavItem.kt      # Bottom nav items
│   └── screens/
│       ├── MainScreen.kt         # Bottom nav scaffold
│       ├── splash/SplashScreen.kt
│       ├── auth/
│       │   ├── LoginScreen.kt
│       │   └── AuthViewModel.kt
│       ├── today/TodayScreen.kt
│       ├── jobs/JobsScreen.kt
│       ├── clients/ClientsScreen.kt
│       ├── invoices/InvoicesScreen.kt
│       └── more/MoreScreen.kt
```

## Build

```bash
./gradlew assembleDebug
```

Requires Java 17 and Android SDK with API 35.
