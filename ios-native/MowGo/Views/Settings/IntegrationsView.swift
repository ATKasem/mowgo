import SwiftUI
import UIKit
import AuthenticationServices

private struct QBOStatusResponse: Decodable {
    let connected: Bool
    let companyName: String?
    let lastSyncedAt: String?
}

private struct QBOSyncResponse: Decodable {
    let synced: Bool?
    let error: String?
}

/// Anchors the QuickBooks OAuth browser sheet to the app's key window.
/// ASWebAuthenticationPresentationContextProviding is an `@objc` protocol,
/// so this needs to be a class — IntegrationsView (a struct) can't conform.
private final class QBOAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}

private struct WebhookEventOption: Identifiable {
    let id: String
    let title: LocalizedStringKey
    let detail: LocalizedStringKey
}

private let webhookEventOptions = [
    WebhookEventOption(id: "job.created", title: "Job Created", detail: "New job scheduled"),
    WebhookEventOption(id: "job.updated", title: "Job Updated", detail: "Status, date, or details change"),
    WebhookEventOption(id: "job.completed", title: "Job Completed", detail: "Status changes to done"),
    WebhookEventOption(id: "invoice.paid", title: "Invoice Paid", detail: "Invoice is marked paid"),
    WebhookEventOption(id: "customer.created", title: "Customer Created", detail: "New client added"),
    WebhookEventOption(id: "payment.failed", title: "Payment Failed", detail: "Payment attempt failed"),
    WebhookEventOption(id: "rain.delay.applied", title: "Rain Delay Applied", detail: "Scheduled jobs moved"),
    WebhookEventOption(id: "job.skipped", title: "Job Skipped", detail: "Job is skipped"),
    WebhookEventOption(id: "lead.created", title: "Lead Created", detail: "New lead added"),
    WebhookEventOption(id: "lead.status.updated", title: "Lead Status Updated", detail: "Lead status changes")
]

