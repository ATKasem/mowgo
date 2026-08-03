package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Estimate(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("client_id") val clientId: String = "",
    val amount: Double = 0.0,
    val status: String = STATUS_DRAFT,
    val note: String? = null,
    @SerialName("sent_at") val sentAt: String? = null,
    @SerialName("approved_at") val approvedAt: String? = null,
    @SerialName("declined_at") val declinedAt: String? = null,
    @SerialName("job_id") val jobId: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("clients") val client: ClientNameRef? = null,
) {
    val clientName: String? get() = client?.name
    companion object {
        const val STATUS_DRAFT = "draft"
        const val STATUS_SENT = "sent"
        const val STATUS_APPROVED = "approved"
        const val STATUS_DECLINED = "declined"
    }
}

@Serializable
data class ClientNameRef(val name: String? = null)
