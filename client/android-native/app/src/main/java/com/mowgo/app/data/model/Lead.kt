package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class LeadStatus(val value: String) {
    NEW("new"), CONTACTED("contacted"), QUOTED("quoted"), WON("won"), LOST("lost");

    val displayName: String get() = value.replaceFirstChar { it.uppercase() }

    companion object {
        fun from(value: String): LeadStatus = entries.firstOrNull { it.value == value } ?: NEW
    }
}

@Serializable
data class Lead(
    @SerialName("id") val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("name") val name: String = "",
    @SerialName("phone") val phone: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("source") val source: String = "other",
    @SerialName("notes") val notes: String? = null,
    @SerialName("status") val status: String = "new",
    @SerialName("client_id") val clientId: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class LeadPatch(
    @SerialName("name") val name: String? = null,
    @SerialName("phone") val phone: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("source") val source: String? = null,
    @SerialName("notes") val notes: String? = null,
    @SerialName("status") val status: String? = null,
    @SerialName("client_id") val clientId: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)
