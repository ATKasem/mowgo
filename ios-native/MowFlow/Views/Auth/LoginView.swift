//
//  LoginView.swift
//  MowFlow
//
//  Auth screen with email/password sign-in and sign-up.
//  Supports demo mode when Supabase is not configured.
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }

    var body: some View {
        ZStack {
            Color(hex: "111827").ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    // Logo
                    Image(systemName: "leaf.fill")
                        .font(.system(size: 56))
                        .foregroundColor(Color(hex: "16a34a"))
                        .accessibilityHidden(true)

                    Text("MowFlow")
                        .font(.largeTitle.weight(.bold))
                        .dynamicTypeSize(...DynamicTypeSize.accessibility3)
                        .foregroundColor(.white)

                    Text("Lawn Care Scheduling")
                        .font(.subheadline)
                        .foregroundColor(Color(hex: "9ca3af"))

                    Spacer().frame(height: 16)

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
                            .background(Color(hex: "1f2937"))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                            .dynamicTypeSize(...DynamicTypeSize.accessibility2)

                        SecureField("Password", text: $password)
                            .textContentType(isSignUp ? .newPassword : .password)
                            .submitLabel(.go)
                            .focused($focusedField, equals: .password)
                            .onSubmit { submit() }
                            .padding()
                            .background(Color(hex: "1f2937"))
                            .cornerRadius(12)
                            .foregroundColor(.white)
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
                                ProgressView().tint(.white)
                            }
                            Text(isSignUp ? "Create Account" : "Sign In")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(hex: "16a34a"))
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(auth.isLoading || email.isEmpty || password.isEmpty)
                    .accessibilityLabel(isSignUp ? "Create Account" : "Sign In")

                    // Toggle
                    Button(isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up") {
                        withAnimation { isSignUp.toggle() }
                        auth.error = nil
                    }
                    .font(.footnote)
                    .foregroundColor(Color(hex: "6b7280"))

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
                                .foregroundColor(Color(hex: "16a34a"))
                        }
                        .padding(.top, 8)
                        .accessibilityHint("Enter demo mode without real account")
                    }
                }
                .padding(.horizontal, 24)
            }
            .scrollDismissesKeyboard(.interactively)
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
