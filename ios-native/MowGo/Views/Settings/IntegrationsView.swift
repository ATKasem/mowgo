import SwiftUI
import UIKit

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

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Send MowGo events to Zapier, Make, n8n, or any HTTPS endpoint that accepts POST JSON.")
                        .font(.subheadline).foregroundColor(theme.textMuted)

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
