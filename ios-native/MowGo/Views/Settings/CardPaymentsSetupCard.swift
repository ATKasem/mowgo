//
//  CardPaymentsSetupCard.swift
//  MowGo
//
//  Owner-only card: set up the business's own merchant account so customers
//  can pay invoices by card (money settles to the business). Status comes
//  from merchant_accounts, updated by the payment provider's webhook.
//

import SwiftUI

struct CardPaymentsSetupCard: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @ObservedObject private var payments = PaymentsService.shared
    @State private var isLoading = true
    @State private var enabled = false
    @State private var status = "none"
    @State private var hostedPage: HostedPage?
    @State private var error: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var isOwner: Bool { !auth.isDemoMode && auth.user?.role != "crew" }

    var body: some View {
        if isOwner {
            VStack(alignment: .leading, spacing: 10) {
                Label("Card Payments", systemImage: "creditcard.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(theme.textMuted)
                if isLoading {
                    ProgressView()
                } else {
                    Text(description)
                        .font(.subheadline)
                        .foregroundColor(status == "active" && enabled ? MowGoTheme.success : theme.textSecondary)
                    if let action = action {
                        Button {
                            Task { await startOnboarding() }
                        } label: {
                            HStack {
                                if payments.isLoading { ProgressView() }
                                Text(action).fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                        }
                        .foregroundColor(MowGoTheme.deepGreen)
                        .background(MowGoTheme.deepGreen.opacity(MowGoTheme.accentOpacity))
                        .cornerRadius(10)
                        .disabled(payments.isLoading)
                    }
                }
                if let error {
                    Text(error).font(.caption).foregroundColor(.red)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18).background(theme.surface).cornerRadius(16)
            .task { await refresh() }
            .sheet(item: $hostedPage, onDismiss: { Task { await refresh() } }) { page in
                SafariView(url: page.url).ignoresSafeArea()
            }
        }
    }

    private var description: LocalizedStringKey {
        guard enabled else { return "Card payments are coming soon. Zelle, Venmo and Cash App requests work today." }
        switch status {
        case "active": return "Card payments are active. Customers can pay invoices by card."
        case "pending": return "Your application is being reviewed. You can finish any remaining steps."
        case "restricted": return "More information is needed before you can accept cards."
        case "disabled": return "Card payments are turned off for your account. Contact support."
        default: return "Let customers pay invoices by card. Payments go straight to your business."
        }
    }

    private var action: LocalizedStringKey? {
        guard enabled else { return nil }
        switch status {
        case "pending": return "Continue setup"
        case "restricted": return "Finish setup"
        case "active", "disabled": return nil
        default: return "Set up card payments"
        }
    }

    private func refresh() async {
        let config = await payments.fetchConfig()
        enabled = config.invoicePayments
        if enabled {
            do {
                status = try await payments.merchantStatus()
                error = nil
            } catch {
                self.error = NSLocalizedString("Could not load card payment status.", comment: "Merchant status load failure")
            }
        }
        isLoading = false
    }

    private func startOnboarding() async {
        error = nil
        do {
            let url = try await payments.merchantOnboardingURL()
            hostedPage = HostedPage(url: url)
        } catch {
            self.error = error.localizedDescription
            await refresh()
        }
    }
}
