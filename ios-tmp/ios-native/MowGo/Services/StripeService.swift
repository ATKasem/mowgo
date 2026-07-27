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

    // MARK: - Publishable key (set from Info.plist or build settings)
    private var publishableKey: String? {
        Bundle.main.infoDictionary?["StripePublishableKey"] as? String
    }

    var isConfigured: Bool {
        guard let key = publishableKey, !key.isEmpty else { return false }
        StripeAPI.defaultPublishableKey = key
        return true
    }

    // MARK: - Create PaymentIntent via Supabase Edge Function

    func createPaymentIntent(amount: Int, currency: String = "usd", invoiceId: UUID) async throws -> String {
        let body: [String: Any] = [
            "amount": amount,
            "currency": currency,
            "invoice_id": invoiceId.uuidString
        ]
        let data = try await sb.requestFunction("create-payment-intent", body: body)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let clientSecret = json?["client_secret"] as? String else {
            throw StripeError.noClientSecret
        }
        return clientSecret
    }

    // MARK: - Confirm payment (marks invoice as paid via Edge Function)

    func confirmPayment(invoiceId: UUID, paymentIntentId: String) async throws {
        let body: [String: Any] = [
            "invoice_id": invoiceId.uuidString,
            "payment_intent_id": paymentIntentId
        ]
        _ = try await sb.requestFunction("confirm-payment", body: body)
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
}

// MARK: - Stripe Errors

enum StripeError: LocalizedError {
    case noClientSecret
    case noCheckoutURL
    case paymentFailed(String)
    var errorDescription: String? {
        switch self {
        case .noClientSecret: "Could not initialize payment."
        case .noCheckoutURL: "Could not create checkout session."
        case .paymentFailed(let msg): "Payment failed: \(msg)"
        }
    }
}
