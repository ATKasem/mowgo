package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
/**
 * Invoice model matching the Supabase `invoices` table.
 * Mirrors iOS Invoice struct fields.
 */
@Serializable
data class Invoice(
    @SerialName("id")
    val id: String = "",

    @SerialName("user_id")
    val userId: String = "",

    @SerialName("client_id")
    val clientId: String? = null,

    @SerialName("job_id")
    val jobId: String? = null,

    @SerialName("amount")
    val amount: Double = 0.0,

    @SerialName("status")
    val status: String = STATUS_UNPAID,

    @SerialName("paid_at")
    val paidAt: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,
) {
    companion object {
        const val STATUS_UNPAID = "unpaid"
        const val STATUS_PAID = "paid"
    }
}
