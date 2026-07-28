//
//  ChatOverlay.swift
//  MowGo
//
//  Sheet overlay version of ChatView — presented from FloatingAIButton.
//  Accepts page context to pre-fill a system message about the user's current screen.
//

import SwiftUI

struct ChatOverlay: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var chat = ChatService.shared
    @State private var inputText = ""
    @FocusState private var isInputFocused: Bool
    @State private var hasInjectedContext = false

    let pageContext: String

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    if chat.messages.isEmpty {
                        emptyState
                    } else {
                        messageList
                    }
                    inputBar
                }
            }
            .navigationTitle("AI Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(theme.textMuted)
                    }
                    .accessibilityLabel("Close chat")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Clear Chat", systemImage: "trash") {
                            withAnimation { chat.clearChat() }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Chat options")
                }
            }
        }
        .onAppear {
            guard !pageContext.isEmpty else { return }
            // Remove any previous context message, then inject the current one
            chat.messages.removeAll { $0.role == .system }
            let contextMsg = ChatService.ChatMessage(
                role: .system,
                content: "Current screen: \(pageContext). Use this context to provide relevant suggestions."
            )
            chat.messages.insert(contextMsg, at: 0)
        }
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(chat.messages) { msg in
                        MessageBubble(message: msg)
                            .id(msg.id)
                    }
                    if chat.isLoading {
                        TypingIndicator()
                            .id("typing")
                    }
                }
                .padding(16)
            }
            .onChange(of: chat.messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.2)) {
                    if let last = chat.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    } else {
                        proxy.scrollTo("typing", anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "brain.head.profile.fill")
                .font(.system(size: 48))
                .foregroundColor(MowGoTheme.deepGreen)
            Text("MowGo AI")
                .font(.title2.weight(.bold))
                .foregroundColor(theme.textPrimary)
            Text("Ask me anything about your lawn care business —\nscheduling, pricing, routing, and more.")
                .font(.subheadline)
                .foregroundColor(theme.textMuted)
                .multilineTextAlignment(.center)
            suggestedPrompts
            Spacer()
        }
        .padding()
    }

    private var suggestedPrompts: some View {
        VStack(spacing: 8) {
            ForEach(prompts, id: \.self) { prompt in
                Button {
                    inputText = prompt
                    sendMessage()
                } label: {
                    Text(prompt)
                        .font(.subheadline)
                        .foregroundColor(MowGoTheme.deepGreen)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(theme.surface)
                        .cornerRadius(20)
                }
            }
        }
        .padding(.top, 8)
    }

    private let prompts = [
        "What should I charge for a half-acre lot?",
        "How do I optimize my route for 8 stops?",
        "Tips for upselling spring cleanup?"
    ]

    // MARK: - Input Bar

    private var inputBar: some View {
        VStack(spacing: 0) {
            Divider().background(theme.surfaceElevated)
            HStack(spacing: 12) {
                TextField("Ask anything...", text: $inputText, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(10)
                    .background(theme.surface)
                    .cornerRadius(20)
                    .foregroundColor(theme.textPrimary)
                    .tint(MowGoTheme.deepGreen)
                    .focused($isInputFocused)
                    .onSubmit { sendMessage() }

                Button {
                    sendMessage()
                } label: {
                    Image(systemName: inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "arrow.up.circle" : "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? theme.textInverse : MowGoTheme.deepGreen)
                }
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || chat.isLoading)
                .accessibilityLabel("Send message")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(theme.surface)
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        inputText = ""
        isInputFocused = false
        Task { await chat.send(text) }
    }
}
