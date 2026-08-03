package com.mowgo.app.data

import com.mowgo.app.data.auth.AuthRepository
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

object WebhookService {
    private val client = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .build()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val jsonMediaType = "application/json".toMediaType()

    fun fire(event: String, payload: Map<String, String>) {
        if (!SupabaseClientProvider.isConfigured) return
        scope.launch {
            try {
                val token = AuthRepository().currentSession?.accessToken
                if (token != null) {
                    val body = JSONObject().put("event", event).put("payload", JSONObject(payload)).toString()
                    val request = Request.Builder()
                        .url("https://mowgo.pages.dev/api/webhook-dispatch")
                        .header("Authorization", "Bearer $token")
                        .header("Content-Type", "application/json")
                        .post(body.toRequestBody(jsonMediaType))
                        .build()
                    client.newCall(request).execute().use { response ->
                        if (!response.isSuccessful) println("[WebhookService] $event returned HTTP ${response.code}")
                    }
                }
            } catch (error: Exception) {
                println("[WebhookService] Failed to fire $event: ${error.message}")
            }
        }
    }
}
