//
//  ResetPasswordView.swift
//  MowGo
//
//  Forgot password flow — sends a reset link to the user's email.
//

import SwiftUI

struct ResetPasswordView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) var dismiss
    @Environment(\.colorScheme) private var colorScheme

    @State private var email = ""
    @FocusState private var isFocused: Bool

    private var theme: MowGoTheme { MowGoTheme(colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                VStack(spacing: 20) {
                    Spacer()

                    Image(systemName: "envelope.fill")
                        .font(.system(size: 48))
                        .foregroundColor(MowGoTheme.deepGreen)

                    Text("Reset Password")
                        .font(.title2.weight(.bold))
                        .foregroundColor(theme.textPrimary)

                    Text("Enter your email and we'll send you a reset link.")
                        .font(.subheadline)
                        .foregroundColor(theme.textMuted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)

                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .textContentType(.emailAddress)
                        .focused($isFocused)
                        .padding()
                        .background(theme.surface)
                        .cornerRadius(12)
                        .foregroundColor(theme.textPrimary)

                    // Success message
                    if let msg = auth.error, msg.contains("Check your email") {
                        Text(msg)
                            .font(.caption)
                            .foregroundColor(MowGoTheme.deepGreen)
                            .multilineTextAlignment(.center)
                    } else if let err = auth.error {
                        Text(err)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }

                    Button {
                        Task { await auth.resetPassword(email: email) }
                    } label: {
                        HStack {
                            if auth.isLoading {
                                ProgressView().tint(MowGoTheme.onAccent)
                            }
                            Text("Send Reset Link")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(MowGoTheme.deepGreen)
                        .foregroundColor(MowGoTheme.onAccent)
                        .cornerRadius(12)
                    }
                    .disabled(auth.isLoading || email.isEmpty)

                    Spacer()
                }
                .padding(.horizontal, 24)
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .onAppear { isFocused = true }
        }
    }
}
