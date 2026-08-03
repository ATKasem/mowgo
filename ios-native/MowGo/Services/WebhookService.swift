//
//  WebhookService.swift
//  MowGo
//
//  Fires webhook events to the send-webhook Edge Function.
//  Zapier catches these and handles email/SMS delivery to clients.
//

import Foundation

actor WebhookService {
    static let shared = WebhookService()

    /// Fire a webhook event via the send-webhook Edge Function.
    /// Requires the caller's Supabase auth token to be set on SupabaseService.
    func fire(userId: UUID, event: String, payload: [String: Any]) async {
        let body: [String: Any] = [
            "user_id": userId.uuidString,
            "event": event,
            "payload": payload
        ]

        // Fire and forget — don't block the UI if webhook fails
        print("[WebhookService] Firing event: \(event)")
        do {
            _ = try await SupabaseService.shared.requestFunction("send-webhook", body: body)
        } catch {
            print("[WebhookService] Failed to fire event \(event): \(error.localizedDescription)")
        }
    }

    func jobCompleted(_ job: Job, userId: UUID) async {
        let alertsEnabled = UserDefaults.standard.object(forKey: "jobCompletionAlerts") as? Bool ?? true
        guard alertsEnabled else { return }
        await fire(userId: userId, event: "job.done", payload: [
            "job_id": job.id.uuidString,
            "job_title": job.title,
            "client_name": job.clientName ?? "",
            "client_email": job.clients?.email ?? "",
            "client_phone": job.clients?.phone ?? "",
            "scheduled_date": job.scheduledDate,
            "completed_at": ISO8601DateFormatter().string(from: Date())
        ])
    }

    func jobSkipped(_ job: Job, userId: UUID) async {
        await fire(userId: userId, event: "job.skipped", payload: [
            "job_id": job.id.uuidString,
            "job_title": job.title,
            "client_name": job.clientName ?? "",
            "client_email": job.clients?.email ?? "",
            "client_phone": job.clients?.phone ?? "",
            "scheduled_date": job.scheduledDate,
            "skipped_at": ISO8601DateFormatter().string(from: Date())
        ])
    }
}
