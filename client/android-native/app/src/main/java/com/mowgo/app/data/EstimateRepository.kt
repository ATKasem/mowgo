package com.mowgo.app.data

import com.mowgo.app.data.model.Estimate
import com.mowgo.app.data.model.Job
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class EstimateRepository {
    suspend fun loadEstimates(): List<Estimate> {
        if (!SupabaseClientProvider.isConfigured) return demoEstimates()
        if (ProfileRepository().loadProfile()?.role == "crew") return emptyList()
        val userId = currentUserId() ?: return emptyList()
        return SupabaseClientProvider.client.from("estimates").select {
            filter { eq("user_id", userId) }
            order("created_at", Order.DESCENDING)
        }.decodeList<Estimate>()
    }

    suspend fun createEstimate(estimate: Estimate, send: Boolean): Estimate {
        val now = Instant.now().toString()
        val row = estimate.copy(
            id = estimate.id.ifBlank { UUID.randomUUID().toString() },
            userId = estimate.userId.ifBlank { currentUserId() ?: "demo-owner" },
            status = if (send) Estimate.STATUS_SENT else Estimate.STATUS_DRAFT,
            sentAt = if (send) now else null,
            createdAt = estimate.createdAt ?: now,
        )
        if (!SupabaseClientProvider.isConfigured) {
            demoList = listOf(row) + (demoList ?: emptyList())
            return row
        }
        return SupabaseClientProvider.client.from("estimates").insert(row) { select() }.decodeList<Estimate>().firstOrNull()
            ?: throw IllegalStateException("Estimate was not returned")
    }

    suspend fun updateEstimateStatus(id: String, status: String): Estimate? {
        val now = Instant.now().toString()
        if (!SupabaseClientProvider.isConfigured) {
            demoList = (demoList ?: emptyList()).map { if (it.id == id) it.copy(status = status, sentAt = if (status == Estimate.STATUS_SENT) now else it.sentAt, approvedAt = if (status == Estimate.STATUS_APPROVED) now else it.approvedAt, declinedAt = if (status == Estimate.STATUS_DECLINED) now else it.declinedAt) else it }
            return (demoList ?: emptyList()).firstOrNull { it.id == id }
        }
        return when (status) {
            Estimate.STATUS_SENT -> SupabaseClientProvider.client.from("estimates").update(EstimateSentPatch(status, now)) { filter { eq("id", id) }; select() }.decodeList<Estimate>().firstOrNull()
            Estimate.STATUS_APPROVED -> SupabaseClientProvider.client.from("estimates").update(EstimateApprovedPatch(status, now)) { filter { eq("id", id) }; select() }.decodeList<Estimate>().firstOrNull()
            Estimate.STATUS_DECLINED -> SupabaseClientProvider.client.from("estimates").update(EstimateDeclinedPatch(status, now)) { filter { eq("id", id) }; select() }.decodeList<Estimate>().firstOrNull()
            else -> SupabaseClientProvider.client.from("estimates").update(EstimateOnlyStatusPatch(status)) { filter { eq("id", id) }; select() }.decodeList<Estimate>().firstOrNull()
        }
    }

    suspend fun convertEstimateToJob(estimate: Estimate): Estimate? {
        val jobId = UUID.randomUUID().toString()
        JobRepository().createJob(Job(id = jobId, clientId = estimate.clientId, title = estimate.note ?: "Lawn care", scheduledDate = LocalDate.now().toString(), status = Job.STATUS_SCHEDULED))
        if (!SupabaseClientProvider.isConfigured) {
            demoList = (demoList ?: emptyList()).map { if (it.id == estimate.id) it.copy(jobId = jobId) else it }
            return (demoList ?: emptyList()).firstOrNull { it.id == estimate.id }
        }
        return SupabaseClientProvider.client.from("estimates").update(EstimateJobPatch(jobId)) { filter { eq("id", estimate.id) }; select() }.decodeList<Estimate>().firstOrNull()
    }

    private suspend fun currentUserId(): String? = try { SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id } catch (_: Exception) { null }

    private fun demoEstimates(): List<Estimate> {
        if (demoList == null) demoList = listOf(
            Estimate(id = "demo-est-1", userId = "demo-owner", clientId = "demo-client-1", amount = 45.0, status = Estimate.STATUS_SENT, note = "Weekly lawn care", sentAt = Instant.now().minusSeconds(5 * 86400).toString(), createdAt = Instant.now().minusSeconds(5 * 86400).toString()),
            Estimate(id = "demo-est-2", userId = "demo-owner", clientId = "demo-client-2", amount = 65.0, status = Estimate.STATUS_APPROVED, approvedAt = Instant.now().toString(), createdAt = Instant.now().minusSeconds(86400).toString()),
        )
        return demoList ?: emptyList()
    }

    companion object { @Volatile private var demoList: List<Estimate>? = null }
}

@Serializable private data class EstimateOnlyStatusPatch(val status: String)
@Serializable private data class EstimateSentPatch(val status: String, @SerialName("sent_at") val sentAt: String)
@Serializable private data class EstimateApprovedPatch(val status: String, @SerialName("approved_at") val approvedAt: String)
@Serializable private data class EstimateDeclinedPatch(val status: String, @SerialName("declined_at") val declinedAt: String)
@Serializable private data class EstimateJobPatch(@SerialName("job_id") val jobId: String?)
