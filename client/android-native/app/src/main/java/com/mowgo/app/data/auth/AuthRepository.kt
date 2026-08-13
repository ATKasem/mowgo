package com.mowgo.app.data.auth

import com.mowgo.app.data.SupabaseClientProvider
import com.mowgo.app.data.ProfileRepository
import com.mowgo.app.data.TeamRepository
import com.mowgo.app.data.local.AppDatabaseProvider
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
        // Capture user ID before clearing session
        val userId = runCatching {
            SupabaseClientProvider.client.auth.currentSessionOrNull()?.user?.id
        }.getOrNull()
        // Clear push tokens BEFORE signOut so the update runs authenticated
        if (userId != null) {
            runCatching {
                SupabaseClientProvider.client.from("profiles").update(
                    mapOf("fcm_token" to null, "device_platform" to null)
                ) { filter { eq("id", userId) } }
            }
        }
        auth.signOut()
        runCatching { ProfileRepository.resetDemoState() }
        runCatching { TeamRepository.resetDemoTeam() }
        // Wipe the offline cache + mutation queue so the next signed-in account
        // on this device can't see this account's cached jobs/clients/invoices.
        runCatching { AppDatabaseProvider.clearAll() }
    }
}
