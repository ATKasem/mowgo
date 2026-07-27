//
//  MowGoApp.swift
//  MowGo
//

import SwiftUI

@main
struct MowGoApp: App {
    @StateObject private var auth = AuthService()
    @StateObject private var store = DataStore()
    @AppStorage("isDarkMode") private var isDarkMode = true

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
            .preferredColorScheme(isDarkMode ? .dark : .light)
        }
    }
}

struct SplashView: View {
    @State private var animate = false

    var body: some View {
        ZStack {
            Color(hex: "111827").ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "leaf.fill")
                    .font(.system(size: 48))
                    .foregroundColor(Color(hex: "16a34a"))
                    .scaleEffect(animate ? 1 : 0.5)
                    .opacity(animate ? 1 : 0)
                Text("MowGo")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)
            }
        }
        .onAppear {
            withAnimation(.spring(duration: 0.6)) { animate = true }
        }
        .accessibilityElement(children: .combine)
    }
}
