//
//  MowGoApp.swift
//  MowGo
//

import SwiftUI
import SwiftData

@main
struct MowGoApp: App {
    @StateObject private var auth = AuthService()
    @StateObject private var store: DataStore
    @AppStorage("appearanceMode") private var appearanceMode = AppearancePreference.system.rawValue
    @State private var showSessionExpiredAlert = false

    /// SwiftData container for offline cache persistence.
    /// Falls back to in-memory if the on-disk schema is corrupt.
    private static var makeModelContainer: ModelContainer {
        let diskConfig = ModelConfiguration(isStoredInMemoryOnly: false)
        if let container = try? ModelContainer(
            for: JobCache.self, ClientCache.self, InvoiceCache.self,
            configurations: diskConfig
        ) {
            return container
        }
        let memConfig = ModelConfiguration(isStoredInMemoryOnly: true)
        return try! ModelContainer(
            for: JobCache.self, ClientCache.self, InvoiceCache.self,
            configurations: memConfig
        )
    }

    private let modelContainer: ModelContainer = makeModelContainer

    init() {
        _store = StateObject(wrappedValue: DataStore(modelContainer: modelContainer))
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
            .task(id: authLoadState) {
                guard !auth.isLoading else { return }
                if auth.isAuthenticated {
                    await store.loadAll()
                } else {
                    store.clear()
                }
            }
            .modelContainer(modelContainer)
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
