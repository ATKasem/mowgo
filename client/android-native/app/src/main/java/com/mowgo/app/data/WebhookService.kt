package com.mowgo.app.data

import com.mowgo.app.data.auth.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

object WebhookService {
    private val client = OkHttpClient()
    private val jsonMediaType = "application/json".toMediaType()

    suspend fun fire(event: String, payload: Map<String, String>) {
        if (!SupabaseClientProvider.isConfigured) return
        try {
            val token = AuthRepository().currentSession?.accessToken ?: return
            val body = JSONObject().put("event", event).put("payload", JSONObject(payload)).toString()
            val request = Request.Builder()
                .url("https://mowgo.pages.dev/api/webhook-dispatch")
                .header("Authorization", "Bearer $token")
                .header("Content-Type", "application/json")
                .post(body.toRequestBody(jsonMediaType))
                .build()
            withContext(Dispatchers.IO) {
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) println("[WebhookService] $event returned HTTP ${response.code}")
                }
            }
        } catch (error: Exception) {
            println("[WebhookService] Failed to fire $event: ${error.message}")
        }
    }
}
