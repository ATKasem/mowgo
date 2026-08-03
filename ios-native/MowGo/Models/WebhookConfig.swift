import Foundation

struct WebhookConfig: Codable, Identifiable, Equatable {
    let id: UUID
    var userId: UUID?
    var url: String
    var label: String?
    var events: [String]
    var isActive: Bool
    var secret: String
    var createdAt: Date?

    private enum CodingKeys: String, CodingKey {
        case id, userId, url, label, events, isActive, secret, createdAt
    }

    init(id: UUID, userId: UUID?, url: String, label: String?, events: [String],
         isActive: Bool, secret: String, createdAt: Date?) {
        self.id = id; self.userId = userId; self.url = url; self.label = label
        self.events = events; self.isActive = isActive; self.secret = secret; self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(UUID.self, forKey: .id)
        userId = try values.decodeIfPresent(UUID.self, forKey: .userId)
        url = try values.decode(String.self, forKey: .url)
        label = try values.decodeIfPresent(String.self, forKey: .label)
        events = try values.decodeIfPresent([String].self, forKey: .events) ?? []
        isActive = try values.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
        secret = try values.decode(String.self, forKey: .secret)
        if let timestamp = try values.decodeIfPresent(String.self, forKey: .createdAt) {
            createdAt = ISO8601DateFormatter().date(from: timestamp)
        } else { createdAt = nil }
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(id, forKey: .id)
        try values.encodeIfPresent(userId, forKey: .userId)
        try values.encode(url, forKey: .url)
        try values.encodeIfPresent(label, forKey: .label)
        try values.encode(events, forKey: .events)
        try values.encode(isActive, forKey: .isActive)
        try values.encode(secret, forKey: .secret)
        if let createdAt { try values.encode(ISO8601DateFormatter().string(from: createdAt), forKey: .createdAt) }
    }
}
