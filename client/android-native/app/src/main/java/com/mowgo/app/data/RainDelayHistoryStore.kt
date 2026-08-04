package com.mowgo.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.mowgo.app.data.model.RainDelayEntry
import kotlinx.coroutines.flow.first
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class RainDelayHistoryStore(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun load(): List<RainDelayEntry> {
        val key = historyKey()
        val encoded = context.dataStore.data.first()[key] ?: return emptyList()
        return decode(encoded)
    }

    suspend fun add(entry: RainDelayEntry): List<RainDelayEntry> {
        val key = historyKey()
        var history = emptyList<RainDelayEntry>()
        context.dataStore.edit { prefs ->
            history = (listOf(entry) + decode(prefs[key])).take(50)
            prefs[key] = json.encodeToString(history)
        }
        return history
    }

    suspend fun replace(createdAt: String, entry: RainDelayEntry?): List<RainDelayEntry> {
        val key = historyKey()
        var history = emptyList<RainDelayEntry>()
        context.dataStore.edit { prefs ->
            history = decode(prefs[key]).filter { it.createdAt != createdAt }.let {
                if (entry == null) it else listOf(entry) + it
            }.take(50)
            prefs[key] = json.encodeToString(history)
        }
        return history
    }

    private suspend fun save(history: List<RainDelayEntry>) {
        val key = historyKey()
        context.dataStore.edit { it[key] = json.encodeToString(history.take(50)) }
    }

    private fun historyKey() = stringPreferencesKey(
        if (!SupabaseClientProvider.isConfigured) {
            "rain_delay_history_demo"
        } else {
            val userId = try { SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id }
            catch (_: Exception) { null }
            "rain_delay_history_${userId ?: "signed_out"}"
        }
    )

    private fun decode(encoded: String?): List<RainDelayEntry> = try {
        if (encoded == null) emptyList() else json.decodeFromString<List<RainDelayEntry>>(encoded).take(50)
    } catch (_: Exception) { emptyList() }
}
