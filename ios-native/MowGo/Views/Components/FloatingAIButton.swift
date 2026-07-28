//
//  FloatingAIButton.swift
//  MowGo
//
//  Floating AI button — appears on all main tabs, opens AI chat overlay.
//

import SwiftUI

struct FloatingAIButton: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var isPresented: Bool

    var body: some View {
        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                isPresented = true
            }
        } label: {
            ZStack {
                Circle()
                    .fill(MowGoTheme.deepGreen)
                    .frame(width: 56, height: 56)
                    .shadow(color: .black.opacity(0.25), radius: 8, x: 0, y: 4)

                Image(systemName: "brain.head.profile.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(.white)
            }
        }
        .accessibilityLabel("Open AI Assistant")
    }
}

#Preview {
    FloatingAIButton(isPresented: .constant(false))
}
