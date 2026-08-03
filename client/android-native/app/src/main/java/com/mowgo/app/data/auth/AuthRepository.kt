package com.mowgo.app.data.auth

import com.mowgo.app.data.SupabaseClientProvider
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.coroutines.flow.StateFlow

/**
 * Repository encapsulating Supabase Auth operations.
 * Provides sign-in, sign-up, sign-out, password reset, and session state.
 */
class AuthRepository {

    private val auth = SupabaseClientProvider.auth

    /** Observe whether a user is currently signed in. */
    val sessionState: StateFlow<SessionStatus>
        get() = auth.sessionStatus

    /** Current session (null if not authenticated). */
    val currentSession: UserSession?
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
