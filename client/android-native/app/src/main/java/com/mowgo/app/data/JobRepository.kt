package com.mowgo.app.data

import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import java.time.LocalDate
import java.time.format.DateTimeFormatter
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

        SupabaseClientProvider.client.from("jobs")
            .update(
                mapOf("status" to newStatus)
            ) {
                filter { eq("id", jobId) }
            }
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
        val jobWithUser = job.copy(userId = userId)

        SupabaseClientProvider.client.from("jobs")
            .insert(jobWithUser)
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
     * Move all today's scheduled/in_progress jobs to tomorrow (rain delay).
     * Returns the count of jobs moved.
     */
    suspend fun rainDelay(): Int {
        val today = dateFormat.format(LocalDate.now())
        val tomorrow = dateFormat.format(LocalDate.now().plusDays(1))

        if (!SupabaseClientProvider.isConfigured) {
            val affected = demoJobsMutable.filter {
                it.scheduledDate == today &&
                    (it.status == Job.STATUS_SCHEDULED || it.status == Job.STATUS_IN_PROGRESS)
            }
            demoJobsMutable = demoJobsMutable.map { jwc ->
                if (jwc.scheduledDate == today &&
                    (jwc.status == Job.STATUS_SCHEDULED || jwc.status == Job.STATUS_IN_PROGRESS)
                ) {
                    jwc.copy(job = jwc.job.copy(scheduledDate = tomorrow))
                } else {
                    jwc
                }
            }
            return affected.size
        }

        val userId = getCurrentUserId() ?: return 0

        // Fetch all jobs for today and filter client-side (avoids complex OR filter DSL)
        val allJobs = SupabaseClientProvider.client.from("jobs")
            .select {
                filter { eq("user_id", userId) }
            }
            .decodeList<Job>()

        val jobsToMove = allJobs.filter {
            it.scheduledDate == today &&
                (it.status == Job.STATUS_SCHEDULED || it.status == Job.STATUS_IN_PROGRESS)
        }

        for (job in jobsToMove) {
            SupabaseClientProvider.client.from("jobs")
                .update(
                    mapOf("scheduled_date" to tomorrow)
                ) {
                    filter { eq("id", job.id) }
                }
        }

        return jobsToMove.size
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
