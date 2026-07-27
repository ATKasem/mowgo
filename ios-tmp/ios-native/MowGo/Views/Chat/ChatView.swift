//
//  ChatView.swift
//  MowGo
//
//  AI Autopilot — conversational assistant for lawn care.
//

import SwiftUI

struct ChatView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var chat = ChatService.shared
    @State private var inputText = ""
    @FocusState private var isInputFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "111827").ignoresSafeArea()

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
                .foregroundColor(Color(hex: "16a34a"))
            Text("MowGo AI")
                .font(.title2.weight(.bold))
                .foregroundColor(.white)
            Text("Ask me anything about your lawn care business —\nscheduling, pricing, routing, and more.")
                .font(.subheadline)
                .foregroundColor(Color(hex: "9ca3af"))
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
                        .foregroundColor(Color(hex: "16a34a"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color(hex: "1f2937"))
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
            Divider().background(Color(hex: "374151"))
            HStack(spacing: 12) {
                TextField("Ask anything...", text: $inputText, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(10)
                    .background(Color(hex: "1f2937"))
                    .cornerRadius(20)
                    .foregroundColor(.white)
                    .tint(Color(hex: "16a34a"))
                    .focused($isInputFocused)
                    .onSubmit { sendMessage() }

                Button {
                    sendMessage()
                } label: {
                    Image(systemName: inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "arrow.up.circle" : "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color(hex: "4b5563") : Color(hex: "16a34a"))
                }
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || chat.isLoading)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Color(hex: "1f2937"))
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
    let message: ChatService.ChatMessage

    var isUser: Bool { message.role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 48) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.subheadline)
                    .foregroundColor(.white)
                    .padding(12)
                    .background(isUser ? Color(hex: "16a34a") : Color(hex: "1f2937"))
                    .cornerRadius(16)

                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(Color(hex: "6b7280"))
                    .padding(.horizontal, 4)
            }

            if !isUser { Spacer(minLength: 48) }
        }
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @State private var animate = false

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Color(hex: "6b7280"))
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
            .background(Color(hex: "1f2937"))
            .cornerRadius(16)
            Spacer()
        }
        .onAppear { animate = true }
    }
}
