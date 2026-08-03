package com.mowgo.app.data.auth

import com.mowgo.app.data.SupabaseClientProvider
import io.github.jan.supabase.gotrue.providers.builtin.Email
import kotlinx.coroutines.flow.StateFlow

/**
 * Repository encapsulating Supabase Auth operations.
 * Provides sign-in, sign-up, sign-out, password reset, and session state.
 */
class AuthRepository {

    private val auth = SupabaseClientProvider.auth

    /** Observe whether a user is currently signed in. */
    val sessionState: StateFlow<io.github.jan.supabase.gotrue.status.AuthStatus>
        get() = auth.sessionManager.status

    /** Current session (null if not authenticated). */
    val currentSession: io.github.jan.supabase.gotrue.Session?
        get() = auth.currentSessionOrNull()

    /**
     * Sign in with email + password.
     * Throws on failure (wrong credentials, network, etc).
     */
    suspend fun signIn(email: String, password: String) {
        auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    /**
     * Create a new account with email + password.
     * Throws on failure.
     */
    suspend fun signUp(email: String, password: String) {
        auth.signUpWith(Email) {
            this.email = email
            this.password = password
        }
    }

    /**
     * Send password-reset email.
     * Throws on failure.
     */
    suspend fun resetPassword(email: String) {
        auth.resetPasswordForEmail(email)
    }

    /**
     * Sign out — clears session from memory and EncryptedSharedPreferences.
     */
    suspend fun signOut() {
        auth.signOut()
    }
}
