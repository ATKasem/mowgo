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
    /// Posted when an authenticated session becomes invalid (expired / revoked).
    /// Observers should show a "please sign in again" alert.
    static let sessionExpired = Notification.Name("SessionExpired")

    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var user: UserProfile?
    @Published var error: String?
    @Published var authMessage: String?
    @Published var resetLoading = false
    @Published var resetMessage: String?

    private let sb = SupabaseService.shared

    /// True only if Supabase credentials are missing/unconfigured.
    /// Defaults to false so startup cannot enter demo mode before configuration
    /// has been checked.
    @Published var isDemoMode = false

    init() {
        // Try to restore a previous session
        Task {
            let configured = await sb.isConfigured
            if configured {
                isDemoMode = false
                if await sb.restoreSession() {
                    isAuthenticated = true
                    isLoading = false
                    await loadProfile()
                    return
                }
                // Real backend, no session — show login
                isLoading = false
            } else {
                // No backend configured — show splash briefly, then enter demo
                try? await Task.sleep(for: .milliseconds(800))
                isDemoMode = true
                isAuthenticated = true
                isLoading = false
                // Demo profile so profile edits (incl. payment handles) work in demo.
                user = UserProfile(
                    id: DemoData.demoOwnerId,
                    businessName: "Green Thumb Lawn Care",
                    phone: "405-555-0100",
                    email: "owner@mowgo.app",
                    tier: "solo",
                    role: "owner"
                )
            }
        }
    }

    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        authMessage = nil
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
        authMessage = nil
        do {
            try await sb.signUp(email: email, password: password)
            authMessage = "Check your email to confirm your account."
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func signOut() async {
        isAuthenticated = false
        user = nil
        // Wait for the device-token clear, but cap it at 5s so sign-out
        // never hangs on a slow network (network timeout is 30s).
        if let clearTask = PushNotificationService.shared.clearDeviceToken() {
            await withTaskGroup(of: Void.self) { group in
                group.addTask { await clearTask.value }
                group.addTask { try? await Task.sleep(for: .seconds(5)) }
                await group.next()
                group.cancelAll()
            }
        }
        await sb.signOut()
    }

    func resetPassword(email: String) async {
        resetLoading = true
        resetMessage = nil
        defer { resetLoading = false }
        do {
            try await sb.resetPassword(email: email)
            resetMessage = "Check your email for a reset link."
        } catch {
            resetMessage = error.localizedDescription
        }
    }

    func loadProfile() async {
        guard await sb.isConfigured else { return }
        var retries = 2
        while retries > 0 {
            do {
                user = try await sb.fetchProfile()
                return
            } catch {
                retries -= 1
                if retries > 0 {
                    try? await Task.sleep(for: .seconds(1))
                } else {
                    self.error = "Unable to load your profile: \(error.localizedDescription). Please sign in again."
                    await signOut()
                }
            }
        }
    }

    func updateProfile(businessName: String, phone: String, email: String, venmoHandle: String = "", cashappHandle: String = "", zelleHandle: String = "") async throws {
        let name = businessName.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedPhone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedVenmo = venmoHandle.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedCashapp = cashappHandle.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedZelle = zelleHandle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { throw ProfileUpdateError.businessNameRequired }

        if isDemoMode {
            user?.businessName = name
            user?.phone = normalizedPhone.isEmpty ? nil : normalizedPhone
            user?.email = normalizedEmail.isEmpty ? nil : normalizedEmail
            user?.venmoHandle = normalizedVenmo.isEmpty ? nil : normalizedVenmo
            user?.cashappHandle = normalizedCashapp.isEmpty ? nil : normalizedCashapp
            user?.zelleHandle = normalizedZelle.isEmpty ? nil : normalizedZelle
            return
        }

        guard let id = user?.id else { throw ProfileUpdateError.profileUnavailable }
        struct ProfilePatch: Encodable {
            let businessName: String
            let phone: String?
            let venmoHandle: String?
            let cashappHandle: String?
            let zelleHandle: String?
        }
        try await sb.update(
            "profiles",
            id: id,
            ProfilePatch(
                businessName: name,
                phone: normalizedPhone.isEmpty ? nil : normalizedPhone,
                venmoHandle: normalizedVenmo.isEmpty ? nil : normalizedVenmo,
                cashappHandle: normalizedCashapp.isEmpty ? nil : normalizedCashapp,
                zelleHandle: normalizedZelle.isEmpty ? nil : normalizedZelle
            )
        )
        await loadProfile()
    }
}

private enum ProfileUpdateError: LocalizedError {
    case businessNameRequired
    case profileUnavailable

    var errorDescription: String? {
        switch self {
        case .businessNameRequired: "Business name is required."
        case .profileUnavailable: "Your profile is unavailable. Refresh and try again."
        }
    }
}
