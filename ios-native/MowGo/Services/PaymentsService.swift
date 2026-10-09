//
//  PaymentsService.swift
//  MowGo
//
//  Card payments through MowGo's payment provider. The server picks the
//  provider (functions/api/payments/*); the app only opens the provider's
//  hosted pages, so no card data ever touches the app and no payment SDK is
//  bundled. Until a provider is live the server answers 503
//  { code: "payments_unavailable" } and the UI shows "coming soon".
//

import Foundation

@MainActor
final class PaymentsService: ObservableObject {
    static let shared = PaymentsService()

    @Published var isLoading = false

    private static let baseURL = URL(string: "https://mowgoapp.com/api/payments/")!
    private let sb = SupabaseService.shared

    struct Config: Decodable {
        let subscriptions: Bool
        let invoicePayments: Bool
        static let unavailable = Config(subscriptions: false, invoicePayments: false)
    }

    /// Which card flows are live. Treats any failure as "not available".
    func fetchConfig() async -> Config {
        var request = URLRequest(url: Self.baseURL.appendingPathComponent("config"))
        request.timeoutInterval = 15
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let config = try? JSONDecoder().decode(Config.self, from: data) else {
            return .unavailable
        }
        return config
    }

    /// Hosted page where the business's customer pays this invoice. The same
    /// link can be shared with the customer; the invoice is marked paid by the
    /// provider's webhook, not by the app.
    func invoicePaymentLink(invoiceId: UUID) async throws -> URL {
        try await hostedURL(from: post("invoice-link", body: ["invoice_id": invoiceId.uuidString.lowercased()]))
    }

    func subscriptionCheckoutURL(tier: String, interval: String) async throws -> URL {
        try await hostedURL(from: post("subscription-checkout", body: [
            "plan": tier, "interval": interval, "platform": "ios",
        ]))
    }

    func billingPortalURL() async throws -> URL {
        try await hostedURL(from: post("billing-portal", body: ["platform": "ios"]))
    }

    func cancelSubscription() async throws {
        let json = try await post("cancel-subscription", body: [:])
        guard json["success"] as? Bool == true else {
            throw PaymentsError.server(json["error"] as? String ?? "Could not cancel subscription")
        }
    }

    // MARK: - HTTP

    private func post(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        guard !isLoading else { throw PaymentsError.operationInProgress }
        isLoading = true
        defer { isLoading = false }

        let token = try await sb.validAccessToken()
        var request = URLRequest(url: Self.baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let json = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if (200...299).contains(status) { return json }
        if json["code"] as? String == "payments_unavailable" { throw PaymentsError.comingSoon }
        if (500...599).contains(status) { throw PaymentsError.serviceUnavailable }
        throw PaymentsError.server(json["error"] as? String ?? "Something went wrong (\(status)).")
    }

    /// The server already checked the host belongs to the provider; still
    /// refuse anything that isn't https before handing it to Safari.
    private func hostedURL(from json: [String: Any]) throws -> URL {
        guard let string = json["url"] as? String,
              let url = URL(string: string),
              url.scheme == "https" else {
            throw PaymentsError.invalidURL
        }
        return url
    }
}

enum PaymentsError: LocalizedError, Equatable {
    case comingSoon
    case serviceUnavailable
    case operationInProgress
    case invalidURL
    case server(String)

    var errorDescription: String? {
        switch self {
        case .comingSoon:
            NSLocalizedString("Card payments are coming soon.", comment: "Shown when no payment provider is live yet")
        case .serviceUnavailable:
            NSLocalizedString("Payment service is temporarily unavailable. Please try again in a moment.", comment: "Payment provider error")
        case .operationInProgress:
            NSLocalizedString("Please wait — a payment request is already in progress.", comment: "Duplicate payment request")
        case .invalidURL:
            NSLocalizedString("Could not open the payment page.", comment: "Bad hosted payment URL")
        case .server(let message):
            message
        }
    }
}
