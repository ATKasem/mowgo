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

    private static let dispatchURL = URL(string: "https://mowgoapp.com/api/webhook-dispatch")!

    /// Fire a webhook event via the /api/webhook-dispatch Pages Function.
    /// Requires a signed-in Supabase session (token is refreshed if expired).
    /// `userId` is retained for caller clarity/logging — the server derives
    /// the user from the Bearer token, not from this value.
    func fire(userId: UUID, event: String, payload: [String: Any]) async {
        // Refreshes an expired token first; throws when signed out / demo mode.
        guard let token = try? await SupabaseService.shared.validAccessToken(), !token.isEmpty else {
            #if DEBUG
            print("[WebhookService] Skipping \(event) — no auth token (demo mode?)")
            #endif
            return
        }

        let body: [String: Any] = [
            "event": event,
            "payload": payload
        ]

        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else {
            #if DEBUG
            print("[WebhookService] Failed to serialise body for \(event)")
            #endif
            return
        }

        var request = URLRequest(url: Self.dispatchURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = bodyData

        #if DEBUG
        print("[WebhookService] Firing event: \(event)")
        #endif
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, http.statusCode >= 300 {
                #if DEBUG
                print("[WebhookService] Event \(event) returned HTTP \(http.statusCode)")
                #endif
            }
        } catch {
            #if DEBUG
            print("[WebhookService] Failed to fire event \(event): \(error.localizedDescription)")
            #endif
        }
    }

    func jobCompleted(_ job: Job, userId: UUID) async {
        await fire(userId: userId, event: "job.completed", payload: [
            "job_id": job.id.uuidString,
            "title": job.title,
            "job_title": job.title,
            "client_id": job.clientId?.uuidString ?? "",
            "client_name": job.clientName ?? "",
            "client_email": job.clients?.email ?? "",
            "client_phone": job.clients?.phone ?? "",
            "scheduled_date": job.scheduledDate,
            "status": "done",
            "completed_at": ISO8601DateFormatter().string(from: Date())
        ])
    }

    func jobCreated(_ job: Job, userId: UUID) async {
        await fire(userId: userId, event: "job.created", payload: jobPayload(job))
    }

    func jobUpdated(_ job: Job, userId: UUID) async {
        await fire(userId: userId, event: "job.updated", payload: jobPayload(job))
    }

    func customerCreated(_ client: Client, userId: UUID) async {
        await fire(userId: userId, event: "customer.created", payload: [
            "client_id": client.id.uuidString,
            "name": client.name,
            "address": client.address ?? "",
            "phone": client.phone ?? "",
            "email": client.email ?? "",
            "rate": NSDecimalNumber(decimal: client.rate).doubleValue
        ])
    }

    func leadCreated(_ lead: Lead, userId: UUID) async {
        await fire(userId: userId, event: "lead.created", payload: leadPayload(lead))
    }

    func leadStatusUpdated(_ lead: Lead, userId: UUID) async {
        await fire(userId: userId, event: "lead.status.updated", payload: leadPayload(lead))
    }

    func rainDelayApplied(count: Int, date: String, targetDate: String, userId: UUID) async {
        await fire(userId: userId, event: "rain.delay.applied", payload: [
            "count": count,
            "date": date,
            "target_date": targetDate
        ])
    }

    private func leadPayload(_ lead: Lead) -> [String: Any] {
        var payload: [String: Any] = [
            "lead_id": lead.id.uuidString,
            "name": lead.name,
            "status": lead.status,
            "source": lead.source
        ]
        if let clientId = lead.clientId {
            payload["client_id"] = clientId.uuidString
        }
        return payload
    }

    func invoicePaid(_ invoice: Invoice, userId: UUID) async {
        await fire(userId: userId, event: "invoice.paid", payload: [
            "invoice_id": invoice.id.uuidString,
            "client_id": invoice.clientId?.uuidString ?? "",
            "client_name": invoice.clientName ?? "",
            "amount": NSDecimalNumber(decimal: invoice.amount).doubleValue,
            "paid_at": invoice.paidAt ?? ISO8601DateFormatter().string(from: Date())
        ])
    }

    private func jobPayload(_ job: Job) -> [String: Any] {
        [
            "job_id": job.id.uuidString,
            "title": job.title,
            "client_id": job.clientId?.uuidString ?? "",
            "scheduled_date": job.scheduledDate,
            "status": job.status.rawValue
        ]
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
