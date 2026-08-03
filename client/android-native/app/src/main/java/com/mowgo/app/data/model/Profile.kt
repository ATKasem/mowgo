package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Profile(
    @SerialName("business_name") val businessName: String = "",
    val phone: String = "",
    val email: String = "",
    val tier: String = "free",
)
