//
//  ChatView.swift
//  MowGo
//
//  AI Autopilot — conversational assistant for lawn care.
//

import SwiftUI

struct ChatView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var chat = ChatService.shared
    @State private var inputText = ""
    @FocusState private var isInputFocused: Bool

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

// MARK: - Message Bubble

struct MessageBubble: View {
    @Environment(\.colorScheme) private var colorScheme
    let message: ChatService.ChatMessage

    var isUser: Bool { message.role == .user }
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 48) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.subheadline)
                    .foregroundColor(isUser ? MowGoTheme.onAccent : theme.textPrimary)
                    .padding(12)
                    .background(isUser ? MowGoTheme.deepGreen : theme.surface)
                    .cornerRadius(16)

                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(theme.textInverse)
                    .padding(.horizontal, 4)
            }

            if !isUser { Spacer(minLength: 48) }
        }
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var animate = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(theme.textInverse)
                        .frame(width: 6, height: 6)
                        .offset(y: animate ? -4 : 4)
                        .animation(
                            .easeInOut(duration: 0.4)
                            .repeatForever(autoreverses: true)
                            .delay(Double(i) * 0.15),
                            value: animate
                        )
                }
            }
            .padding(12)
            .background(theme.surface)
            .cornerRadius(16)
            Spacer()
        }
        .onAppear { animate = true }
    }
}
