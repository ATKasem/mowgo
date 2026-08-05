package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Profile(
    @SerialName("business_name") val businessName: String = "",
    val phone: String = "",
    val email: String = "",
    @SerialName("venmo_handle") val venmoHandle: String = "",
    @SerialName("cashapp_handle") val cashappHandle: String = "",
    @SerialName("zelle_handle") val zelleHandle: String = "",
    val tier: String = "free",
    @SerialName("role") val role: String? = null,
    @SerialName("business_id") val businessId: String? = null,
)