struct IntegrationsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var store = WebhookConfigStore()
    @State private var editingConfig: WebhookConfig?
    @State private var deletingConfig: WebhookConfig?

    @State private var qboConnected = false
    @State private var qboCompanyName: String?
    @State private var qboLastSyncedAt: String?
    @State private var qboLoading = true
    @State private var qboConnecting = false
    @State private var qboSyncing = false
    @State private var qboDisconnecting = false
    @State private var qboError: String?
    @State private var confirmDisconnectQBO = false
    @State private var qboWebAuthSession: ASWebAuthenticationSession?
    private let qboAuthContextProvider = QBOAuthContextProvider()

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    quickBooksCard()

                    Text("Send MowGo events to Zapier, Make, n8n, or any HTTPS endpoint that accepts POST JSON.")
                        .font(.subheadline).foregroundColor(theme.textMuted)

                    Text("Set up a webhook for job.completed to automatically notify customers when their lawn service is done. Connect it to Zapier or Make to send SMS, email, or any other notification.")
                        .font(.caption).foregroundColor(theme.textSecondary)

                    Button { editingConfig = WebhookConfigStore.newConfig() } label: {
                        Label("Add Endpoint", systemImage: "plus")
                            .fontWeight(.semibold).frame(maxWidth: .infinity).padding(12)
                    }
                    .buttonStyle(.borderedProminent).tint(MowGoTheme.deepGreen)

                    if store.isLoading { ProgressView().frame(maxWidth: .infinity) }
                    else if store.configs.isEmpty {
                        Text("No webhook endpoints yet.")
                            .foregroundColor(theme.textMuted).frame(maxWidth: .infinity).padding(28)
                            .background(theme.surface).cornerRadius(16)
                    } else {
                        ForEach(store.configs) { config in endpointCard(config) }
                    }
                }.padding(16)
            }
        }
        .navigationTitle("Integrations").navigationBarTitleDisplayMode(.inline)
        .task {
            do { _ = try await store.loadConfigs() } catch { store.report(error) }
        }
        .task { await refreshQBOStatus() }
        .alert("Disconnect QuickBooks?", isPresented: $confirmDisconnectQBO) {
            Button("Disconnect QuickBooks", role: .destructive) { Task { await disconnectQuickBooks() } }
            Button("Cancel", role: .cancel) {}
        } message: { Text("This will stop invoice sync with QuickBooks Online.") }
        .sheet(item: $editingConfig) { config in
            WebhookEditorView(config: config) { saved in
                try await store.saveConfig(saved)
            }
        }
        .alert("Delete Endpoint?", isPresented: Binding(
            get: { deletingConfig != nil }, set: { if !$0 { deletingConfig = nil } }
        )) {
            Button("Delete", role: .destructive) {
                guard let id = deletingConfig?.id else { return }
                Task { do { try await store.deleteConfig(id: id) } catch { store.report(error) } }
                deletingConfig = nil
            }
            Button("Cancel", role: .cancel) { deletingConfig = nil }
        } message: { Text("This endpoint will stop receiving MowGo events.") }
        .alert("Couldn’t Update Integrations", isPresented: Binding(
            get: { store.errorMessage != nil }, set: { if !$0 { store.clearError() } }
        )) { Button("OK") { store.clearError() } } message: { Text(store.errorMessage ?? NSLocalizedString("Unknown error", comment: "Integrations save failure fallback message")) }
    }

    private func quickBooksCard() -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: qboConnected ? "checkmark.circle.fill" : "link.circle")
                    .foregroundColor(qboConnected ? MowGoTheme.success : theme.textMuted)
                Text("QuickBooks").font(.headline)
                Spacer()
            }

            if qboLoading || qboConnecting {
                ProgressView().frame(maxWidth: .infinity)
            } else if qboConnected {
                Text(String(format: NSLocalizedString("Connected to %@", comment: "QuickBooks connected status; %@ is the QuickBooks company name"), qboCompanyName ?? NSLocalizedString("QuickBooks", comment: "Fallback QuickBooks company name when none is returned")))
                    .font(.subheadline).foregroundColor(theme.textPrimary)
                Text(String(format: NSLocalizedString("Last synced: %@", comment: "QuickBooks last sync timestamp label"), formattedQBOLastSynced))
                    .font(.caption).foregroundColor(theme.textMuted)

                HStack {
                    Button {
                        Task { await syncQuickBooks() }
                    } label: {
                        if qboSyncing { ProgressView() } else { Text("Sync Now") }
                    }
                    .buttonStyle(.borderedProminent).tint(MowGoTheme.deepGreen)
                    .disabled(qboSyncing)
                    Spacer()
                }

                Button("Disconnect QuickBooks") { confirmDisconnectQBO = true }
                    .font(.caption).foregroundColor(theme.textMuted)
                    .disabled(qboDisconnecting)
            } else {
                Text("Sync your invoices to QuickBooks Online automatically.")
                    .font(.subheadline).foregroundColor(theme.textMuted)
                Button {
                    connectQuickBooks()
                } label: {
                    Label("Connect QuickBooks", systemImage: "link")
                }
                .buttonStyle(.borderedProminent).tint(MowGoTheme.deepGreen)
            }

            if let qboError { Text(qboError).font(.caption).foregroundColor(.red) }
        }.padding(16).background(theme.surface).cornerRadius(16)
    }

    private var formattedQBOLastSynced: String {
        guard let raw = qboLastSyncedAt, let date = Self.parseISODate(raw) else {
            return NSLocalizedString("Never", comment: "QuickBooks has never synced")
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    /// Tolerant ISO-8601 parser: Supabase timestamps carry fractional seconds,
    /// which the default ISO8601DateFormatter rejects.
    private static func parseISODate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }

    private func refreshQBOStatus() async {
        qboLoading = true
        defer { qboLoading = false }
        guard let token = await SupabaseService.shared.token, !token.isEmpty else { return }

        var request = URLRequest(url: URL(string: "https://mowgoapp.com/api/integrations/qbo-status")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return }
            let decoded = try JSONDecoder().decode(QBOStatusResponse.self, from: data)
            qboConnected = decoded.connected
            qboCompanyName = decoded.companyName
            qboLastSyncedAt = decoded.lastSyncedAt
        } catch {
            #if DEBUG
            print("[IntegrationsView] QuickBooks status fetch failed: \(error.localizedDescription)")
            #endif
        }
    }

    private func connectQuickBooks() {
        qboError = nil
        qboConnecting = true
        Task {
            guard let token = await SupabaseService.shared.token, !token.isEmpty else {
                qboError = NSLocalizedString("Sign in required to use QuickBooks.", comment: "QuickBooks action error when no auth token is available")
                qboConnecting = false
                return
            }

            var request = URLRequest(url: URL(string: "https://mowgoapp.com/api/integrations/qbo-connect")!)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

            guard let (data, response) = try? await URLSession.shared.data(for: request),
                  let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let payload = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                  let urlString = payload["url"], let url = URL(string: urlString) else {
                qboError = NSLocalizedString("Could not start QuickBooks connection.", comment: "QuickBooks connection startup error")
                qboConnecting = false
                return
            }

            // qbo-connect is a top-level browser redirect straight to Intuit's
            // OAuth consent screen (not a JSON API) — the OAuth callback lands
            // on a mowgoapp.com page, so there's no custom callback scheme for
            // ASWebAuthenticationSession to intercept. The user dismisses the
            // sheet themselves once they see the confirmation page; we just
            // re-check qbo-status afterward regardless of how the sheet closed.
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: nil) { _, _ in
                Task {
                    qboConnecting = false
                    await refreshQBOStatus()
                }
            }
            session.presentationContextProvider = qboAuthContextProvider
            qboWebAuthSession = session
            session.start()
        }
    }

    private func syncQuickBooks() async {
        qboError = nil
        qboSyncing = true
        defer { qboSyncing = false }
        guard let token = await SupabaseService.shared.token, !token.isEmpty else {
            qboError = NSLocalizedString("Sign in required to use QuickBooks.", comment: "QuickBooks action error when no auth token is available")
            return
        }

        var request = URLRequest(url: URL(string: "https://mowgoapp.com/api/integrations/qbo-sync")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["event": "manual", "payload": [String: Any]()])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            let decoded = try? JSONDecoder().decode(QBOSyncResponse.self, from: data)
            if http?.statusCode == 200, decoded?.synced == true {
                await refreshQBOStatus()
            } else {
                qboError = decoded?.error ?? NSLocalizedString("QuickBooks sync failed.", comment: "Generic QuickBooks sync failure message")
            }
        } catch {
            qboError = error.localizedDescription
        }
    }

    private func disconnectQuickBooks() async {
        qboDisconnecting = true
        defer { qboDisconnecting = false }
        guard let token = await SupabaseService.shared.token, !token.isEmpty else { return }

        var request = URLRequest(url: URL(string: "https://mowgoapp.com/api/integrations/qbo-disconnect")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                qboError = NSLocalizedString("QuickBooks disconnect failed.", comment: "Generic QuickBooks disconnect failure message")
                return
            }
            qboConnected = false
            qboCompanyName = nil
            qboLastSyncedAt = nil
        } catch {
            qboError = error.localizedDescription
        }
    }

    private func endpointCard(_ config: WebhookConfig) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "bolt.fill").foregroundColor(.purple)
                Text(config.label?.isEmpty == false ? config.label! : NSLocalizedString("Untitled endpoint", comment: "Webhook endpoint with no label set"))
                    .font(.headline).lineLimit(1)
                Spacer()
                Toggle("Active", isOn: Binding(
                    get: { config.isActive },
                    set: { active in
                        var changed = config; changed.isActive = active
                        Task { do { try await store.saveConfig(changed) } catch { store.report(error) } }
                    }
                )).labelsHidden()
            }
            Text(config.url).font(.caption).foregroundColor(theme.textMuted).lineLimit(1)
            Text("\(config.events.count) event\(config.events.count == 1 ? "" : "s")")
                .font(.caption).foregroundColor(theme.textMuted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack { ForEach(config.events, id: \.self) { event in
                    Text(event).font(.caption2).padding(.horizontal, 8).padding(.vertical, 4)
                        .background(MowGoTheme.deepGreen.opacity(0.12)).cornerRadius(8)
                } }
            }
            HStack {
                Button("Edit") { editingConfig = config }
                Spacer()
                Button("Delete", role: .destructive) { deletingConfig = config }
            }.font(.subheadline).fontWeight(.medium)
        }.padding(16).background(theme.surface).cornerRadius(16)
    }
}

