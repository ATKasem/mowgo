//
//  PaymentView.swift
//  MowGo
//
//  Stripe checkout for invoices and subscription plans.
//

import SwiftUI
import StripePayments
import StripePaymentSheet

struct PaymentView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @ObservedObject private var stripe = StripeService.shared
    @State private var showingCheckout = false
    @State private var checkoutURL: URL?
    @State private var paymentError: String?

    let invoice: Invoice

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        VStack(spacing: 16) {
            // Invoice summary
            VStack(spacing: 8) {
                Text(invoice.clientName ?? "Invoice")
                    .font(.headline)
                    .foregroundColor(theme.textPrimary)
                Text(invoice.currencyAmount.formatted(.currency(code: "USD")))
                    .font(.title.weight(.bold))
                    .foregroundColor(MowGoTheme.deepGreen)
                if let date = invoice.createdAt {
                    Text(date.prefix(10).description)
                        .font(.caption)
                        .foregroundColor(theme.textMuted)
                }
            }
            .padding()

            // Pay button
            Button {
                Task { @MainActor in await processPayment() }
            } label: {
                HStack {
                    if stripe.isLoading {
                        ProgressView().tint(MowGoTheme.onAccent)
                    } else {
                        Image(systemName: "creditcard.fill")
                    }
                    Text("Pay Now")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(MowGoTheme.deepGreen)
                .foregroundColor(MowGoTheme.onAccent)
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
            let paymentIntent = try await stripe.createPaymentIntent(
                amount: amountCents, invoiceId: invoice.id
            )
            let paymentId = paymentIntent.paymentIntentId
            let intentConfig = PaymentSheet.IntentConfiguration(
                mode: .payment(amount: amountCents, currency: "usd"),
                confirmHandler: { _, _, intentCreationCallback in
                    intentCreationCallback(.success(paymentIntent.clientSecret))
                }
            )
            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "MowGo"
            let paymentSheet = PaymentSheet(
                intentConfiguration: intentConfig,
                configuration: config
            )
            // Present from the topmost controller because PaymentView may itself be in a sheet.
            guard let windowScene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }),
                  let rootVC = windowScene.keyWindow?.rootViewController,
                  let presentingVC = topmostViewController(from: rootVC) else {
                paymentError = "Could not present payment sheet."
                return
            }
            paymentSheet.present(from: presentingVC) { result in
                switch result {
                case .completed:
                    // Trust boundary: this client callback is not authoritative settlement.
                    // The edge function must independently verify the PaymentIntent with Stripe.
                    Task {
                        do {
                            try await self.stripe.confirmPayment(
                                invoiceId: self.invoice.id,
                                paymentIntentId: paymentId
                            )
                            await self.store.loadAll()
                        } catch {
                            await MainActor.run {
                                self.paymentError = "Payment succeeded, but verification failed: \(error.localizedDescription). Refresh before trying again."
                            }
                        }
                    }
                case .canceled:
                    Task { @MainActor in self.paymentError = "Payment was canceled." }
                case .failed(let error):
                    Task { @MainActor in self.paymentError = error.localizedDescription }
                }
            }
            return  // PaymentSheet handles the rest via its completion handler
        } catch {
            paymentError = error.localizedDescription
        }
    }

    private func topmostViewController(from viewController: UIViewController?) -> UIViewController? {
        if let presented = viewController?.presentedViewController {
            return topmostViewController(from: presented)
        }
        if let navigationController = viewController as? UINavigationController {
            return topmostViewController(from: navigationController.visibleViewController)
        }
        if let tabBarController = viewController as? UITabBarController {
            return topmostViewController(from: tabBarController.selectedViewController)
        }
        return viewController
    }
}

// MARK: - Subscription Plan Card

struct SubscriptionPlanCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let name: String
    let price: String
    let features: [String]
    let tier: String
    let isCurrent: Bool
    var userTier: String = "free"

    private let stripe = StripeService.shared
    @State private var isPurchasing = false
    @State private var error: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var tierOrder: Int {
        switch tier {
        case "crew": return 2
        case "solo": return 1
        default: return 0
        }
    }
    private var userTierOrder: Int {
        switch userTier.lowercased() {
        case "crew": return 2
        case "solo": return 1
        default: return 0
        }
    }
    private var canUpgrade: Bool { !isCurrent && tierOrder > userTierOrder }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.headline)
                        .foregroundColor(theme.textPrimary)
                    Text(price)
                        .font(.title3.weight(.bold))
                        .foregroundColor(MowGoTheme.deepGreen)
                }
                Spacer()
                if isCurrent {
                    Text("Current")
                        .font(.caption.weight(.medium))
                        .foregroundColor(MowGoTheme.deepGreen)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(MowGoTheme.deepGreen.opacity(MowGoTheme.accentOpacity))
                        .cornerRadius(8)
                }
            }

            ForEach(features, id: \.self) { feature in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(MowGoTheme.deepGreen)
                    Text(feature)
                        .font(.caption)
                        .foregroundColor(theme.textSecondary)
                }
            }

            if canUpgrade {
                Button {
                    Task { await subscribe() }
                } label: {
                    if isPurchasing {
                        ProgressView().tint(MowGoTheme.onAccent)
                    } else {
                        Text("Upgrade")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(MowGoTheme.deepGreen)
                .foregroundColor(MowGoTheme.onAccent)
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
        .background(theme.surface)
        .cornerRadius(16)
        .onDisappear {
            isPurchasing = false
        }
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
            let didOpen = await UIApplication.shared.open(url)
            if !didOpen {
                self.error = "Could not open checkout."
                isPurchasing = false
            }
        } catch {
            self.error = error.localizedDescription
            isPurchasing = false
        }
    }
}
