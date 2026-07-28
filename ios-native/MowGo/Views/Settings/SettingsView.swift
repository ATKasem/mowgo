//
//  SettingsView.swift
//  MowGo
//
//  Settings with profile, subscription tiers, preferences.
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("appearanceMode") private var appearanceMode = AppearancePreference.system.rawValue
    @State private var showingSignOut = false
    @State private var showSubscription = false
    @State private var showManagePortal = false
    @State private var portalError: String?
    @State private var showCancelConfirmation = false
    @State private var cancelError: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var appearancePreference: Binding<AppearancePreference> {
        Binding(
            get: { AppearancePreference(rawValue: appearanceMode) ?? .system },
            set: { appearanceMode = $0.rawValue }
        )
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 8) {
                        SectionHeader("Account")
                        profileCard
                        signOutButton

                        SectionHeader("Preferences")
                        preferencesCard
                        appInfoCard

                        SectionHeader("Billing")
                        subscriptionCard
                    }
                    .padding(16)
                }
                .refreshable {
                    await auth.loadProfile()
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showSubscription) {
                SubscriptionView(currentTier: auth.user?.tier ?? "free")
            }
            .alert("Sign Out", isPresented: $showingSignOut) {
                Button("Sign Out", role: .destructive) { Task { await auth.signOut() } }
                Button("Cancel", role: .cancel) {}
            } message: { Text("You'll need to sign in again.") }
            .alert("Cancel Subscription", isPresented: $showCancelConfirmation) {
                Button("Cancel Subscription", role: .destructive) {
                    Task { await handleCancelSubscription() }
                }
                Button("Keep Subscription", role: .cancel) {}
            } message: {
                Text("Cancel your \(auth.user?.tierLabel ?? "Solo") subscription? You'll lose access at the end of your billing period.")
            }
        }
    }

    private var profileCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.circle.fill")
                .font(.system(size: 48)).foregroundColor(MowGoTheme.deepGreen)
            VStack(spacing: 2) {
                Text(auth.user?.businessName ?? "MowGo")
                    .font(.headline).foregroundColor(theme.textPrimary)
                Text(auth.user?.tierLabel ?? "Free Plan")
                    .font(.caption).foregroundColor(theme.textMuted)
            }
        }
        .frame(maxWidth: .infinity).padding(20)
        .background(theme.surface).cornerRadius(16)
    }

    private var subscriptionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Subscription").font(.headline).foregroundColor(theme.textPrimary)
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(auth.user?.tierLabel ?? "Free Plan")
                        .font(.subheadline.weight(.medium)).foregroundColor(theme.textPrimary)
                    Text(tierDescription).font(.caption).foregroundColor(theme.textMuted)
                }
                Spacer()
                Text(tierPrice)
                    .font(.subheadline.weight(.semibold)).foregroundColor(MowGoTheme.deepGreen)
            }
            Divider().background(theme.surfaceElevated)

            // Action buttons
            if isPaidTier {
                Button {
                    Task { openCustomerPortal() }
                } label: {
                    HStack {
                        Image(systemName: "gearshape.2.fill")
                        Text("Manage Subscription")
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(MowGoTheme.deepGreen)
                    .cornerRadius(10)
                }

                Button {
                    showCancelConfirmation = true
                } label: {
                    HStack {
                        Image(systemName: "xmark.circle")
                        Text("Cancel Subscription")
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(.red, lineWidth: 1)
                    )
                }

                if let cancelError {
                    Text(cancelError)
                        .font(.caption2)
                        .foregroundColor(.red)
                }
            }

            // Show higher-tier plan cards
            if !higherTiers.isEmpty {
                Divider().background(theme.surfaceElevated)
                Text("Upgrade").font(.caption.weight(.semibold))
                    .foregroundColor(theme.textMuted)
                ForEach(higherTiers, id: \.self) { tier in
                    SubscriptionPlanCard(
                        name: tierLabel(for: tier),
                        price: priceLabel(for: tier),
                        features: features(for: tier),
                        tier: tier,
                        isCurrent: false,
                        userTier: auth.user?.tier ?? "free"
                    )
                }
            } else if !isPaidTier {
                Button { showSubscription = true } label: {
                    Text("View Plans")
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(MowGoTheme.deepGreen)
                }
            }

            if let err = portalError {
                Text(err)
                    .font(.caption2)
                    .foregroundColor(.red)
            }
        }
        .padding(16).background(theme.surface).cornerRadius(16)
    }

    private var isPaidTier: Bool {
        let tier = auth.user?.tier ?? "free"
        return tier == "solo" || tier == "crew"
    }

    private func openCustomerPortal() {
        Task {
            portalError = nil
            do {
                let stripe = StripeService.shared
                let url = try await stripe.createCustomerPortal()
                await UIApplication.shared.open(url)
            } catch {
                portalError = error.localizedDescription
            }
        }
    }

    private func handleCancelSubscription() async {
        cancelError = nil
        do {
            try await StripeService.shared.cancelSubscription()
            await auth.loadProfile()
        } catch {
            cancelError = error.localizedDescription
        }
    }

    private var higherTiers: [String] {
        let tier = auth.user?.tier ?? "free"
        switch tier {
        case "free": return ["solo", "crew"]
        case "solo": return ["crew"]
        default: return []
        }
    }

    private func tierLabel(for tier: String) -> String {
        switch tier {
        case "solo": return "Solo"
        case "crew": return "Crew"
        default: return tier.capitalized
        }
    }

    private func priceLabel(for tier: String) -> String {
        switch tier {
        case "solo": return "$39/mo"
        case "crew": return "$79/mo"
        default: return ""
        }
    }

    private func features(for tier: String) -> [String] {
        switch tier {
        case "solo": return [
            "15 clients",
            "AI Autopilot assistant",
            "Route optimization",
            "Photo attachments",
            "Priority support"
        ]
        case "crew": return [
            "Unlimited clients",
            "Team job assignment",
            "GPS tracking",
            "QuickBooks sync",
            "Everything in Solo"
        ]
        default: return []
        }
    }

    private var preferencesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Appearance", systemImage: "circle.lefthalf.filled")
                .foregroundColor(theme.textPrimary)
            Picker("Appearance", selection: appearancePreference) {
                ForEach(AppearancePreference.allCases) { preference in
                    Text(preference.label).tag(preference)
                }
            }
            .pickerStyle(.segmented)
        }
        .padding(16).background(theme.surface).cornerRadius(16)
    }

    private var appInfoCard: some View {
        VStack(spacing: 8) {
            InfoRow(label: "Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
            InfoRow(label: "Bundle", value: Bundle.main.bundleIdentifier ?? "com.mowgo.app")
            InfoRow(label: "Made in", value: "OKC 🌾")
        }
        .padding(16).background(theme.surface).cornerRadius(16)
    }

    private var signOutButton: some View {
        Button(action: {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            showingSignOut = true
        }) {
            Text("Sign Out").fontWeight(.medium).foregroundColor(.red)
                .frame(maxWidth: .infinity).padding()
                .background(theme.surface).cornerRadius(12)
        }
    }

    // MARK: - Helpers

    private var tierDescription: String {
        switch auth.user?.tier {
        case "solo": "15 clients · AI assistant"
        case "crew": "Unlimited · Team · Priority"
        default: "5 clients · Basic features"
        }
    }

    private var tierPrice: String {
        switch auth.user?.tier {
        case "solo": "$39/mo"
        case "crew": "$79/mo"
        default: "$0/mo"
        }
    }
}

