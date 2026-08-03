//
//  PushNotificationService.swift
//  MowGo
//
//  Handles APNs remote notification registration, device token storage
//  in Supabase, and sending push notifications via the send-push edge function.
//

import SwiftUI
import UserNotifications

@MainActor
final class PushNotificationService: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationService()

    @Published var isRegistered = false
    @Published var permissionGranted = false

    private var currentUserId: UUID?

    private let sb = SupabaseService.shared
    private var deviceToken: Data?

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Registration

    func setCurrentUserId(_ userId: UUID?) {
        currentUserId = userId
    }

    /// Request notification permission and register for remote notifications.
    /// Call this once after the user is authenticated.
    func registerForPushNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { [weak self] granted, _ in
            Task { @MainActor in
                self?.permissionGranted = granted
                guard granted else { return }
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    // MARK: - Token Handling

    /// Called by MowGoApp when UIApplication registers successfully.
    func handleRegistration(deviceToken data: Data) {
        self.deviceToken = data
        let tokenString = data.map { String(format: "%02x", $0) }.joined()
        isRegistered = true
        saveDeviceToken(tokenString)
    }

    /// Called by MowGoApp when registration fails.
    func handleRegistrationError(_ error: Error) {
        print("Push registration failed: \(error.localizedDescription)")
        isRegistered = false
    }

    // MARK: - Token Storage

    private func saveDeviceToken(_ token: String) {
        guard let userId = currentUserId else {
            print("[PushNotificationService] Cannot save device token: current user ID is unavailable")
            return
        }
        Task {
            do {
                // Upsert device_token on the user's profile
                try await sb.updateDeviceToken(userId: userId, token: token)
            } catch {
                print("Failed to save device token: \(error.localizedDescription)")
            }
        }
    }

    /// Clear the device token on sign-out.
    private var clearTokenTask: Task<Void, Never>?

    @discardableResult
    func clearDeviceToken() -> Task<Void, Never>? {
        clearTokenTask?.cancel()
        guard let userId = currentUserId else {
            deviceToken = nil
            isRegistered = false
            currentUserId = nil
            return nil
        }
        let task = Task {
            try? await sb.updateDeviceToken(userId: userId, token: nil)
        }
        clearTokenTask = task
        deviceToken = nil
        isRegistered = false
        currentUserId = nil
        return task
    }

    // MARK: - Sending Push Notifications

    /// Send a push notification to a user via the send-push edge function.
    /// - Parameters:
    ///   - userId: The target user's UUID (must be the authenticated user's own id for MVP).
    ///   - title: Notification title.
    ///   - body: Notification body text.
    func sendPush(userId: UUID, title: String, body: String) async {
        // Trust boundary: callers must ensure userId is authorized for the authenticated session.
        do {
            _ = try await sb.requestFunction("send-push", body: [
                "userId": userId.uuidString,
                "title": title,
                "body": body,
            ])
        } catch {
            print("Failed to send push: \(error.localizedDescription)")
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Show notification even when app is in foreground.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    /// Handle notification tap.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Future: deep-link to the relevant job/screen based on notification payload
        completionHandler()
    }
}
