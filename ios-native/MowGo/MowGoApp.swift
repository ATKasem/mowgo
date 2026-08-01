//
//  MowGoApp.swift
//  MowGo
//

import SwiftUI
import SwiftData

@main
struct MowGoApp: App {
    @UIApplicationDelegateAdaptor(PushAppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthService()
    @StateObject private var store: DataStore
    @StateObject private var push = PushNotificationService.shared
    @AppStorage("appearanceMode") private var appearanceMode = AppearancePreference.system.rawValue
    @State private var showSessionExpiredAlert = false
    @State private var showUpgradeSuccessToast = false

    /// SwiftData container for offline cache persistence.
    /// Falls back to in-memory if the on-disk schema is corrupt.
    private static let modelContainer: ModelContainer = {
        let diskConfig = ModelConfiguration(isStoredInMemoryOnly: false)
        if let container = try? ModelContainer(
            for: JobCache.self, ClientCache.self, InvoiceCache.self, PendingMutation.self,
            configurations: diskConfig
        ) {
            return container
        }
        let memConfig = ModelConfiguration(isStoredInMemoryOnly: true)
        return try! ModelContainer(
            for: JobCache.self, ClientCache.self, InvoiceCache.self, PendingMutation.self,
            configurations: memConfig
        )
    }()

    init() {
        _store = StateObject(wrappedValue: DataStore(modelContainer: Self.modelContainer))
    }

    private var authLoadState: String {
        "\(auth.isLoading)-\(auth.isAuthenticated)-\(auth.isDemoMode)"
    }

    private var appearancePreference: AppearancePreference {
        AppearancePreference(rawValue: appearanceMode) ?? .system
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isLoading {
                    SplashView()
                } else if auth.isAuthenticated || auth.isDemoMode {
                    MainTabView()
                        .environmentObject(auth)
                        .environmentObject(store)
                        .task {
                            if auth.isDemoMode { store.loadDemoData() }
                        }
                } else {
                    LoginView()
                        .environmentObject(auth)
                        .environmentObject(store)
                }
            }
            .preferredColorScheme(appearancePreference.preferredColorScheme)
            .onReceive(NotificationCenter.default.publisher(for: AuthService.sessionExpired)) { _ in
                showSessionExpiredAlert = true
            }
            .alert("Session Expired", isPresented: $showSessionExpiredAlert) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("Your session has expired. Please sign in again.")
            }
            .alert("Upgrade Successful!", isPresented: $showUpgradeSuccessToast) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("Your subscription has been upgraded. Enjoy your new features!")
            }
            .task(id: authLoadState) {
                guard !auth.isLoading else { return }
                if auth.isAuthenticated {
                    await store.loadAll()
                    // Register for push notifications after authentication
                    await MainActor.run {
                        PushNotificationService.shared.registerForPushNotifications()
                    }
                } else {
                    // Clear device token when signed out
                    await MainActor.run {
                        PushNotificationService.shared.clearDeviceToken()
                    }
                    store.clear()
                }
            }
            .modelContainer(Self.modelContainer)
            .onOpenURL { url in
                guard url.scheme == "mowgo" else { return }
                let upgraded = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "upgraded" })?.value == "true"
                let portalReturned = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "portal_returned" })?.value == "true"
                Task {
                    var didUpgrade = false
                    // Poll for webhook to update profiles.tier (1-5s async)
                    if upgraded {
                        for delay in [2, 5, 10] {
                            await auth.loadProfile()
                            if auth.user?.tier != "free" {
                                didUpgrade = true
                                break
                            }
                            try? await Task.sleep(for: .seconds(Double(delay)))
                        }
                    }
                    // After returning from Customer Portal, refresh profile
                    if portalReturned && !upgraded {
                        await auth.loadProfile()
                    }
                    await store.loadAll()
                    if didUpgrade {
                        showUpgradeSuccessToast = true
                    }
                }
            }
        }
    }
}

struct SplashView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var animate = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "leaf.fill")
                    .font(.system(size: 48))
                    .foregroundColor(MowGoTheme.deepGreen)
                    .scaleEffect(animate ? 1 : 0.5)
                    .opacity(animate ? 1 : 0)
                Text("MowGo")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(theme.textPrimary)
            }
        }
        .onAppear {
            withAnimation(.spring(duration: 0.6)) { animate = true }
        }
        .accessibilityElement(children: .combine)
    }
}
