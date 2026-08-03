package com.mowgo.app.data

import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.security.SecureRandom
import java.util.UUID

@Serializable
data class WebhookConfig(
    @SerialName("id") val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("url") val url: String = "",
    @SerialName("label") val label: String? = null,
    @SerialName("events") val events: List<String> = emptyList(),
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("secret") val secret: String = "",
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
private data class WebhookConfigPatch(
    @SerialName("url") val url: String,
    @SerialName("label") val label: String?,
    @SerialName("events") val events: List<String>,
    @SerialName("is_active") val isActive: Boolean,
)

class WebhookRepository {
    @Volatile private var demoConfigs: List<WebhookConfig> = emptyList()

    suspend fun loadConfigs(): List<WebhookConfig> {
        if (!SupabaseClientProvider.isConfigured) return demoConfigs
        val uid = currentUserId() ?: return emptyList()
        return SupabaseClientProvider.client.from("webhook_configs").select {
            filter { eq("user_id", uid) }
            order("created_at", Order.ASCENDING)
        }.decodeList<WebhookConfig>()
    }

    suspend fun saveConfig(config: WebhookConfig): WebhookConfig {
        if (!SupabaseClientProvider.isConfigured) {
            val saved = if (config.id.isBlank()) config.copy(id = UUID.randomUUID().toString(), secret = config.secret.ifBlank(::generateSecret)) else config
            demoConfigs = demoConfigs.filterNot { it.id == saved.id } + saved
            return saved
        }
        val uid = currentUserId() ?: throw IllegalStateException("Not authenticated")
        if (config.id.isBlank()) {
            val inserted = config.copy(id = UUID.randomUUID().toString(), userId = uid, secret = config.secret.ifBlank(::generateSecret))
            SupabaseClientProvider.client.from("webhook_configs").insert(inserted)
            return inserted
        }
        SupabaseClientProvider.client.from("webhook_configs").update(
            WebhookConfigPatch(config.url, config.label, config.events, config.isActive)
        ) { filter { eq("id", config.id) } }
        return config
    }

    suspend fun deleteConfig(id: String) {
        if (!SupabaseClientProvider.isConfigured) { demoConfigs = demoConfigs.filterNot { it.id == id }; return }
        SupabaseClientProvider.client.from("webhook_configs").delete { filter { eq("id", id) } }
    }

    suspend fun regenerateSecret(id: String): String {
        val secret = generateSecret()
        if (!SupabaseClientProvider.isConfigured) {
            demoConfigs = demoConfigs.map { if (it.id == id) it.copy(secret = secret) else it }
        } else {
            SupabaseClientProvider.client.from("webhook_configs").update(mapOf("secret" to secret)) {
                filter { eq("id", id) }
            }
        }
        return secret
    }

    private fun currentUserId(): String? = SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id

    companion object {
        fun generateSecret(): String {
            val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
            return bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
        }
    }
}
