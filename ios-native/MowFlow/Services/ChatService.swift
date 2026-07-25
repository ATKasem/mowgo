//
//  ChatService.swift
//  MowFlow
//
//  AI Autopilot — conversational assistant for lawn care business.
//  Sends messages to a Supabase Edge Function that wraps an LLM.
//

import Foundation

@MainActor
final class ChatService: ObservableObject {
    static let shared = ChatService()

    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var error: String?

    private let sb = SupabaseService.shared

    struct ChatMessage: Identifiable, Equatable {
        let id: UUID
        let role: Role
        let content: String
        let timestamp: Date

        enum Role: String {
            case user, assistant, system
        }

        init(role: Role, content: String) {
            self.id = UUID()
            self.role = role
            self.content = content
            self.timestamp = Date()
        }
    }

    // MARK: - System prompt

    private let systemPrompt = """
    You are MowFlow AI, a helpful assistant for lawn care business owners. \
    You can help with scheduling, pricing estimates, client management tips, \
    route optimization, and business advice. Be concise and practical. \
    Format responses with bullet points when helpful. \
    If you don't know something specific, give general best-practice advice.
    """

    // MARK: - Send

    func send(_ text: String) async {
        let userMsg = ChatMessage(role: .user, content: text)
        messages.append(userMsg)
        isLoading = true
        error = nil

        // Build conversation history for context
        var history: [[String: String]] = [
            ["role": "system", "content": systemPrompt]
        ]
        for msg in messages.suffix(20) { // Last 20 messages for context
            history.append(["role": msg.role.rawValue, "content": msg.content])
        }

        let body: [String: Any] = ["messages": history]
        do {
            let data = try await sb.requestFunction("ai-chat", body: body)
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let reply = json?["reply"] as? String ?? "Sorry, I couldn't process that."
            let assistantMsg = ChatMessage(role: .assistant, content: reply)
            messages.append(assistantMsg)
        } catch {
            self.error = error.localizedDescription
            let errorMsg = ChatMessage(role: .assistant, content: "⚠️ Connection error. Please try again.")
            messages.append(errorMsg)
        }
        isLoading = false
    }

    func clearChat() {
        messages.removeAll()
        error = nil
    }
}
