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
    @Environment(\.dismiss) private var dismiss
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

            // Collect button
            Button {
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                Task { @MainActor in await processPayment() }
            } label: {
                HStack {
                    if stripe.isLoading {
                        ProgressView().tint(MowGoTheme.onAccent)
                    } else {
                        Image(systemName: "dollarsign.circle.fill")
                    }
                    Text("Collect")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(MowGoTheme.deepGreen)
                .foregroundColor(MowGoTheme.onAccent)
                .cornerRadius(12)
            }
            .buttonStyle(CollectButtonStyle())
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
                  let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController,
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
                            await MainActor.run { self.dismiss() }
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
            paymentError = paymentCreationErrorMessage(for: error)
            // 409: already paid / still processing — the server may have just
            // settled the invoice, so pull fresh state.
            if case SupabaseError.httpStatus(409, _) = error {
                await store.loadAll()
            }
        }
    }

    private func paymentCreationErrorMessage(for error: Error) -> String {
        if case SupabaseError.httpStatus(409, let detail?) = error {
            return detail
        }
        if case SupabaseError.httpStatus(let statusCode, _) = error,
           (500...599).contains(statusCode) {
            return "Payment service is temporarily unavailable. Please try again in a moment."
        }
        return error.localizedDescription
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

private struct CollectButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.spring(response: 0.24, dampingFraction: 0.62), value: configuration.isPressed)
    }
}

// MARK: - Subscription Plan Card

struct SubscriptionPlanCard: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject var auth: AuthService
    let name: String
    let price: String
    let features: [String]
    let tier: String
    let isCurrent: Bool
    var userTier: String = "free"
    var billingInterval: String = "year"
    /// True when this user already used their 14-day app trial (server-side
    /// one-shot) — flips the button between trial-start and checkout.
    var userHasUsedTrial: Bool = false

    private let stripe = StripeService.shared
    @State private var isPurchasing = false
    @State private var error: String?
    /// Set when a trial was just granted, before the async profile reload lands.
    /// Guards the double-tap window: a second grant_trial call would return
    /// false (server-side one-shot) and show a misleading error.
    @State private var trialJustGranted = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var tierOrder: Int {
        switch tier {
        case "premium": return 3
        case "crew": return 2
        case "solo": return 1
        default: return 0
        }
    }
    private var userTierOrder: Int {
        switch userTier.lowercased() {
        case "premium": return 3
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
                    if billingInterval == "year", tier == "solo" || tier == "crew" || tier == "premium" {
                        Text(tier == "solo" ? "Save $78" : tier == "crew" ? "Save $158" : "Save $398")
                            .font(.caption)
                            .foregroundColor(MowGoTheme.deepGreen)
                    }
                }
                Spacer()
                if isCurrent {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Current")
                            .font(.caption.weight(.medium))
                            .foregroundColor(MowGoTheme.deepGreen)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(MowGoTheme.deepGreen.opacity(MowGoTheme.accentOpacity))
                            .cornerRadius(8)
                        Text("Billing interval changes via Manage Billing")
                            .font(.caption2)
                            .foregroundColor(theme.textMuted)
                    }
                }
            }

            ForEach(features, id: \.self) { feature in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(MowGoTheme.deepGreen)
                    Text(LocalizedStringKey(feature))
                        .font(.caption)
                        .foregroundColor(theme.textSecondary)
                }
            }

            if canUpgrade {
                // Trial-first no-card flow: a FREE user without an active trial
                // starts the 14-day trial (no card). Users in/after a trial go
                // straight to checkout (Stripe trial skipped — see edge function).
                let isTrialStart = userTier.lowercased() == "free" && !userHasUsedTrial && !trialJustGranted
                Button {
                    Task { await subscribe() }
                } label: {
                    if isPurchasing {
                        ProgressView().tint(MowGoTheme.onAccent)
                    } else {
                        Text(isTrialStart ? "Start Free Trial" : "Upgrade")
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
    }

    private func subscribe() async {
        isPurchasing = true
        error = nil
        // Trial-first no-card flow: free user without a used trial → grant the
        // 14-day trial via RPC (idempotent, one-shot per human server-side).
        // No card, no Stripe. Otherwise → normal checkout.
        if userTier.lowercased() == "free" && !userHasUsedTrial && !trialJustGranted {
            let granted = await auth.grantTrial(plan: tier)
            isPurchasing = false
            if granted {
                trialJustGranted = true
                error = nil
            } else {
                error = NSLocalizedString("Could not start your trial. Please try again.", comment: "Trial grant error")
            }
            return
        }
        guard stripe.isConfigured else {
            error = "Stripe not configured."
            isPurchasing = false
            return
        }
        do {
            let url = try await stripe.createCheckoutSession(tier: tier, interval: billingInterval)
            // Open in Safari
            let didOpen = await UIApplication.shared.open(url)
            if !didOpen {
                self.error = "Could not open checkout."
            }
            isPurchasing = false
        } catch {
            self.error = error.localizedDescription
            isPurchasing = false
        }
    }
}
