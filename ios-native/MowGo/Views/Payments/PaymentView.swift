//
//  PaymentView.swift
//  MowGo
//
//  Card collection for invoices (provider's hosted payment page) and
//  subscription plan cards. See PaymentsService.
//

import SwiftUI

struct PaymentView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @ObservedObject private var payments = PaymentsService.shared
    @State private var hostedPage: HostedPage?
    @State private var paymentLink: URL?
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

            // Collect button — opens the provider's hosted payment page.
            Button {
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                Task { @MainActor in await openPaymentPage() }
            } label: {
                HStack {
                    if payments.isLoading {
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
            .disabled(payments.isLoading)

            // The same link can be texted/emailed so the customer pays later.
            if let paymentLink {
                ShareLink(item: paymentLink) {
                    Label("Send Payment Link", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(MowGoTheme.deepGreen)
                }
            }

            if let err = paymentError {
                Text(err)
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(16)
        // The invoice flips to paid via the provider's webhook; refresh when
        // the payment page closes so the list reflects it.
        .sheet(item: $hostedPage, onDismiss: { Task { await store.loadAll() } }) { page in
            SafariView(url: page.url).ignoresSafeArea()
        }
    }

    private func openPaymentPage() async {
        paymentError = nil
        do {
            let url = try await payments.invoicePaymentLink(invoiceId: invoice.id)
            paymentLink = url
            hostedPage = HostedPage(url: url)
        } catch {
            paymentError = error.localizedDescription
            // e.g. "already paid" — pull fresh state.
            if case PaymentsError.server(_) = error { await store.loadAll() }
        }
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
                // straight to checkout (no second trial — see subscription-checkout.js).
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
        // No card needed. Otherwise → the provider's hosted checkout.
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
        do {
            let url = try await PaymentsService.shared.subscriptionCheckoutURL(tier: tier, interval: billingInterval)
            // Open in Safari; the hosted page returns via /#/portal-return → mowgo://settings?upgraded=true
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
