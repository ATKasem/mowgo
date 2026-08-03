package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Job model matching the Supabase `jobs` table.
 * Uses @SerialName for snake_case column mapping.
 */
@Serializable
data class Job(
    @SerialName("id")
    val id: String = "",

    @SerialName("user_id")
    val userId: String = "",

    @SerialName("client_id")
    val clientId: String = "",

    @SerialName("title")
    val title: String = "",

    @SerialName("scheduled_date")
    val scheduledDate: String = "",

    @SerialName("scheduled_time")
    val scheduledTime: String? = null,

    @SerialName("status")
    val status: String = "scheduled",

    @SerialName("assigned_to")
    val assignedTo: String? = null,

    @SerialName("route_order")
    val routeOrder: Int? = null,

    @SerialName("duration_minutes")
    val durationMinutes: Int? = null,

    @SerialName("notes")
    val notes: String? = null,

    @SerialName("recurrence_rule")
    val recurrenceRule: String? = null,
) {
    companion object {
        const val STATUS_SCHEDULED = "scheduled"
        const val STATUS_IN_PROGRESS = "in_progress"
        const val STATUS_DONE = "done"
        const val STATUS_SKIPPED = "skipped"
    }
}
