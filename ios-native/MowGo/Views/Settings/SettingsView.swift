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
                    VStack(spacing: 16) {
                        profileCard
                        subscriptionCard
                        preferencesCard
                        appInfoCard
                        signOutButton
                    }
                    .padding(16)
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
            Button { showSubscription = true } label: {
                Text("View Plans")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(MowGoTheme.deepGreen)
            }
        }
        .padding(16).background(theme.surface).cornerRadius(16)
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
                        SubscriptionPlanCard(
                            name: "Free",
                            price: "$0/mo",
                            features: ["5 clients", "Basic scheduling", "Invoice tracking"],
                            tier: "free",
                            isCurrent: normalizedCurrentTier == "free"
                        )

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
                                "Unlimited clients",
                                "Multi-user / crew",
                                "Everything in Solo",
                                "API access",
                                "Custom branding"
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
