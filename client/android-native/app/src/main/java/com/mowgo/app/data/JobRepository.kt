package com.mowgo.app.data

import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.data.model.RainDelayEntry
import com.mowgo.app.data.model.RainDelayUndoResult
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import java.time.LocalDate
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Repository for Job and Client data.
 * Uses Supabase PostgREST when configured, in-memory demo data otherwise.
 */
class JobRepository {

    private val dateFormat = DateTimeFormatter.ISO_LOCAL_DATE

    // ── Public API ───────────────────────────────────────────────────────

    /** Load all jobs for the current user, joined with client info. */
    suspend fun loadJobs(): List<JobWithClient> {
        if (!SupabaseClientProvider.isConfigured) return demoJobs()

        val client = SupabaseClientProvider.client
        val userId = getCurrentUserId() ?: return emptyList()
        val profile = ProfileRepository().loadProfile()

        val jobs = client.from("jobs")
            .select {
                filter {
                    if (profile?.role == "crew") eq("assigned_to", userId)
                    else eq("user_id", userId)
                }
                order("route_order", Order.ASCENDING)
                order("scheduled_time", Order.ASCENDING)
            }
            .decodeList<Job>()

        val clients = loadClients()
        val clientMap = clients.associateBy { it.id }

        return jobs.map { job ->
            val c = clientMap[job.clientId]
            JobWithClient(
                job = job,
                clientName = c?.name ?: "Unknown",
                clientRate = c?.rate ?: 0.0,
                clientAddress = c?.address,
            )
        }
    }

    /** Load all clients for the current user. */
    suspend fun loadClients(): List<Client> {
        if (!SupabaseClientProvider.isConfigured) return demoClients()

        val client = SupabaseClientProvider.client
        val userId = getCurrentUserId() ?: return emptyList()
        val profile = ProfileRepository().loadProfile()
        val ownerId = if (profile?.role == "crew") profile.businessId else userId
        if (ownerId == null) return emptyList()

        return client.from("clients")
            .select {
                filter { eq("user_id", ownerId) }
                order("name", Order.ASCENDING)
            }
            .decodeList<Client>()
    }

    /** Update a job's status. */
    suspend fun updateJobStatus(jobId: String, newStatus: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoJobsMutable = demoJobsMutable.map {
                if (it.job.id == jobId) it.copy(job = it.job.copy(status = newStatus)) else it
            }
            return
        }

