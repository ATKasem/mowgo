//
//  AuthService.swift
//  MowGo
//
//  Manages authentication state. Restores session on launch,
//  falls back to demo mode if Supabase isn't configured.
//

import SwiftUI

@MainActor
final class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var user: UserProfile?
    @Published var error: String?

    private let sb = SupabaseService.shared

    /// True only if Supabase credentials are missing/unconfigured.
    var isDemoMode: Bool { !sb.isConfigured }

    init() {
        // Try to restore a previous session
        if sb.isConfigured && sb.restoreSession() {
            isAuthenticated = true
            isLoading = false
            Task { await loadProfile() }
        } else if isDemoMode {
            // No backend configured — show splash briefly, then enter demo
            Task {
                try? await Task.sleep(for: .milliseconds(800))
                isAuthenticated = true
                isLoading = false
            }
        } else {
            // No session, real backend — show login
            isLoading = false
        }
    }

    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            _ = try await sb.signIn(email: email, password: password)
            isAuthenticated = true
            await loadProfile()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func signUp(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            try await sb.signUp(email: email, password: password)
            error = "Check your email to confirm your account."
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func signOut() {
        sb.signOut()
        isAuthenticated = false
        user = nil
    }

    private func loadProfile() async {
        guard sb.isConfigured else { return }
        do {
            user = try await sb.fetchProfile()
        } catch {
            // Profile fetch failure is non-fatal
            print("Failed to load profile: \(error.localizedDescription)")
        }
    }
}