// MARK: - Subscription View

struct SubscriptionView: View {
    @Environment(\.dismiss) var dismiss
    @Environment(\.colorScheme) private var colorScheme
    let currentTier: String

    /// When true, Free card is hidden (user is already above Free).
    private var showFreeCard: Bool { normalizedCurrentTier == "free" }

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    private var normalizedCurrentTier: String {
        currentTier.lowercased()
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        if showFreeCard {
                        SubscriptionPlanCard(
                            name: "Free",
                            price: "$0/mo",
                            features: ["5 clients", "Basic scheduling", "Invoice tracking"],
                            tier: "free",
                            isCurrent: normalizedCurrentTier == "free"
                        )
                        }

                        SubscriptionPlanCard(
                            name: "Solo",
                            price: "$39/mo",
                            features: [
                                "15 clients",
                                "AI Autopilot assistant",
                                "Route optimization",
                                "Photo attachments",
                                "Priority support"
                            ],
                            tier: "solo",
                            isCurrent: normalizedCurrentTier == "solo"
                        )

                        SubscriptionPlanCard(
                            name: "Crew",
                            price: "$79/mo",
                            features: [
                                "Everything in Solo",
                                "Unlimited clients",
                                "Multi-user / crew",
                                "Job assignment & tracking",
                                "Team progress dashboard"
                            ],
                            tier: "crew",
                            isCurrent: normalizedCurrentTier == "crew"
                        )
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Plans")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

private struct SectionHeader: View {
    let title: String
    init(_ title: String) { self.title = title }
    var body: some View {
        Text(title.uppercased())
            .font(.caption.weight(.semibold))
            .foregroundColor(.gray)
            .padding(.top, 12)
            .padding(.leading, 4)
    }
}
