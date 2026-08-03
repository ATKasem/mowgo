package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
/**
 * Client model matching the Supabase `clients` table.
 * Mirrors iOS Client struct fields.
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

    @SerialName("email")
    val email: String? = null,

    @SerialName("rate")
    val rate: Double = 0.0,

    @SerialName("key_code")
    val keyCode: String? = null,

    @SerialName("pet_instructions")
    val petInstructions: String? = null,

    @SerialName("alarm_code")
    val alarmCode: String? = null,

    @SerialName("cleaning_notes")
    val cleaningNotes: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,
)
