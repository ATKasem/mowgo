import Foundation
import Security
import Combine

@MainActor
final class WebhookConfigStore: ObservableObject {
    @Published private(set) var configs: [WebhookConfig] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let sb = SupabaseService.shared
    private var persistedIDs = Set<UUID>()

    func loadConfigs() async throws -> [WebhookConfig] {
        isLoading = true
        defer { isLoading = false }
        if !(await sb.isConfigured) { return configs }
        let loaded: [WebhookConfig] = try await sb.fetch(
            "webhook_configs",
            query: ["order": "created_at.asc"]
        )
        configs = loaded
        persistedIDs = Set(loaded.map(\.id))
        return loaded
    }

    func saveConfig(_ config: WebhookConfig) async throws {
        var saved = config
        if saved.secret.isEmpty { saved.secret = Self.generateSecret() }

        if !(await sb.isConfigured) {
            upsertLocal(saved)
            return
        }

        if persistedIDs.contains(saved.id) {
            struct Patch: Encodable {
                let url: String
                let label: String?
                let events: [String]
                let isActive: Bool
                let secret: String
            }
            try await sb.update("webhook_configs", id: saved.id, Patch(
                url: saved.url,
                label: saved.label,
                events: saved.events,
                isActive: saved.isActive,
                secret: saved.secret
            ))
        } else {
            guard let userId = try await sb.getCurrentUserId() else { throw SupabaseError.network }
            saved.userId = userId
            let inserted: WebhookConfig = try await sb.insert("webhook_configs", saved)
            saved = inserted
            persistedIDs.insert(inserted.id)
        }
        upsertLocal(saved)
    }

    func deleteConfig(id: UUID) async throws {
        if await sb.isConfigured { try await sb.delete("webhook_configs", id: id) }
        configs.removeAll { $0.id == id }
        persistedIDs.remove(id)
    }

    func report(_ error: Error) { errorMessage = error.localizedDescription }
    func clearError() { errorMessage = nil }

    static func newConfig() -> WebhookConfig {
        WebhookConfig(id: UUID(), userId: nil, url: "", label: nil, events: [],
                      isActive: true, secret: generateSecret(), createdAt: nil)
    }

    static func generateSecret() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            return UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
                + UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
        }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private func upsertLocal(_ config: WebhookConfig) {
        if let index = configs.firstIndex(where: { $0.id == config.id }) { configs[index] = config }
        else { configs.append(config) }
    }
}
