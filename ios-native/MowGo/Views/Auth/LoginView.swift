//
//  LoginView.swift
//  MowGo
//
//  Auth screen with email/password sign-in and sign-up.
//  Supports demo mode when Supabase is not configured.
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    @State private var showResetPassword = false

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(minHeight: 40)

                    // Logo
                    Image(systemName: "leaf.fill")
                        .font(.system(size: 56))
                        .foregroundColor(MowGoTheme.deepGreen)
                        .accessibilityHidden(true)

                    Text("MowGo")
                        .font(.largeTitle.weight(.bold))
                        .dynamicTypeSize(...DynamicTypeSize.accessibility3)
                        .foregroundColor(theme.textPrimary)

                    Text("Lawn Care Scheduling")
                        .font(.subheadline)
                        .foregroundColor(theme.textMuted)

                    // Fields
                    VStack(spacing: 12) {
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .textContentType(.emailAddress)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .email)
                            .onSubmit { focusedField = .password }
                            .padding()
                            .background(theme.surface)
                            .cornerRadius(12)
                            .foregroundColor(theme.textPrimary)
                            .dynamicTypeSize(...DynamicTypeSize.accessibility2)

                        SecureField("Password", text: $password)
                            .textContentType(isSignUp ? .newPassword : .password)
                            .submitLabel(.go)
                            .focused($focusedField, equals: .password)
                            .onSubmit { submit() }
                            .padding()
                            .background(theme.surface)
                            .cornerRadius(12)
                            .foregroundColor(theme.textPrimary)
                            .dynamicTypeSize(...DynamicTypeSize.accessibility2)
                    }

                    // Error
                    if let err = auth.error {
                        Text(err)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                            .accessibilityLabel(err)
                    }

                    // Button
                    Button(action: submit) {
                        HStack {
                            if auth.isLoading {
                                ProgressView().tint(MowGoTheme.onAccent)
                            }
                            Text(isSignUp ? "Create Account" : "Sign In")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(MowGoTheme.deepGreen)
                        .foregroundColor(MowGoTheme.onAccent)
                        .cornerRadius(12)
                    }
                    .disabled(auth.isLoading || email.isEmpty || password.isEmpty)
                    .accessibilityLabel(isSignUp ? "Create Account" : "Sign In")

                    // Forgot Password (sign in only)
                    if !isSignUp {
                        Button("Forgot Password?") {
                            showResetPassword = true
                        }
                        .font(.footnote)
                        .foregroundColor(theme.textMuted)
                    }

                    // Toggle
                    Button(isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up") {
                        withAnimation { isSignUp.toggle() }
                        auth.error = nil
                    }
                    .font(.footnote)
                    .foregroundColor(theme.textInverse)

                    // Demo
                    if auth.isDemoMode {
                        Button {
                            withAnimation {
                                auth.isAuthenticated = true
                            }
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        } label: {
                            Text("Continue with Demo")
                                .font(.footnote)
                                .foregroundColor(MowGoTheme.deepGreen)
                        }
                        .padding(.top, 8)
                        .accessibilityHint("Enter demo mode without real account")
                    }

                    Spacer().frame(minHeight: 40)
                }
                .padding(.horizontal, 24)
                .frame(minHeight: UIScreen.main.bounds.height * 0.85)
            }
            .scrollDismissesKeyboard(.interactively)
            .sheet(isPresented: $showResetPassword) {
                ResetPasswordView()
            }
        }
    }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty else {
            auth.error = "Fill in both fields."
            return
        }
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        focusedField = nil
        Task {
            if isSignUp {
                await auth.signUp(email: email, password: password)
            } else {
                await auth.signIn(email: email, password: password)
            }
        }
    }
}
