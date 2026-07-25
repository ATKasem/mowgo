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
    @StateObject private var stripe = StripeService.shared
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
                Task { await processPayment() }
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
        let amountCents = Int(invoice.amount * 100)
        do {
            let result = try await stripe.createPaymentIntent(
                amount: amountCents, invoiceId: invoice.id
            )
            // TODO: Present StripePaymentSheet with result.clientSecret
            // PaymentSheet.IntentConfiguration(mode: .payment(amount: ..., currency: "usd")) { result in ... }
            // On successful confirmation, verify via edge function:
            try await stripe.confirmPayment(invoiceId: invoice.id, paymentIntentId: result.paymentIntentId)
            // Only mark paid AFTER backend confirmation
            try await store.markInvoicePaid(invoice)
            paymentError = nil
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

    @StateObject private var stripe = StripeService.shared
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
