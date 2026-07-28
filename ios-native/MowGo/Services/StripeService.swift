//
//  StripeService.swift
//  MowGo
//
//  Stripe payment integration via Supabase Edge Functions.
//  Creates PaymentIntents server-side, presents PaymentSheet on iOS.
//

import Foundation
import StripePayments

@MainActor
final class StripeService: ObservableObject {
    static let shared = StripeService()

    @Published var isLoading = false
    @Published var lastError: String?

    private let sb = SupabaseService.shared

    // MARK: - Publishable key (Info.plist with bundled fallback)
    private var publishableKey: String? {
        let configuredKey = Bundle.main.infoDictionary?["StripePublishableKey"] as? String
        return configuredKey.flatMap { $0.isEmpty ? nil : $0 }
    }

    /// Cached result of configuration check. Set once on first access
    /// to avoid setting StripeAPI.defaultPublishableKey on every view render.
    private var _isConfigured: Bool?

    var isConfigured: Bool {
        if let cached = _isConfigured { return cached }
        guard let key = publishableKey, !key.isEmpty else {
            _isConfigured = false
            return false
        }
        StripeAPI.defaultPublishableKey = key
        _isConfigured = true
        return true
    }

    // MARK: - Create PaymentIntent via Supabase Edge Function

    /// Returns both the client secret (for PaymentSheet) and payment intent ID.
    struct PaymentIntentResult {
        let clientSecret: String
        let paymentIntentId: String
    }

    func createPaymentIntent(amount: Int, currency: String = "usd", invoiceId: UUID) async throws -> PaymentIntentResult {
        guard !isLoading else { throw StripeError.operationInProgress }
        isLoading = true
        defer { isLoading = false }

        let body: [String: Any] = [
            "amount": amount,
            "currency": currency,
            "invoice_id": invoiceId.uuidString
        ]
        let data = try await sb.requestFunction("create-payment-intent", body: body)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let clientSecret = json?["client_secret"] as? String,
              let paymentIntentId = json?["payment_intent_id"] as? String else {
            throw StripeError.noClientSecret
        }
        return PaymentIntentResult(clientSecret: clientSecret, paymentIntentId: paymentIntentId)
    }

    // MARK: - Confirm payment (marks invoice as paid via Edge Function)

    func confirmPayment(invoiceId: UUID, paymentIntentId: String) async throws {
        // Idempotency: reuse an existing key for this invoice to prevent
        // duplicate charges if the app is killed between confirm and ack.
        let key = idempotencyKey(for: invoiceId)
        let body: [String: Any] = [
            "invoice_id": invoiceId.uuidString,
            "payment_intent_id": paymentIntentId,
            "idempotency_key": key
        ]
        _ = try await sb.requestFunction("confirm-payment", body: body)
        // Clear the key after successful confirmation
        clearIdempotencyKey(for: invoiceId)
    }

    // MARK: - Idempotency Key Persistence

    private func idempotencyKey(for invoiceId: UUID) -> String {
        let storageKey = "payment_idempotency_\(invoiceId.uuidString)"
        if let existing = UserDefaults.standard.string(forKey: storageKey),
           !existing.isEmpty {
            return existing
        }
        let key = UUID().uuidString
        UserDefaults.standard.set(key, forKey: storageKey)
        return key
    }

    private func clearIdempotencyKey(for invoiceId: UUID) {
        let storageKey = "payment_idempotency_\(invoiceId.uuidString)"
        UserDefaults.standard.removeObject(forKey: storageKey)
    }

    // MARK: - Subscription checkout (Stripe Checkout redirect)

    func createCheckoutSession(tier: String) async throws -> URL {
        let body: [String: Any] = ["tier": tier]
        let data = try await sb.requestFunction("create-checkout-session", body: body)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let urlString = json?["url"] as? String, let url = URL(string: urlString) else {
            throw StripeError.noCheckoutURL
        }
        return url
    }

    // MARK: - Customer Portal (manage/cancel subscription)

    func createCustomerPortal() async throws -> URL {
        let data = try await sb.requestFunction("create-customer-portal", body: [:])
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let urlString = json?["url"] as? String, let url = URL(string: urlString) else {
            throw StripeError.noPortalURL
        }
        return url
    }
}

// MARK: - Stripe Errors

enum StripeError: LocalizedError {
    case noClientSecret
    case noCheckoutURL
    case noPortalURL
    case operationInProgress
    case paymentFailed(String)
    var errorDescription: String? {
        switch self {
        case .noClientSecret: "Could not initialize payment."
        case .noCheckoutURL: "Could not create checkout session."
        case .noPortalURL: "Could not open subscription management."
        case .operationInProgress: "A payment is already being prepared."
        case .paymentFailed(let msg): "Payment failed: \(msg)"
        }
    }
}
