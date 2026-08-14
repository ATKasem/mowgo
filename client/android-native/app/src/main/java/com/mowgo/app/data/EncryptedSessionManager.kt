package com.mowgo.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class EncryptedSessionManager(context: Context) : SessionManager {
    private val json = Json { ignoreUnknownKeys = true }
    private val preferences: SharedPreferences = try {
        EncryptedSharedPreferences.create(
            context,
            PREFERENCES_FILE,
            MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (_: Exception) {
        context.getSharedPreferences(PREFERENCES_FALLBACK_FILE, Context.MODE_PRIVATE)
    }

    override suspend fun saveSession(session: UserSession) {
        preferences.edit().putString(SESSION_KEY, json.encodeToString(session)).apply()
    }

    override suspend fun loadSession(): UserSession? {
        val saved = preferences.getString(SESSION_KEY, null) ?: return null
        return runCatching { json.decodeFromString<UserSession>(saved) }.getOrNull()
    }

    override suspend fun deleteSession() {
        preferences.edit().remove(SESSION_KEY).apply()
    }

    private companion object {
        const val PREFERENCES_FILE = "mowgo_encrypted_auth"
        const val PREFERENCES_FALLBACK_FILE = "mowgo_auth"
        const val SESSION_KEY = "supabase_session"
    }
}