private struct WebhookEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @State var config: WebhookConfig
    let onSave: (WebhookConfig) async throws -> Void
    @State private var revealSecret = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var confirmRegeneration = false

    private var validURL: Bool {
        guard let parts = URLComponents(string: config.url.trimmingCharacters(in: .whitespacesAndNewlines)) else { return false }
        return parts.scheme?.lowercased() == "https" && parts.host?.isEmpty == false
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Endpoint") {
                    TextField("Label (optional)", text: Binding(get: { config.label ?? "" }, set: { config.label = $0 }))
                    TextField("https://hooks.example.com/...", text: $config.url)
                        .textInputAutocapitalization(.never).keyboardType(.URL).autocorrectionDisabled()
                    if !config.url.isEmpty && !validURL { Text("Enter a valid HTTPS URL.").foregroundColor(.red).font(.caption) }
                    Toggle("Active", isOn: $config.isActive)
                }
                Section {
                    HStack {
                        Text(revealSecret ? config.secret : String(repeating: "•", count: 24))
                            .font(.caption.monospaced()).lineLimit(1)
                        Spacer()
                        Button { revealSecret.toggle() } label: { Image(systemName: revealSecret ? "eye.slash" : "eye") }
                        Button { UIPasteboard.general.string = config.secret } label: { Image(systemName: "doc.on.doc") }
                    }
                    Button("Regenerate Secret", role: .destructive) { confirmRegeneration = true }
                } header: { Text("Signing Secret") } footer: {
                    Text("Deliveries include an HMAC-SHA256 signature. Regenerating immediately invalidates the old secret.")
                }
                Section {
                    Button(config.events.count == webhookEventOptions.count ? "Deselect All" : "Select All") {
                        config.events = config.events.count == webhookEventOptions.count ? [] : webhookEventOptions.map(\.id)
                    }
                    ForEach(webhookEventOptions) { option in
                        Button {
                            if config.events.contains(option.id) { config.events.removeAll { $0 == option.id } }
                            else { config.events.append(option.id) }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(option.title).foregroundColor(.primary)
                                    Text(option.detail).font(.caption).foregroundColor(.secondary)
                                }
                                Spacer()
                                if config.events.contains(option.id) { Image(systemName: "checkmark").foregroundColor(MowGoTheme.deepGreen) }
                            }
                        }
                    }
                } header: { Text("Events") }
                if let errorMessage { Section { Text(errorMessage).foregroundColor(.red) } }
            }
            .navigationTitle(config.label?.isEmpty == false ? "Edit Endpoint" : "Add Endpoint")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") {
                        isSaving = true
                        config.url = config.url.trimmingCharacters(in: .whitespacesAndNewlines)
                        config.label = config.label?.trimmingCharacters(in: .whitespacesAndNewlines)
                        Task {
                            do { try await onSave(config); dismiss() }
                            catch { errorMessage = error.localizedDescription; isSaving = false }
                        }
                    }.disabled(!validURL || isSaving)
                }
            }
            .alert("Generate a new secret?", isPresented: $confirmRegeneration) {
                Button("Regenerate", role: .destructive) { config.secret = WebhookConfigStore.generateSecret() }
                Button("Cancel", role: .cancel) {}
            } message: { Text("Your old secret will stop working after you save.") }
        }
    }
}
