package com.mowgo.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class SettingsRepository(private val context: Context) {
    private val appearanceKey = stringPreferencesKey("appearance_mode")
    private val completionKey = booleanPreferencesKey("job_completion_alerts")
    private val rainKey = booleanPreferencesKey("rain_delay_alerts")

    val appearanceMode: Flow<String> = context.dataStore.data.map { it[appearanceKey] ?: "system" }
    val jobCompletionAlerts: Flow<Boolean> = context.dataStore.data.map { it[completionKey] ?: true }
    val rainDelayAlerts: Flow<Boolean> = context.dataStore.data.map { it[rainKey] ?: true }

    suspend fun setAppearanceMode(value: String) { context.dataStore.edit { it[appearanceKey] = value } }
    suspend fun setJobCompletionAlerts(value: Boolean) { context.dataStore.edit { it[completionKey] = value } }
    suspend fun setRainDelayAlerts(value: Boolean) { context.dataStore.edit { it[rainKey] = value } }

    /** Clear account-specific notification prefs so a signed-out user's settings don't leak to the next account. */
    suspend fun clearNotificationPrefs() {
        context.dataStore.edit {
            it.remove(completionKey)
            it.remove(rainKey)
        }
    }
}