        val job = SupabaseClientProvider.client.from("jobs").select {
            filter { eq("id", jobId) }
        }.decodeSingle<Job>()
        SupabaseClientProvider.client.from("jobs")
            .update(
                mapOf("status" to newStatus)
            ) {
                filter { eq("id", jobId) }
            }
        val payload = mapOf(
            "job_id" to job.id, "title" to job.title, "client_id" to job.clientId,
            "scheduled_date" to job.scheduledDate, "status" to newStatus,
        )
        WebhookService.fire("job.updated", payload)
        if (newStatus == Job.STATUS_DONE) WebhookService.fire("job.completed", payload)
    }

    /** Create a new job. */
    suspend fun createJob(job: Job) {
        if (!SupabaseClientProvider.isConfigured) {
            val newJob = job.copy(id = "demo-${System.currentTimeMillis()}")
            demoJobsMutable = demoJobsMutable + JobWithClient(
                job = newJob,
                clientName = demoClients().find { it.id == newJob.clientId }?.name ?: "Unknown",
                clientRate = demoClients().find { it.id == newJob.clientId }?.rate ?: 0.0,
                clientAddress = demoClients().find { it.id == newJob.clientId }?.address,
            )
            return
        }

        val userId = getCurrentUserId() ?: throw IllegalStateException("Not authenticated")
        val jobWithUser = job.copy(
            id = job.id.ifBlank { UUID.randomUUID().toString() },
            userId = userId,
        )

        SupabaseClientProvider.client.from("jobs")
            .insert(jobWithUser)
        WebhookService.fire("job.created", mapOf(
            "job_id" to jobWithUser.id, "title" to jobWithUser.title,
            "client_id" to jobWithUser.clientId, "scheduled_date" to jobWithUser.scheduledDate,
            "status" to jobWithUser.status,
        ))
    }

    /** Update an existing job. */
    suspend fun updateJob(job: Job) {
        if (!SupabaseClientProvider.isConfigured) {
            demoJobsMutable = demoJobsMutable.map {
                if (it.job.id == job.id) it.copy(job = job) else it
            }
            return
        }

        SupabaseClientProvider.client.from("jobs")
            .update(job) {
                filter { eq("id", job.id) }
            }
        WebhookService.fire("job.updated", mapOf(
            "job_id" to job.id, "title" to job.title, "client_id" to job.clientId,
            "scheduled_date" to job.scheduledDate, "status" to job.status,
        ))
    }

    /** Persist a job photo URL after the image has been uploaded. */
    suspend fun updateJobPhoto(jobId: String, photoUrl: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoJobsMutable = demoJobsMutable.map {
                if (it.job.id == jobId) it.copy(job = it.job.copy(photoUrl = photoUrl)) else it
            }
            return
        }

        SupabaseClientProvider.client.from("jobs")
            .update(mapOf("photo_url" to photoUrl)) {
                filter { eq("id", jobId) }
            }
    }

    /** Delete a job. */
    suspend fun deleteJob(jobId: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoJobsMutable = demoJobsMutable.filter { it.job.id != jobId }
            return
        }

        SupabaseClientProvider.client.from("jobs")
            .delete {
                filter { eq("id", jobId) }
            }
    }

    /** Unassign every job currently allocated to a removed crew member. */
    suspend fun unassignJobsFromMember(memberId: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoJobsMutable = demoJobsMutable.map { jobWithClient ->
                if (jobWithClient.assignedTo == memberId) {
                    jobWithClient.copy(job = jobWithClient.job.copy(assignedTo = null))
                } else {
                    jobWithClient
                }
            }
            return
        }

        val jobs = loadJobs().filter { it.assignedTo == memberId }
        for (job in jobs) {
            SupabaseClientProvider.client.from("jobs")
                .update(JobAssignedPatch(assignedTo = null)) {
                    filter { eq("id", job.id) }
                }
        }
    }

    /**
     * Move all today's scheduled jobs to the requested date (rain delay).
     * Returns the count of jobs moved.
     */
    suspend fun rainDelay(date: String, targetDate: String): RainDelayEntry? {
        require(date.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) { "Rain delay source date must use YYYY-MM-DD" }
        require(targetDate.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) { "Rain delay target date must use YYYY-MM-DD" }

        if (!SupabaseClientProvider.isConfigured) {
            val affected = demoJobsMutable.filter {
                it.scheduledDate == date && it.status == Job.STATUS_SCHEDULED
            }
            demoJobsMutable = demoJobsMutable.map { jwc ->
                if (jwc.scheduledDate == date && jwc.status == Job.STATUS_SCHEDULED) {
                    jwc.copy(job = jwc.job.copy(scheduledDate = targetDate))
                } else {
                    jwc
                }
            }
            if (affected.isEmpty()) return null
            return RainDelayEntry(date, targetDate, affected.map { it.id }, affected.size,
                Instant.now().toString(), affected.associate { it.id to it.scheduledDate })
        }

        val userId = getCurrentUserId() ?: return null

        // Fetch all jobs for today and filter client-side (avoids complex OR filter DSL)
        val allJobs = SupabaseClientProvider.client.from("jobs")
            .select {
                filter { eq("user_id", userId) }
            }
            .decodeList<Job>()

        val jobsToMove = allJobs.filter {
            it.scheduledDate == date && it.status == Job.STATUS_SCHEDULED
        }

        val moved = mutableListOf<Job>()
        try {
            for (job in jobsToMove) {
                updateJobDate(job.id, targetDate)
                moved += job
            }
        } catch (error: Exception) {
            var rollbackFailed = false
            for (job in moved) {
                try { updateJobDate(job.id, job.scheduledDate) } catch (_: Exception) { rollbackFailed = true }
            }
            if (rollbackFailed) throw RuntimeException(
                "Rain delay rollback incomplete — verify your schedule (original: ${error.message})",
                error,
            )
            throw error
        }
        if (moved.isEmpty()) return null
        val entry = RainDelayEntry(date, targetDate, moved.map { it.id }, moved.size,
            Instant.now().toString(), moved.associate { it.id to it.scheduledDate })
        WebhookService.fire("rain.delay.applied", mapOf(
            "count" to moved.size.toString(), "date" to date, "target_date" to targetDate,
        ))
        return entry
    }

    suspend fun undoRainDelay(entry: RainDelayEntry): RainDelayUndoResult {
        val current = loadJobs().associateBy { it.id }
        val restored = mutableListOf<String>()
        val skipped = mutableListOf<String>()
        try {
            for (jobId in entry.jobIds) {
                val job = current[jobId]
                val original = entry.originalDates[jobId]
                if (job == null || original == null || job.scheduledDate != entry.targetDate) {
                    skipped += jobId
                } else {
                    if (!SupabaseClientProvider.isConfigured) {
                        demoJobsMutable = demoJobsMutable.map {
                            if (it.id == jobId) it.copy(job = it.job.copy(scheduledDate = original)) else it
                        }
                    } else {
                        updateJobDate(jobId, original)
                    }
                    restored += jobId
                }
            }
        } catch (error: Exception) {
            for (jobId in restored) {
                try {
                    if (!SupabaseClientProvider.isConfigured) {
                        demoJobsMutable = demoJobsMutable.map {
                            if (it.id == jobId) it.copy(job = it.job.copy(scheduledDate = entry.targetDate)) else it
                        }
                    } else updateJobDate(jobId, entry.targetDate)
                } catch (_: Exception) { }
            }
            throw error
        }
        val remaining = if (skipped.isEmpty()) null else entry.copy(
            jobIds = skipped, jobCount = skipped.size,
            originalDates = entry.originalDates.filterKeys { it in skipped },
        )
        return RainDelayUndoResult(restored.size, skipped.size, remaining)
    }

    private suspend fun updateJobDate(jobId: String, date: String) {
        SupabaseClientProvider.client.from("jobs").update(mapOf("scheduled_date" to date)) {
            filter { eq("id", jobId) }
        }
    }

    // ── Auth helper ──────────────────────────────────────────────────────

    private suspend fun getCurrentUserId(): String? {
        return try {
            SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id
        } catch (_: Exception) {
            null
        }
    }

    // ── Demo Data ────────────────────────────────────────────────────────

    @Volatile
    private var demoJobsMutable: List<JobWithClient> = emptyList()

    private fun demoClients(): List<Client> = listOf(
        Client(
            id = "demo-client-1",
            userId = "demo-owner",
            name = "Smith Residence",
            address = "123 Main St, Edmond, OK",
            phone = "405-555-0101",
            rate = 45.0,
            keyCode = "1234",
            petInstructions = "Dog is friendly, keep gate closed",
        ),
        Client(
            id = "demo-client-2",
            userId = "demo-owner",
            name = "Johnson Home",
            address = "456 Oak Ave, OKC, OK",
            phone = "405-555-0202",
            rate = 65.0,
        ),
        Client(
            id = "demo-client-3",
            userId = "demo-owner",
            name = "Williams Estate",
            address = "789 Pine Rd, Edmond, OK",
            rate = 80.0,
            keyCode = "5678",
        ),
    )

    private fun demoJobs(): List<JobWithClient> {
        if (demoJobsMutable.isEmpty()) {
            val today = dateFormat.format(LocalDate.now())
            demoJobsMutable = listOf(
                JobWithClient(
                    job = Job(
                        id = "demo-job-1",
                        userId = "demo-owner",
                        clientId = "demo-client-1",
                        title = "Weekly Mow",
                        scheduledDate = today,
                        scheduledTime = "08:00",
                        status = Job.STATUS_DONE,
                        routeOrder = 0,
                        recurrenceRule = "weekly",
                    ),
                    clientName = "Smith Residence",
                    clientRate = 45.0,
                    clientAddress = "123 Main St, Edmond, OK",
                ),
                JobWithClient(
                    job = Job(
                        id = "demo-job-2",
                        userId = "demo-owner",
                        clientId = "demo-client-2",
                        title = "Trim + Mow",
                        scheduledDate = today,
                        scheduledTime = "09:30",
                        status = Job.STATUS_IN_PROGRESS,
                        assignedTo = "demo-crew-jake",
                        routeOrder = 1,
                    ),
                    clientName = "Johnson Home",
                    clientRate = 65.0,
                    clientAddress = "456 Oak Ave, OKC, OK",
                ),
                JobWithClient(
                    job = Job(
                        id = "demo-job-3",
                        userId = "demo-owner",
                        clientId = "demo-client-3",
                        title = "Quick Mow",
                        scheduledDate = today,
                        scheduledTime = "11:00",
                        status = Job.STATUS_SCHEDULED,
                        assignedTo = "demo-crew-maria",
                        routeOrder = 2,
                    ),
                    clientName = "Williams Estate",
                    clientRate = 80.0,
                    clientAddress = "789 Pine Rd, Edmond, OK",
                ),
                JobWithClient(
                    job = Job(
                        id = "demo-job-4",
                        userId = "demo-owner",
                        clientId = "demo-client-1",
                        title = "Biweekly Service",
                        scheduledDate = today,
                        scheduledTime = "13:00",
                        status = Job.STATUS_SCHEDULED,
                        routeOrder = 3,
                        recurrenceRule = "biweekly",
                    ),
                    clientName = "Smith Residence",
                    clientRate = 45.0,
                    clientAddress = "123 Main St, Edmond, OK",
                ),
            )
        }
        return demoJobsMutable
    }
}

@Serializable
private data class JobAssignedPatch(
    @SerialName("assigned_to") val assignedTo: String?,
)
