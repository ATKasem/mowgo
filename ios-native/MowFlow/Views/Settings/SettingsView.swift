//
//  SettingsView.swift
//  MowFlow
//
//  Settings with profile, subscription tiers, preferences.
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var auth: AuthService
    @AppStorage("isDarkMode") private var isDarkMode = true
    @State private var showingSignOut = false
    @State private var showSubscription = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "111827").ignoresSafeArea()

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
                SubscriptionView()
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
                .font(.system(size: 48)).foregroundColor(Color(hex: "16a34a"))
            VStack(spacing: 2) {
                Text(auth.user?.businessName ?? "MowFlow")
                    .font(.headline).foregroundColor(.white)
                Text(auth.user?.tierLabel ?? "Free Plan")
                    .font(.caption).foregroundColor(Color(hex: "9ca3af"))
            }
        }
        .frame(maxWidth: .infinity).padding(20)
        .background(Color(hex: "1f2937")).cornerRadius(16)
    }

    private var subscriptionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Subscription").font(.headline).foregroundColor(.white)
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(auth.user?.tierLabel ?? "Free Plan")
                        .font(.subheadline.weight(.medium)).foregroundColor(.white)
                    Text(tierDescription).font(.caption).foregroundColor(Color(hex: "9ca3af"))
                }
                Spacer()
                Text(tierPrice)
                    .font(.subheadline.weight(.semibold)).foregroundColor(Color(hex: "16a34a"))
            }
            Divider().background(Color(hex: "374151"))
            Button { showSubscription = true } label: {
                Text("View Plans")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(Color(hex: "16a34a"))
            }
        }
        .padding(16).background(Color(hex: "1f2937")).cornerRadius(16)
    }

    private var preferencesCard: some View {
        VStack(spacing: 0) {
            Toggle(isOn: $isDarkMode) {
                HStack(spacing: 8) {
                    Image(systemName: isDarkMode ? "moon.fill" : "sun.max.fill")
                        .foregroundColor(isDarkMode ? Color(hex: "6366f1") : Color(hex: "f59e0b"))
                    Text("Dark Mode").foregroundColor(.white)
                }
            }
            .tint(Color(hex: "16a34a"))
        }
        .padding(16).background(Color(hex: "1f2937")).cornerRadius(16)
    }

    private var appInfoCard: some View {
        VStack(spacing: 8) {
            InfoRow(label: "Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
            InfoRow(label: "Bundle", value: Bundle.main.bundleIdentifier ?? "com.mowflow.app")
            InfoRow(label: "Made in", value: "OKC 🌾")
        }
        .padding(16).background(Color(hex: "1f2937")).cornerRadius(16)
    }

    private var signOutButton: some View {
        Button(action: {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            showingSignOut = true
        }) {
            Text("Sign Out").fontWeight(.medium).foregroundColor(.red)
                .frame(maxWidth: .infinity).padding()
                .background(Color(hex: "1f2937")).cornerRadius(12)
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
        case "solo": "$19/mo"
        case "crew": "$49/mo"
        default: "$0/mo"
        }
    }
}

// MARK: - Subscription View

struct SubscriptionView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "111827").ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        SubscriptionPlanCard(
                            name: "Free",
                            price: "$0/mo",
                            features: ["5 clients", "Basic scheduling", "Invoice tracking"],
                            tier: "free",
                            isCurrent: true
                        )

                        SubscriptionPlanCard(
                            name: "Solo",
                            price: "$19/mo",
                            features: [
                                "15 clients",
                                "AI Autopilot assistant",
                                "Route optimization",
                                "Photo attachments",
                                "Priority support"
                            ],
                            tier: "solo",
                            isCurrent: false
                        )

                        SubscriptionPlanCard(
                            name: "Crew",
                            price: "$49/mo",
                            features: [
                                "Unlimited clients",
                                "Multi-user / crew",
                                "Everything in Solo",
                                "API access",
                                "Custom branding"
                            ],
                            tier: "crew",
                            isCurrent: false
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
