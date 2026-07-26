//
//  PaymentView.swift
//  MowFlow
//
//  Stripe checkout for invoices and subscription plans.
//

import SwiftUI
import StripePayments

struct PaymentView: View {
    @EnvironmentObject var store: DataStore
    private let stripe = StripeService.shared
    @State private var showingCheckout = false
    @State private var checkoutURL: URL?
    @State private var paymentError: String?

    let invoice: Invoice

    var body: some View {
        VStack(spacing: 16) {
            // Invoice summary
            VStack(spacing: 8) {
                Text(invoice.clientName ?? "Invoice")
                    .font(.headline)
                    .foregroundColor(.white)
                Text("$\(invoice.amount, specifier: "%.2f")")
                    .font(.title.weight(.bold))
                    .foregroundColor(Color(hex: "16a34a"))
                if let date = invoice.createdAt {
                    Text(date.prefix(10).description)
                        .font(.caption)
                        .foregroundColor(Color(hex: "9ca3af"))
                }
            }
            .padding()

            // Pay button
            Button {
                Task { @MainActor in await processPayment() }
            } label: {
                HStack {
                    if stripe.isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "creditcard.fill")
                    }
                    Text("Pay Now")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(hex: "16a34a"))
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(stripe.isLoading)

            if let err = paymentError {
                Text(err)
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(16)
    }

    private func processPayment() async {
        guard stripe.isConfigured else {
            paymentError = "Stripe is not configured. Set StripePublishableKey in Info.plist."
            return
        }
        paymentError = nil
        let amountCents = invoice.amountCents
        do {
            let result = try await stripe.createPaymentIntent(
                amount: amountCents, invoiceId: invoice.id
            )
            // CRITICAL FIX: Present PaymentSheet to actually collect payment.
            // The previous TODO skipped PaymentSheet and marked invoices paid
            // without charging the customer's card.
            let intentConfig = PaymentSheet.IntentConfiguration(
                mode: .payment(amount: amountCents, currency: "usd"),
                confirmHandler: { intentParams in
                    // Confirm the PaymentIntent on our server
                    Task { @MainActor in
                        do {
                            try await self.stripe.confirmPayment(
                                invoiceId: self.invoice.id,
                                paymentIntentId: result.paymentIntentId
                            )
                            intentParams.confirm()
                        } catch {
                            intentParams.cancel()
                        }
                    }
                }
            )
            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "MowFlow"
            let paymentSheet = PaymentSheet(
                intentConfiguration: intentConfig,
                configuration: config
            )
            // Present from the key window's root view controller
            guard let windowScene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }),
                  let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?
                    .rootViewController else {
                paymentError = "Could not present payment sheet."
                return
            }
            paymentSheet.present(from: rootVC) { result in
                switch result {
                case .completed:
                    Task { try? await self.store.markInvoicePaid(self.invoice) }
                case .canceled:
                    self.paymentError = "Payment was canceled."
                case .failed(let error):
                    self.paymentError = error.localizedDescription
                }
            }
            return  // PaymentSheet handles the rest via its completion handler
        } catch {
            paymentError = error.localizedDescription
        }
    }
}

// MARK: - Subscription Plan Card

struct SubscriptionPlanCard: View {
    let name: String
    let price: String
    let features: [String]
    let tier: String
    let isCurrent: Bool

    private let stripe = StripeService.shared
    @State private var isPurchasing = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(price)
                        .font(.title3.weight(.bold))
                        .foregroundColor(Color(hex: "16a34a"))
                }
                Spacer()
                if isCurrent {
                    Text("Current")
                        .font(.caption.weight(.medium))
                        .foregroundColor(Color(hex: "16a34a"))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color(hex: "16a34a").opacity(0.15))
                        .cornerRadius(8)
                }
            }

            ForEach(features, id: \.self) { feature in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(Color(hex: "16a34a"))
                    Text(feature)
                        .font(.caption)
                        .foregroundColor(Color(hex: "d1d5db"))
                }
            }

            if !isCurrent {
                Button {
                    Task { await subscribe() }
                } label: {
                    if isPurchasing {
                        ProgressView().tint(.white)
                    } else {
                        Text("Upgrade")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color(hex: "16a34a"))
                .foregroundColor(.white)
                .cornerRadius(10)
                .disabled(isPurchasing)
            }

            if let err = error {
                Text(err)
                    .font(.caption2)
                    .foregroundColor(.red)
            }
        }
        .padding(16)
        .background(Color(hex: "1f2937"))
        .cornerRadius(16)
    }

    private func subscribe() async {
        guard stripe.isConfigured else {
            error = "Stripe not configured."
            return
        }
        isPurchasing = true
        error = nil
        do {
            let url = try await stripe.createCheckoutSession(tier: tier)
            // Open in Safari
            await UIApplication.shared.open(url)
        } catch {
            self.error = error.localizedDescription
        }
        isPurchasing = false
    }
}
