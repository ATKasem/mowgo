//
//  WebhookService.swift
//  MowGo
//
//  Fires webhook events via /api/webhook-dispatch.
//  The Cloudflare Pages Function looks up webhook_configs for the
//  authenticated user and delivers to configured URLs (including Zapier).
//

import Foundation

actor WebhookService {
    static let shared = WebhookService()

    private static let dispatchURL = URL(string: "https://mowgo.pages.dev/api/webhook-dispatch")!

    /// Fire a webhook event via the /api/webhook-dispatch Pages Function.
    /// Requires a Supabase access token on SupabaseService.shared.token.
    /// `userId` is retained for caller clarity/logging — the server derives
    /// the user from the Bearer token, not from this value.
    func fire(userId: UUID, event: String, payload: [String: Any]) async {
        // await required — SupabaseService is an actor; token is actor-isolated
        guard let token = await SupabaseService.shared.token, !token.isEmpty else {
            print("[WebhookService] Skipping \(event) — no auth token (demo mode?)")
            return
        }

        let body: [String: Any] = [
            "event": event,
            "payload": payload
        ]

        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else {
            print("[WebhookService] Failed to serialise body for \(event)")
            return
        }

        var request = URLRequest(url: Self.dispatchURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = bodyData

        print("[WebhookService] Firing event: \(event)")
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, http.statusCode >= 300 {
                print("[WebhookService] Event \(event) returned HTTP \(http.statusCode)")
            }
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
