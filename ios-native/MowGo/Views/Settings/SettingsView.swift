//
//  SettingsView.swift
//  MowGo
//
//  Settings with profile, subscription tiers, preferences.
//

import SwiftUI
import UIKit

struct SettingsView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("appearanceMode") private var appearanceMode = AppearancePreference.system.rawValue
    @State private var showingSignOut = false
    @State private var showSubscription = false
    @State private var portalError: String?
    @State private var showCancelConfirmation = false
    @State private var cancelError: String?
    @State private var businessName = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var venmoHandle = ""
    @State private var cashappHandle = ""
    @State private var zelleHandle = ""
    @State private var profileSaveError: String?
    @State private var exportFile: ExportFile?
    @State private var exportError: String?
    @State private var exporting: String?
    @State private var referralStatus: ReferralStatus?
    @State private var referralLoading = false
    @State private var referralError: String?
    @State private var referralShareItems: ReferralShareItems?
    @AppStorage("jobCompletionAlerts") private var jobCompletionAlerts = true
    @AppStorage("rainDelayAlerts") private var rainDelayAlerts = true

    private enum SettingsDestination: Hashable {
        case businessProfile, notifications, appearance, billing, integrations, importYardbook
    }

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
                        profileCard

                        SectionHeader("Business")
                        settingsLinks

                        SectionHeader("Referrals")
                        referralCard

                        if let bookingURL = bookingLink {
                            SectionHeader("Booking")
                            BookingLinkRow(url: bookingURL)
                        }

                        SectionHeader("Data")
                        NavigationLink(value: SettingsDestination.importYardbook) {
                            HStack {
                                Image(systemName: "square.and.arrow.down")
                                    .foregroundColor(MowGoTheme.deepGreen)
                                    .frame(width: 24)
                                Text("Import from Yardbook")
                                    .foregroundColor(theme.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(theme.textSecondary)
                            }
                            .padding(12)
                            .background(theme.surface)
                            .cornerRadius(12)
                        }
                        exportLinks

                        SectionHeader("About")
                        appInfoCard
                        signOutButton
                    }
                    .padding(16)
                }
                .refreshable {
                    await auth.loadProfile()
                }
            }
            .navigationTitle("More")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: SettingsDestination.self) { destination in
                destinationView(for: destination)
            }
            .onAppear(perform: loadProfileDraft)
            .task { await loadReferrals() }
            .onChange(of: auth.user?.businessName) { _, _ in loadProfileDraft() }
            .sheet(isPresented: $showSubscription) {
                SubscriptionView(currentTier: auth.user?.tier ?? "free")
            }
            .sheet(item: $exportFile) { file in
                ActivityView(activityItems: [file.url])
            }
            .sheet(item: $referralShareItems) { items in
                ActivityView(activityItems: [items.url])
            }
            .alert("Export Failed", isPresented: Binding(
                get: { exportError != nil },
                set: { if !$0 { exportError = nil } }
            )) {
                Button("OK", role: .cancel) { exportError = nil }
            } message: {
                Text(exportError ?? NSLocalizedString("Could not create the export file.", comment: "Export failure fallback message"))
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

    @ViewBuilder
    private func destinationView(for destination: SettingsDestination) -> some View {
        switch destination {
        case .businessProfile:
            BusinessProfileSettingsView(
                businessName: $businessName,
                phone: $phone,
                email: $email,
                venmoHandle: $venmoHandle,
                cashappHandle: $cashappHandle,
                zelleHandle: $zelleHandle,
                saveError: $profileSaveError,
                onSave: saveProfile
            )
        case .notifications:
            NotificationSettingsView(
                jobCompletionAlerts: $jobCompletionAlerts,
                rainDelayAlerts: $rainDelayAlerts
            )
        case .appearance:
            AppearanceSettingsView(appearance: appearancePreference)
        case .billing:
            BillingSettingsView(
                tierLabel: auth.user?.tierLabel ?? "Free",
                tierDescription: tierDescription,
                isPaidTier: isPaidTier,
                errorMessage: cancelError ?? portalError,
                onManageSubscription: openCustomerPortal,
                onCancelSubscription: { showCancelConfirmation = true },
                onViewPlans: { showSubscription = true }
            )
        case .integrations:
            IntegrationsView()
        case .importYardbook:
            ImportFromYardbookView()
        }
    }

    private var settingsLinks: some View {
        VStack(spacing: 0) {
            NavigationLink(value: SettingsDestination.businessProfile) {
                SettingsLinkRow(title: "Business Profile", subtitle: businessName.isEmpty ? NSLocalizedString("Business name and phone", comment: "") : businessName, icon: "storefront.fill")
            }
            Divider().padding(.leading, 52)
            NavigationLink(value: SettingsDestination.notifications) {
                SettingsLinkRow(title: "Notifications", subtitle: NSLocalizedString("Job completion and rain alerts", comment: ""), icon: "bell.fill")
            }
            Divider().padding(.leading, 52)
            NavigationLink(value: SettingsDestination.appearance) {
                SettingsLinkRow(title: "Appearance", subtitle: appearancePreference.wrappedValue.label, icon: "circle.lefthalf.filled")
            }
            Divider().padding(.leading, 52)
            NavigationLink(value: SettingsDestination.billing) {
                SettingsLinkRow(title: "Billing", subtitle: auth.user?.tierLabel ?? NSLocalizedString("Free", comment: "Subscription tier name: free plan"), icon: "creditcard.fill")
            }
            if isPaidTier {
                Divider().padding(.leading, 52)
                NavigationLink(value: SettingsDestination.integrations) {
                    SettingsLinkRow(title: "Integrations", subtitle: NSLocalizedString("Zapier, Make, n8n webhooks", comment: ""), icon: "link.circle.fill")
                }
            }
        }
        .background(theme.surface)
        .cornerRadius(16)
    }

    private var exportLinks: some View {
        VStack(spacing: 0) {
            ExportRow(title: "Export Clients", loading: exporting == "Export Clients") {
                Task<Void, Never> { await exportClients() }
            }
            Divider().padding(.leading, 52)
            ExportRow(title: "Export Jobs", loading: exporting == "Export Jobs") {
                Task<Void, Never> { await exportJobs() }
            }
            Divider().padding(.leading, 52)
            ExportRow(title: "Export Invoices", loading: exporting == "Export Invoices") {
                Task<Void, Never> { await exportInvoices() }
            }
            Divider().padding(.leading, 52)
            ExportRow(title: "Export Leads", loading: exporting == "Export Leads") {
                Task<Void, Never> { await exportLeads() }
            }
        }
        .background(theme.surface)
        .cornerRadius(16)
        .disabled(exporting != nil)
    }

    private var referralCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Give a month, earn a month", systemImage: "gift.fill")
                .font(.headline).foregroundColor(theme.textPrimary)
            if referralLoading {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 12)
            } else if let referralError {
                Text(referralError).font(.caption).foregroundColor(.red)
                Text("Refer another lawn care operator and you both earn a free month of MowGo.")
                    .font(.caption).foregroundColor(theme.textMuted)
            } else if let status = referralStatus {
                if let code = status.code {
                    HStack {
                        Text(code).font(.system(.title2, design: .monospaced).bold()).tracking(3)
                        Spacer()
                        Button {
                            UIPasteboard.general.string = code
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                        .buttonStyle(.bordered)
                        Button("Share") {
                            guard var components = URLComponents(string: "https://mowgoapp.com") else { return }
                            components.queryItems = [URLQueryItem(name: "ref", value: code)]
                            guard let url = components.url else { return }
                            referralShareItems = ReferralShareItems(url: url)
                        }.buttonStyle(.borderedProminent)
                    }
                }
                HStack {
                    referralStat("Free months earned", status.earnedCount)
                }
                Text("You've referred \(status.totalCount) people. \(status.earnedCount) have signed up.")
                    .font(.subheadline).foregroundColor(theme.textMuted)
                Text("When another lawn care operator signs up using your referral code, you both earn a free month of MowGo. Share your code with other crews you know.")
                    .font(.caption).foregroundColor(theme.textMuted)
            }
        }
        .padding(16).background(theme.surface).cornerRadius(16)
    }

    private func referralStat(_ label: String, _ value: Int) -> some View {
        VStack(spacing: 2) {
            Text("\(value)").font(.headline).foregroundColor(theme.textPrimary)
            Text(label).font(.caption2).foregroundColor(theme.textMuted).lineLimit(1).minimumScaleFactor(0.7)
        }.frame(maxWidth: .infinity)
    }

    @MainActor
    private func loadReferrals() async {
        guard !referralLoading else { return }
        referralLoading = true
        referralError = nil
        defer { referralLoading = false }
        do {
            referralStatus = try await store.loadReferralStatus()
        } catch is DecodingError {
            referralError = "Referral stats are not available right now."
        } catch let caught {
            referralError = caught.localizedDescription
        }
    }

    @MainActor
    private func exportClients() async {
        await performExport(title: "Export Clients", filename: "mowgo-clients.csv") {
            let clients: [Client]
            if await SupabaseService.shared.isConfigured {
                clients = try await SupabaseService.shared.fetchExportClients()
            } else {
                clients = store.clients
            }
            return ExportService.csv(from: clients)
        }
    }

    @MainActor
    private func exportJobs() async {
        await performExport(title: "Export Jobs", filename: "mowgo-jobs.csv") {
            let jobs: [Job]
            if await SupabaseService.shared.isConfigured {
                jobs = try await SupabaseService.shared.fetchExportJobs()
            } else {
                jobs = store.jobs
            }
            return ExportService.csv(from: jobs)
        }
    }

    @MainActor
    private func exportInvoices() async {
        await performExport(title: "Export Invoices", filename: "mowgo-invoices.csv") {
            let invoices: [Invoice]
            if await SupabaseService.shared.isConfigured {
                invoices = try await SupabaseService.shared.fetchExportInvoices()
            } else {
                invoices = store.invoices
            }
            return ExportService.csv(from: invoices)
        }
    }

    @MainActor
    private func exportLeads() async {
        await performExport(title: "Export Leads", filename: "mowgo-leads.csv") {
            ExportService.csv(from: store.leads)
        }
    }

    @MainActor
    private func performExport(
        title: String,
        filename: String,
        csv: () async throws -> String
    ) async {
        exporting = title
        exportError = nil
        defer { exporting = nil }
        do {
            export(try await csv(), filename: filename)
        } catch {
            exportError = error.localizedDescription
        }
    }

    private func export(_ csv: String, filename: String) {
        do {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            try csv.write(to: url, atomically: true, encoding: .utf8)
            exportFile = ExportFile(url: url)
        } catch {
            exportError = error.localizedDescription
        }
    }

    private func loadProfileDraft() {
        businessName = auth.user?.businessName ?? ""
        phone = auth.user?.phone ?? ""
        email = auth.user?.email ?? ""
        venmoHandle = auth.user?.venmoHandle ?? ""
        cashappHandle = auth.user?.cashappHandle ?? ""
        zelleHandle = auth.user?.zelleHandle ?? ""
    }

    private func saveProfile() async {
        profileSaveError = nil
        do {
            try await auth.updateProfile(
                businessName: businessName, phone: phone, email: email,
                venmoHandle: venmoHandle, cashappHandle: cashappHandle, zelleHandle: zelleHandle
            )
        } catch {
            profileSaveError = error.localizedDescription
        }
    }

    private var profileCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.circle.fill")
                .font(.system(size: 48)).foregroundColor(MowGoTheme.deepGreen)
            VStack(spacing: 2) {
                Text(auth.user?.businessName ?? "MowGo")
                    .font(.headline).foregroundColor(theme.textPrimary)
                Text(auth.user?.tierLabel ?? NSLocalizedString("Free Plan", comment: "Profile card subtitle when signed out"))
                    .font(.caption).foregroundColor(theme.textMuted)
            }
        }
        .frame(maxWidth: .infinity).padding(20)
        .background(theme.surface).cornerRadius(16)
    }

    private var isPaidTier: Bool {
        let tier = auth.user?.tier ?? "free"
        return tier == "solo" || tier == "crew" || tier == "premium"
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

    private var bookingLink: URL? {
        guard let user = auth.user else { return nil }
        let bid: String
        if user.role == "owner" {
            bid = user.id?.uuidString.lowercased() ?? ""
        } else {
            bid = user.businessId?.uuidString.lowercased() ?? ""
        }
        guard !bid.isEmpty else { return nil }
        return URL(string: "https://mowgoapp.com/#/book/\(bid)")
    }

    // MARK: - Helpers

    private var tierDescription: LocalizedStringKey {
        switch auth.user?.tier {
        case "solo": "Unlimited clients & jobs · Recurring jobs"
        case "crew": "Unlimited clients · Full team access"
        case "premium": "Everything in Crew · Priority concierge · Seasonal packs · Priority support"
        default: "5 clients · Basic features"
        }
    }
}

