package com.mowgo.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import com.mowgo.app.data.model.RainDelayEntry
import kotlinx.coroutines.flow.first
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class RainDelayHistoryStore(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }
    private val key = SettingsRepository(context).rainDelayHistoryKey

    suspend fun load(): List<RainDelayEntry> {
        val encoded = context.dataStore.data.first()[key] ?: return emptyList()
        return try { json.decodeFromString<List<RainDelayEntry>>(encoded).take(50) }
        catch (_: Exception) { emptyList() }
    }

    suspend fun add(entry: RainDelayEntry): List<RainDelayEntry> {
        val history = (listOf(entry) + load()).take(50)
        save(history)
        return history
    }

    suspend fun replace(createdAt: String, entry: RainDelayEntry?): List<RainDelayEntry> {
        val history = load().filter { it.createdAt != createdAt }.let {
            if (entry == null) it else listOf(entry) + it
        }.take(50)
        save(history)
        return history
    }

    private suspend fun save(history: List<RainDelayEntry>) {
        context.dataStore.edit { it[key] = json.encodeToString(history) }
    }
}
