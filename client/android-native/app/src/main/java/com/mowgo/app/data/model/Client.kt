package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Client model matching the Supabase `clients` table.
 */
@Serializable
data class Client(
    @SerialName("id")
    val id: String = "",

    @SerialName("user_id")
    val userId: String = "",

    @SerialName("name")
    val name: String = "",

    @SerialName("address")
    val address: String? = null,

    @SerialName("phone")
    val phone: String? = null,

    @SerialName("rate")
    val rate: Double = 0.0,
)