// MARK: - Settings Details

private struct SettingsLinkRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: LocalizedStringKey
    let subtitle: String
    let icon: String

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 28, height: 28)
                .foregroundColor(MowGoTheme.deepGreen)
                .background(MowGoTheme.deepGreen.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.medium)).foregroundColor(theme.textPrimary)
                Text(subtitle).font(.caption).foregroundColor(theme.textMuted).lineLimit(1)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundColor(theme.textMuted)
        }
        .padding(14)
        .contentShape(Rectangle())
    }
}

private struct ExportFile: Identifiable {
    let url: URL
    var id: URL { url }
}

private struct ReferralShareItems: Identifiable {
    let id = UUID()
    let url: URL
}

private struct ExportRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: LocalizedStringKey
    let loading: Bool
    let action: () -> Void

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: "square.and.arrow.up")
                    .frame(width: 28, height: 28)
                    .foregroundColor(MowGoTheme.deepGreen)
                    .background(MowGoTheme.deepGreen.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                Text(title).font(.subheadline.weight(.medium)).foregroundColor(theme.textPrimary)
                Spacer()
                if loading {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundColor(theme.textMuted)
                }
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private struct BusinessProfileSettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var businessName: String
    @Binding var phone: String
    @Binding var email: String
    @Binding var venmoHandle: String
    @Binding var cashappHandle: String
    @Binding var zelleHandle: String
    @Binding var saveError: String?
    let onSave: () async -> Void
    @State private var isSaving = false
    @State private var showSavedBanner = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        ZStack(alignment: .bottom) {
            Form {
                Section {
                    TextField("Business name", text: $businessName)
                        .textInputAutocapitalization(.words)
                    TextField("Phone number", text: $phone)
                        .keyboardType(.phonePad)
                    TextField("Email address", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                } footer: {
                    Text("This information appears on customer-facing messages and invoices.")
                }
                Section {
                    TextField("Zelle (phone or email)", text: $zelleHandle)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                    TextField("Venmo (@handle)", text: $venmoHandle)
                        .textInputAutocapitalization(.never)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                    TextField("Cash App ($handle)", text: $cashappHandle)
                        .textInputAutocapitalization(.never)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                } header: {
                    Text("How clients pay you")
                } footer: {
                    Text("These go in your invoice texts. Zelle is listed first — clients usually pay the first option they see.")
                }
                if let saveError {
                    Section { Text(saveError).foregroundColor(.red) }
                }
                Section {
                    Button {
                        Task {
                            isSaving = true
                            await onSave()
                            isSaving = false
                            if saveError == nil {
                                showSavedBanner = true
                                try? await Task.sleep(for: .seconds(2))
                                withAnimation { showSavedBanner = false }
                            }
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if isSaving { ProgressView().tint(.white) }
                            Text("Save Changes").fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .disabled(isSaving || businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .listRowBackground(MowGoTheme.deepGreen)
                    .foregroundColor(.white)
                }
            }
            .scrollContentBackground(.hidden)
            .background(theme.background)

            // Saved banner
            if showSavedBanner {
                Text("Changes saved")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(MowGoTheme.deepGreen)
                    .clipShape(Capsule())
                    .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
                    .padding(.bottom, 24)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .navigationTitle("Business Profile")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NotificationSettingsView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @Binding var jobCompletionAlerts: Bool
    @Binding var rainDelayAlerts: Bool
    @State private var rainAlertsEnabled = true
    @State private var leadAlertsEnabled = true
    @State private var rainAlertsError: String?
    @State private var leadAlertsError: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    /// Crew role rides on the owner's plan, so tier alone is enough here —
    /// matches the web gate in Settings.jsx (['solo','crew','premium']).
    private var isPaidTier: Bool {
        let tier = auth.user?.tier ?? "free"
        return tier == "solo" || tier == "crew" || tier == "premium"
    }

    private var rainAlertsBinding: Binding<Bool> {
        Binding(
            get: { rainAlertsEnabled },
            set: { newValue in
                let previous = rainAlertsEnabled
                rainAlertsEnabled = newValue
                Task {
                    do {
                        try await auth.updateRainAlertsEnabled(newValue)
                        rainAlertsError = nil
                    } catch {
                        rainAlertsEnabled = previous
                        rainAlertsError = error.localizedDescription
                    }
                }
            }
        )
    }

    private var leadAlertsBinding: Binding<Bool> {
        Binding(
            get: { leadAlertsEnabled },
            set: { newValue in
                let previous = leadAlertsEnabled
                leadAlertsEnabled = newValue
                Task {
                    do {
                        try await auth.updateLeadAlertsEnabled(newValue)
                        leadAlertsError = nil
                    } catch {
                        leadAlertsEnabled = previous
                        leadAlertsError = error.localizedDescription
                    }
                }
            }
        )
    }

    var body: some View {
        Form {
            Section("Job activity") {
                Toggle(isOn: $jobCompletionAlerts) {
                    settingsLabel("Job completion alerts", "When a job is marked complete")
                }
            }
            if isPaidTier {
                Section("Leads") {
                    Toggle(isOn: leadAlertsBinding) {
                        settingsLabel("Lead alerts", "Get notified instantly when a new lead comes in")
                    }
                    if let leadAlertsError {
                        Text(leadAlertsError).font(.caption).foregroundColor(.red)
                    }
                }
            }
            Section("Weather") {
                Toggle(isOn: $rainDelayAlerts) {
                    settingsLabel("Rain delay alerts", "When rain may affect tomorrow's jobs")
                }
                Toggle(isOn: rainAlertsBinding) {
                    settingsLabel("Rain delay notifications", "Alert when rain is forecast for tomorrow's jobs")
                }
                if let rainAlertsError {
                    Text(rainAlertsError).font(.caption).foregroundColor(.red)
                }
            }
        }
        .tint(MowGoTheme.deepGreen)
        .scrollContentBackground(.hidden)
        .background(theme.background)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            rainAlertsEnabled = auth.user?.rainAlertsEnabled ?? true
            leadAlertsEnabled = auth.user?.leadAlertsEnabled ?? true
        }
    }

    private func settingsLabel(_ title: LocalizedStringKey, _ subtitle: LocalizedStringKey) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).foregroundColor(theme.textPrimary)
            Text(subtitle).font(.caption).foregroundColor(theme.textMuted)
        }
    }
}

private struct AppearanceSettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var appearance: AppearancePreference

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        Form {
            Section("Theme") {
                ForEach(AppearancePreference.allCases) { preference in
                    Button { appearance = preference } label: {
                        HStack {
                            Label(preference.label, systemImage: icon(for: preference))
                                .foregroundColor(theme.textPrimary)
                            Spacer()
                            if appearance == preference {
                                Image(systemName: "checkmark").fontWeight(.semibold).foregroundColor(MowGoTheme.deepGreen)
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(theme.background)
        .navigationTitle("Appearance")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func icon(for preference: AppearancePreference) -> String {
        switch preference {
        case .system: "circle.lefthalf.filled"
        case .light: "sun.max.fill"
        case .dark: "moon.fill"
        }
    }
}

private struct BillingSettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    let tierLabel: String
    let tierDescription: LocalizedStringKey
    let isPaidTier: Bool
    let errorMessage: String?
    let onManageSubscription: () -> Void
    let onCancelSubscription: () -> Void
    let onViewPlans: () -> Void

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Current plan").font(.caption.weight(.semibold)).foregroundColor(theme.textMuted)
                    HStack(alignment: .firstTextBaseline) {
                        Text(tierLabel).font(.title2.weight(.bold)).foregroundColor(theme.textPrimary)
                        Spacer()
                        Text("Billed monthly or annually").font(.caption).foregroundColor(theme.textMuted)
                    }
                    Text(tierDescription).font(.subheadline).foregroundColor(theme.textMuted)
                }
                .padding(18).background(theme.surface).cornerRadius(16)

                Button(isPaidTier ? "Manage Subscription" : "View Plans", action: isPaidTier ? onManageSubscription : onViewPlans)
                    .font(.headline).foregroundColor(.white)
                    .frame(maxWidth: .infinity).padding()
                    .background(MowGoTheme.deepGreen).cornerRadius(12)

                if isPaidTier {
                    Button("Cancel Subscription", role: .destructive, action: onCancelSubscription)
                        .frame(maxWidth: .infinity).padding()
                        .background(theme.surface).cornerRadius(12)
                }
                if let errorMessage {
                    Text(errorMessage).font(.caption).foregroundColor(.red).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(16)
        }
        .background(theme.background)
        .navigationTitle("Billing")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Subscription View

struct SubscriptionView: View {
    @Environment(\.dismiss) var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject var auth: AuthService
    @State private var billingInterval = "year"
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
                        // Trial-first no-card flow: countdown or trial-ended banner.
                        if let profile = auth.user, profile.hasActiveTrial {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text("\(profile.trialDaysLeft ?? 1) days left in your \(profile.trialPlanLabel ?? "Free") trial")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundColor(MowGoTheme.deepGreen)
                                    Spacer()
                                }
                                Text("Subscribe to keep unlimited clients & jobs")
                                    .font(.caption)
                                    .foregroundColor(theme.textMuted)
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(MowGoTheme.deepGreen.opacity(MowGoTheme.accentOpacity))
                            .cornerRadius(12)
                        } else if let profile = auth.user, profile.hasUsedTrial && profile.tier?.lowercased() == "free" {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Your trial ended")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(.orange)
                                Text("Your clients are safe — subscribe to keep scheduling beyond 5.")
                                    .font(.caption)
                                    .foregroundColor(theme.textMuted)
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.orange.opacity(MowGoTheme.accentOpacity))
                            .cornerRadius(12)
                        }

                        VStack(spacing: 4) {
                            Picker("Billing interval", selection: $billingInterval) {
                                Text("Annual").tag("year")
                                Text("Month").tag("month")
                            }
                            .pickerStyle(.segmented)
                            .tint(MowGoTheme.deepGreen)

                            HStack {
                                Text("2 months free")
                                    .font(.caption)
                                    .foregroundColor(MowGoTheme.deepGreen)
                                    .frame(maxWidth: .infinity)
                                Color.clear
                                    .frame(maxWidth: .infinity)
                            }
                        }

                        if showFreeCard {
                        SubscriptionPlanCard(
                            name: "Free",
                            price: "$0/mo",
                            features: [
                                "Up to 5 clients",
                                "Daily job scheduling",
                                "Rain delay auto-reschedule",
                                "Invoice tracking",
                                "Dark mode + installable PWA"
                            ],
                            tier: "free",
                            isCurrent: normalizedCurrentTier == "free",
                            userTier: normalizedCurrentTier,
                            billingInterval: billingInterval,
                            userHasUsedTrial: auth.user?.hasUsedTrial ?? false
                        )
                        }

                        SubscriptionPlanCard(
                            name: "Solo",
                            price: billingInterval == "year" ? "$390/yr" : "$39/mo",
                            features: [
                                "Unlimited clients & jobs",
                                "Recurring job automation",
                                "GPS route navigation",
                                "Client notes, codes & pets",
                                "Offline mode"
                            ],
                            tier: "solo",
                            isCurrent: normalizedCurrentTier == "solo",
                            userTier: normalizedCurrentTier,
                            billingInterval: billingInterval,
                            userHasUsedTrial: auth.user?.hasUsedTrial ?? false
                        )

                        SubscriptionPlanCard(
                            name: "Crew",
                            price: billingInterval == "year" ? "$790/yr" : "$79/mo",
                            features: [
                                "Everything in Solo",
                                "Unlimited clients",
                                "Job assignment & tracking",
                                "Team progress dashboard"
                            ],
                            tier: "crew",
                            isCurrent: normalizedCurrentTier == "crew",
                            userTier: normalizedCurrentTier,
                            billingInterval: billingInterval,
                            userHasUsedTrial: auth.user?.hasUsedTrial ?? false
                        )

                        SubscriptionPlanCard(
                            name: "Premium",
                            price: billingInterval == "year" ? "$1,990/yr" : "$199/mo",
                            features: [
                                "Everything in Crew",
                                "Priority concierge setup — clients imported + first 30 days pre-scheduled in 48h",
                                "Seasonal packs: spring pricing benchmarks, route templates",
                                "Priority text-first support"
                            ],
                            tier: "premium",
                            isCurrent: normalizedCurrentTier == "premium",
                            userTier: normalizedCurrentTier,
                            billingInterval: billingInterval,
                            userHasUsedTrial: auth.user?.hasUsedTrial ?? false
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
    let title: LocalizedStringKey
    init(_ title: LocalizedStringKey) { self.title = title }
    var body: some View {
        Text(title)
            .textCase(.uppercase)
            .font(.caption.weight(.semibold))
            .foregroundColor(.gray)
            .padding(.top, 12)
            .padding(.leading, 4)
    }
}

private struct BookingLinkRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let url: URL
    @State private var showCopied = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        VStack(spacing: 10) {
            Text("Share this link with clients so they can book their own appointments online. You can also add it to your website or social media.")
                .font(.caption)
                .foregroundColor(theme.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 10) {
                Image(systemName: "link")
                    .font(.system(size: 16))
                    .foregroundColor(MowGoTheme.deepGreen)
                    .frame(width: 28, height: 28)
                    .background(MowGoTheme.deepGreen.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                Text(url.absoluteString)
                    .font(.caption)
                    .foregroundColor(theme.textMuted)
                    .lineLimit(2)
                    .textSelection(.enabled)

                Spacer()
            }

            HStack(spacing: 12) {
                ShareLink(item: url) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(MowGoTheme.deepGreen)
                        .cornerRadius(10)
                }

                Button {
                    UIPasteboard.general.string = url.absoluteString
                    showCopied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        showCopied = false
                    }
                } label: {
                    Label(showCopied ? "Copied!" : "Copy", systemImage: showCopied ? "checkmark" : "doc.on.doc")
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(showCopied ? .green : theme.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(theme.surface)
                        .cornerRadius(10)
                }
            }
        }
        .padding(14)
        .background(theme.surface)
        .cornerRadius(16)
    }
}
