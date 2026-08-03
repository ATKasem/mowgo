package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val id: String = "",
    @SerialName("business_name") val businessName: String = "",
    val phone: String? = null,
    val tier: String? = null,
    val role: String? = null,
    @SerialName("business_id") val businessId: String? = null,
)
