//
//  MowGoApp.swift
//  MowGo
//

import SwiftUI
import SwiftData
import OSLog

@main
struct MowGoApp: App {
    @UIApplicationDelegateAdaptor(PushAppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthService()
    @StateObject private var store: DataStore
    private let push = PushNotificationService.shared
    @AppStorage("appearanceMode") private var appearanceMode = AppearancePreference.system.rawValue
    @State private var showSessionExpiredAlert = false
    @State private var showUpgradeSuccessToast = false

    /// SwiftData container for offline cache persistence.
    /// Falls back to in-memory if the on-disk schema is corrupt. This loses
    /// offline durability, so both failures are logged as launch-critical.
    private static let modelContainer: ModelContainer = {
        let logger = Logger(subsystem: "com.mowgo.app", category: "Persistence")
        let storeURL = URL.applicationSupportDirectory.appending(path: "MowGo.sqlite")
        let diskConfig = ModelConfiguration(url: storeURL)
        do {
            let container = try ModelContainer(
                for: JobCache.self, ClientCache.self, InvoiceCache.self, PendingMutation.self,
                configurations: diskConfig
            )
            applyStrongestFileProtection(at: storeURL, logger: logger)
            return container
        } catch {
            logger.fault("Persistent ModelContainer creation failed: \(String(describing: error), privacy: .public)")
        }

        let memConfig = ModelConfiguration(isStoredInMemoryOnly: true)
        do {
            logger.warning("Proceeding with volatile in-memory storage; offline changes will not survive relaunch.")
            return try ModelContainer(
                for: JobCache.self, ClientCache.self, InvoiceCache.self, PendingMutation.self,
                configurations: memConfig
            )
        } catch {
            logger.critical("In-memory ModelContainer creation failed: \(String(describing: error), privacy: .public)")
            fatalError("MowGo cannot initialize its data store: \(error)")
        }
    }()

    /// The offline cache holds client PII (names, addresses, phone numbers) —
    /// lock it to NSFileProtectionComplete (inaccessible while the device is
    /// locked) instead of the iOS default (accessible after first unlock).
    private static func applyStrongestFileProtection(at storeURL: URL, logger: Logger) {
        let fm = FileManager.default
        for suffix in ["", "-wal", "-shm"] {
            let path = storeURL.path + suffix
            guard fm.fileExists(atPath: path) else { continue }
            do {
                try fm.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: path)
            } catch {
                logger.error("Failed to set file protection on cache store: \(String(describing: error), privacy: .public)")
            }
        }
    }

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
                store.auth = auth
                if auth.isDemoMode {
                    await store.prepareForDemoMode()
                    store.loadDemoData()
                } else if auth.isAuthenticated {
                    await store.loadAll()
                    // Trial-first no-card flow: converge expired trials on app
                    // open (idempotent; cron is the backstop).
                    await auth.expireTrialIfNeeded()
                    // Register for push notifications after authentication
                    await MainActor.run {
                        push.setCurrentUserId(store.currentUserId)
                        push.registerForPushNotifications()
                    }
                } else {
                    // Clear device token when signed out
                    let clearTokenTask = await MainActor.run {
                        push.setCurrentUserId(store.currentUserId)
                        return push.clearDeviceToken()
                    }
                    await clearTokenTask?.value
                    await store.clear()
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
