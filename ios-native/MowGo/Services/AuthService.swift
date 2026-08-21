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
    private let stashedReferralKey = "stashed_referral_code"

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
                    email: "owner@mowgoapp.com",
                    tier: "solo",
                    role: "owner",
                    latitude: 35.4676,
                    longitude: -97.5164
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
            // Apply stashed referral code from a prior signup
            if let code = UserDefaults.standard.string(forKey: stashedReferralKey), !code.isEmpty {
                UserDefaults.standard.removeObject(forKey: stashedReferralKey)
                Task { _ = try? await sb.rpc("apply_referral_code", params: ["p_code": code], String.self) }
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func signUp(email: String, password: String, referralCode: String? = nil) async {
        isLoading = true
        error = nil
        authMessage = nil
        do {
            try await sb.signUp(email: email, password: password)
            authMessage = "Check your email to confirm your account."
            // Stash referral code for after email confirmation (user isn't
            // authenticated yet — the RPC requires auth.uid()).
            if let referralCode, !referralCode.isEmpty {
                UserDefaults.standard.set(referralCode, forKey: stashedReferralKey)
            }
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
                    if case SupabaseError.httpStatus(let code, _) = error,
                       code == 401 || code == 403 {
                        self.error = "Session expired. Please sign in again."
                        await signOut()
                    } else {
                        self.error = "Unable to load your profile. Please try again."
                    }
                }
            }
        }
    }

    // MARK: - Trial-first no-card flow (spec 2026-08-07)

    /// Expire any past app trial (idempotent, cheap). Call on app open / after
    /// sign-in so the UI converges even if the daily cron hasn't run yet.
    func expireTrialIfNeeded() async {
        guard !isDemoMode, await sb.isConfigured else { return }
        struct EmptyParams: Encodable {}
        _ = try? await sb.rpc("expire_trial", params: EmptyParams(), Bool.self)
        // Re-fetch profile so trial state in the UI is current.
        await loadProfile()
    }

    /// Grant the 14-day no-card trial for a plan. Returns true if granted.
    /// One-shot per human (email-normalized, enforced server-side) — repeated
    /// calls return false.
    func grantTrial(plan: String) async -> Bool {
        guard !isDemoMode, await sb.isConfigured else { return false }
        struct TrialParams: Encodable { let p_plan: String }
        do {
            let granted = try await sb.rpc("grant_trial", params: TrialParams(p_plan: plan), Bool.self) ?? false
            if granted { await loadProfile() }
            return granted
        } catch {
            return false
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
            let email: String?
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
                email: normalizedEmail.isEmpty ? nil : normalizedEmail,
                venmoHandle: normalizedVenmo.isEmpty ? nil : normalizedVenmo,
                cashappHandle: normalizedCashapp.isEmpty ? nil : normalizedCashapp,
                zelleHandle: normalizedZelle.isEmpty ? nil : normalizedZelle
            )
        )
        await loadProfile()
    }

    func updateRainAlertsEnabled(_ enabled: Bool) async throws {
        if isDemoMode {
            user?.rainAlertsEnabled = enabled
            return
        }
        guard let id = user?.id else { throw ProfileUpdateError.profileUnavailable }
        struct RainAlertsPatch: Encodable { let rainAlertsEnabled: Bool }
        try await sb.update("profiles", id: id, RainAlertsPatch(rainAlertsEnabled: enabled))
        user?.rainAlertsEnabled = enabled
    }

    func updateLeadAlertsEnabled(_ enabled: Bool) async throws {
        if isDemoMode {
            user?.leadAlertsEnabled = enabled
            return
        }
        guard let id = user?.id else { throw ProfileUpdateError.profileUnavailable }
        struct LeadAlertsPatch: Encodable { let leadAlertsEnabled: Bool }
        try await sb.update("profiles", id: id, LeadAlertsPatch(leadAlertsEnabled: enabled))
        user?.leadAlertsEnabled = enabled
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
