package com.mowgo.app.data

import androidx.room.withTransaction
import com.mowgo.app.BuildConfig
import com.mowgo.app.data.local.AppDatabaseProvider
import com.mowgo.app.data.local.dao.JobDao
import com.mowgo.app.data.local.entity.MutationEntity
import com.mowgo.app.data.local.entity.toCachedEntity
import com.mowgo.app.data.local.entity.toClient
import com.mowgo.app.data.local.entity.toJob
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.data.model.RainDelayEntry
import com.mowgo.app.data.model.RainDelayUndoResult
import com.mowgo.app.data.auth.AuthRepository
import com.mowgo.app.data.sync.SyncManager
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import java.io.IOException
import java.time.LocalDate
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

/**
 * Repository for Job and Client data.
 * Uses Supabase PostgREST when configured, in-memory demo data otherwise.
 */
class JobRepository {

    private val dateFormat = DateTimeFormatter.ISO_LOCAL_DATE
    private val httpClient = OkHttpClient()

    // ── Public API ───────────────────────────────────────────────────────

    /** Load all jobs for the current user, joined with client info. Falls back to the local cache when offline. */
    suspend fun loadJobs(): List<JobWithClient> {
        if (!SupabaseClientProvider.isConfigured) return demoJobs()

        val userId = getCurrentUserId() ?: return emptyList()
        try {
            val client = SupabaseClientProvider.client
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
            AppDatabaseProvider.database.jobDao().replaceAll(jobs.map { it.toCachedEntity() })

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
        } catch (e: Exception) {
            if (!isNetworkError(e)) throw e
            return loadJobsFromCache(userId)
        }
    }

    private suspend fun loadJobsFromCache(userId: String): List<JobWithClient> {
        val cachedJobs = AppDatabaseProvider.database.jobDao().getAll()
            .map { it.toJob() }
            .filter { it.userId == userId || it.assignedTo == userId }
        val clientMap = AppDatabaseProvider.database.clientDao().getAll()
            .map { it.toClient() }
            .associateBy { it.id }
        return cachedJobs.map { job ->
            val c = clientMap[job.clientId]
            JobWithClient(
                job = job,
                clientName = c?.name ?: "Unknown",
                clientRate = c?.rate ?: 0.0,
                clientAddress = c?.address,
            )
        }
    }

    /** Load all clients for the current user. Falls back to the local cache when offline. */
    suspend fun loadClients(): List<Client> {
        if (!SupabaseClientProvider.isConfigured) return demoClients()

        val userId = getCurrentUserId() ?: return emptyList()
        try {
            val client = SupabaseClientProvider.client
            val profile = ProfileRepository().loadProfile()
            val ownerId = if (profile?.role == "crew") profile.businessId else userId
            if (ownerId == null) return emptyList()

            val clients = client.from("clients")
                .select {
                    filter { eq("user_id", ownerId) }
                    order("name", Order.ASCENDING)
                }
                .decodeList<Client>()
            AppDatabaseProvider.database.clientDao().replaceAll(clients.map { it.toCachedEntity() })
            return clients
        } catch (e: Exception) {
            if (!isNetworkError(e)) throw e
            return AppDatabaseProvider.database.clientDao().getAll().map { it.toClient() }
        }
    }

    /**
     * Update a job's status. Falls back to an offline mutation queue entry when the
     * network is down. When completing a job ([Job.STATUS_DONE]) with a positive
     * [invoiceAmount], auto-invoicing is treated as part of the same completion:
     * queued together with the status change when offline, and retried on its own
     * if only the invoice call (not the status update) hits a network error.
     */
    suspend fun updateJobStatus(
        jobId: String,
        newStatus: String,
        invoiceClientId: String? = null,
        invoiceAmount: Double? = null,
    ) {
        if (!SupabaseClientProvider.isConfigured) {
            demoJobsMutable = demoJobsMutable.map {
                if (it.job.id == jobId) it.copy(job = it.job.copy(status = newStatus)) else it
            }
            if (newStatus == Job.STATUS_DONE && invoiceClientId != null && invoiceAmount != null && invoiceAmount > 0) {
                runCatching { InvoiceRepository().createInvoiceForJob(jobId, invoiceClientId, invoiceAmount) }
            }
            return
        }

        try {
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
            AppDatabaseProvider.database.jobDao().insert(job.copy(status = newStatus).toCachedEntity())
        } catch (e: Exception) {
            if (!isNetworkError(e)) throw e
            val dao = AppDatabaseProvider.database.jobDao()
            val cached = dao.getAll().firstOrNull { it.id == jobId }
                ?: throw IllegalStateException("Job not cached; cannot update offline")
            val queuedPayload = Json.encodeToString(
                JobStatusPayload.serializer(),
                JobStatusPayload(newStatus, invoiceClientId, invoiceAmount?.takeIf { it > 0 }),
            )
            cacheAndEnqueue(OP_JOB_STATUS, jobId, queuedPayload) { it.insert(cached.copy(status = newStatus)) }
            return
        }

        if (newStatus == Job.STATUS_DONE && invoiceClientId != null && invoiceAmount != null && invoiceAmount > 0) {
            try {
                InvoiceRepository().createInvoiceForJob(jobId, invoiceClientId, invoiceAmount)
            } catch (e: Exception) {
                // Status update already landed online; only the invoice call needs a
                // retry, so it's queued on its own rather than re-running the status
                // change too.
                if (isNetworkError(e)) {
                    AppDatabaseProvider.mutationQueue.enqueue(
                        OP_JOB_INVOICE, jobId,
                        Json.encodeToString(JobInvoicePayload.serializer(), JobInvoicePayload(invoiceClientId, invoiceAmount)),
                    )
                }
                if (BuildConfig.DEBUG) android.util.Log.w(TAG, "auto-invoice failed", e)
            }
        }
    }

    /** Move one job to a zero-based position and persist the day's complete order atomically. */
    suspend fun reorderJob(jobId: String, newOrder: Int) {
        require(newOrder >= 0) { "Route order cannot be negative" }
        val jobs = loadJobs()
        val moving = jobs.firstOrNull { it.id == jobId }
            ?: throw IllegalArgumentException("Job not found")
        val sameDay = jobs.filter { it.scheduledDate == moving.scheduledDate }
            .sortedWith(compareBy<JobWithClient> { it.routeOrder ?: Int.MAX_VALUE }.thenBy { it.scheduledTime ?: "" })
            .toMutableList()
        val oldIndex = sameDay.indexOfFirst { it.id == jobId }
        if (oldIndex < 0) return
        val targetIndex = newOrder.coerceIn(0, sameDay.lastIndex)
        if (oldIndex == targetIndex) return
        sameDay.add(targetIndex, sameDay.removeAt(oldIndex))

        if (!SupabaseClientProvider.isConfigured) {
            val orders = sameDay.mapIndexed { index, item -> item.id to (index + 1) }.toMap()
            demoJobsMutable = demoJobsMutable.map { item ->
                orders[item.id]?.let { order -> item.copy(job = item.job.copy(routeOrder = order)) } ?: item
            }
            return
        }

        val payload = JobReorderPayload(
            sameDay.mapIndexed { index, item -> JobRouteOrder(item.id, index + 1) }
        )
        try {
            performReorder(payload)
            val dao = AppDatabaseProvider.database.jobDao()
            val cachedById = dao.getAll().associateBy { it.id }
            payload.orders.forEach { order ->
                cachedById[order.id]?.let { dao.insert(it.copy(routeOrder = order.routeOrder)) }
            }
        } catch (e: Exception) {
            if (!isNetworkError(e)) throw e
            val cachedById = AppDatabaseProvider.database.jobDao().getAll().associateBy { it.id }
            cacheAndEnqueue(
                OP_JOB_REORDER,
                jobId,
                Json.encodeToString(JobReorderPayload.serializer(), payload),
            ) { dao ->
                payload.orders.forEach { order ->
                    cachedById[order.id]?.let { dao.insert(it.copy(routeOrder = order.routeOrder)) }
                }
            }
        }
    }

    private suspend fun performReorder(payload: JobReorderPayload) {
        val token = AuthRepository().currentSession?.accessToken
            ?: throw IllegalStateException("Not authenticated")
        val orders = JSONArray().apply {
            payload.orders.forEach { order ->
                put(JSONObject().put("id", order.id).put("route_order", order.routeOrder))
            }
        }
        val body = JSONObject().put("orders", orders).toString()
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url("https://mowgoapp.com/api/jobs/reorder")
                .header("Authorization", "Bearer $token")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw IllegalStateException("Could not reorder jobs (${response.code})")
            }
        }
    }

    /** Create a new job. Falls back to an offline mutation queue entry when the network is down. */
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
        // Id is assigned client-side (not server-generated) so a queued offline create
        // replays with the same id instead of minting a duplicate row later.
        val jobWithUser = job.copy(
            id = job.id.ifBlank { UUID.randomUUID().toString() },
            userId = userId,
        )

        try {
            SupabaseClientProvider.client.from("jobs")
                .insert(jobWithUser)
            WebhookService.fire("job.created", mapOf(
                "job_id" to jobWithUser.id, "title" to jobWithUser.title,
                "client_id" to jobWithUser.clientId, "scheduled_date" to jobWithUser.scheduledDate,
                "status" to jobWithUser.status,
            ))
            AppDatabaseProvider.database.jobDao().insert(jobWithUser.toCachedEntity())
        } catch (e: Exception) {
            if (!isNetworkError(e)) throw e
            cacheAndEnqueue(OP_JOB_CREATE, jobWithUser.id, Json.encodeToString(Job.serializer(), jobWithUser)) {
                it.insert(jobWithUser.toCachedEntity())
            }
        }
    }

    /** Update an existing job. Falls back to an offline mutation queue entry when the network is down. */
    suspend fun updateJob(job: Job) {
        if (!SupabaseClientProvider.isConfigured) {
            demoJobsMutable = demoJobsMutable.map {
                if (it.job.id == job.id) it.copy(job = job) else it
            }
            return
        }

        try {
            SupabaseClientProvider.client.from("jobs")
                .update(job) {
                    filter { eq("id", job.id) }
                }
            WebhookService.fire("job.updated", mapOf(
                "job_id" to job.id, "title" to job.title, "client_id" to job.clientId,
                "scheduled_date" to job.scheduledDate, "status" to job.status,
            ))
            AppDatabaseProvider.database.jobDao().insert(job.toCachedEntity())
        } catch (e: Exception) {
            if (!isNetworkError(e)) throw e
            cacheAndEnqueue(OP_JOB_UPDATE, job.id, Json.encodeToString(Job.serializer(), job)) {
                it.insert(job.toCachedEntity())
            }
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

    /** Delete a job. Falls back to an offline mutation queue entry when the network is down. */
    suspend fun deleteJob(jobId: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoJobsMutable = demoJobsMutable.filter { it.job.id != jobId }
            return
        }

        try {
            SupabaseClientProvider.client.from("jobs")
                .delete {
                    filter { eq("id", jobId) }
                }
            AppDatabaseProvider.database.jobDao().deleteById(jobId)
        } catch (e: Exception) {
            if (!isNetworkError(e)) throw e
            cacheAndEnqueue(OP_JOB_DELETE, jobId, "") { it.deleteById(jobId) }
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
        val profile = ProfileRepository().loadProfile()
        val businessId = if (profile?.role == "crew") profile.businessId else userId
        if (businessId == null) return null

        // Snapshot the jobs the RPC will move (read-only) so we can build the Undo
        // history entry — the RPC itself only returns a moved-row count.
        val jobsToMove = SupabaseClientProvider.client.from("jobs")
            .select {
                filter {
                    eq("user_id", businessId)
                    eq("scheduled_date", date)
                    eq("status", Job.STATUS_SCHEDULED)
                }
            }
            .decodeList<Job>()
        if (jobsToMove.isEmpty()) return null

        // apply_rain_delay(p_business_id, p_from_date, p_to_date) moves every matching
        // job and writes its history row inside a single DB transaction — either all
        // jobs move or none do, so there's no partial/rollback state to manage here.
        val movedCount = SupabaseClientProvider.client.postgrest.rpc(
            "apply_rain_delay",
            buildJsonObject {
                put("p_business_id", businessId)
                put("p_from_date", date)
                put("p_to_date", targetDate)
            }
        ).decodeAs<Int>()
        if (movedCount <= 0) return null

        val entry = RainDelayEntry(date, targetDate, jobsToMove.map { it.id }, movedCount,
            Instant.now().toString(), jobsToMove.associate { it.id to it.scheduledDate })
        WebhookService.fire("rain.delay.applied", mapOf(
            "count" to movedCount.toString(), "date" to date, "target_date" to targetDate,
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

    /**
     * Persists a cache write and its replay-queue entry as a single Room
     * transaction, so a process death between the two can't leave a locally
     * visible mutation that the queue never learns about (and therefore never
     * syncs).
     */
    private suspend fun cacheAndEnqueue(
        operation: String,
        entityId: String,
        payload: String,
        cacheWrite: suspend (JobDao) -> Unit,
    ) {
        AppDatabaseProvider.database.withTransaction {
            cacheWrite(AppDatabaseProvider.database.jobDao())
            AppDatabaseProvider.database.mutationDao().insert(
                MutationEntity(
                    operation = operation,
                    entityId = entityId,
                    payload = payload,
                    createdAt = System.currentTimeMillis(),
                )
            )
        }
        // Don't wait solely for the next offline→online transition to schedule the
        // replay — see MutationQueue.enqueue for why.
        SyncManager.triggerSync()
    }

    // ── Offline mutation replay ─────────────────────────────────────────
    // Invoked by SyncManager once connectivity returns — issues the same
    // online call the original mutation would have made, without re-queueing
    // on failure (the caller decides whether to retry).

    suspend fun replayMutation(operation: String, entityId: String, payload: String) {
        when (operation) {
            OP_JOB_CREATE -> {
                val job = Json.decodeFromString(Job.serializer(), payload)
                // Upsert, not insert: if a prior replay reached the server but the
                // process died before the queue row was deleted, retrying an insert
                // would fail on the duplicate id and wedge the FIFO queue forever.
                // An upsert on the same client-assigned id is a no-op in that case.
                SupabaseClientProvider.client.from("jobs").upsert(job)
                WebhookService.fire("job.created", mapOf(
                    "job_id" to job.id, "title" to job.title, "client_id" to job.clientId,
                    "scheduled_date" to job.scheduledDate, "status" to job.status,
                ))
            }
            OP_JOB_UPDATE -> {
                val job = Json.decodeFromString(Job.serializer(), payload)
                SupabaseClientProvider.client.from("jobs").update(job) { filter { eq("id", job.id) } }
                WebhookService.fire("job.updated", mapOf(
                    "job_id" to job.id, "title" to job.title, "client_id" to job.clientId,
                    "scheduled_date" to job.scheduledDate, "status" to job.status,
                ))
            }
            OP_JOB_STATUS -> {
                val statusPayload = Json.decodeFromString(JobStatusPayload.serializer(), payload)
                SupabaseClientProvider.client.from("jobs")
                    .update(mapOf("status" to statusPayload.status)) { filter { eq("id", entityId) } }
                WebhookService.fire("job.updated", mapOf("job_id" to entityId, "status" to statusPayload.status))
                if (statusPayload.status == Job.STATUS_DONE) {
                    WebhookService.fire("job.completed", mapOf("job_id" to entityId, "status" to statusPayload.status))
                    val clientId = statusPayload.invoiceClientId
                    val amount = statusPayload.invoiceAmount
                    if (clientId != null && amount != null && amount > 0) {
                        // create_invoice_for_job is ON CONFLICT-idempotent per job,
                        // so a redundant replay after a crash just returns the
                        // already-created invoice instead of duplicating it.
                        InvoiceRepository().createInvoiceForJob(entityId, clientId, amount)
                    }
                }
            }
            OP_JOB_DELETE -> {
                SupabaseClientProvider.client.from("jobs").delete { filter { eq("id", entityId) } }
            }
            OP_JOB_INVOICE -> {
                val invoicePayload = Json.decodeFromString(JobInvoicePayload.serializer(), payload)
                InvoiceRepository().createInvoiceForJob(entityId, invoicePayload.clientId, invoicePayload.amount)
            }
            OP_JOB_REORDER -> {
                performReorder(Json.decodeFromString(JobReorderPayload.serializer(), payload))
            }
            else -> throw IllegalArgumentException("Unknown mutation operation: $operation")
        }
    }

    /** Recognizes connectivity failures (no response reached the server) vs. real API/validation errors. */
    private fun isNetworkError(e: Throwable): Boolean {
        var cause: Throwable? = e
        var depth = 0
        while (cause != null && depth < 8) {
            if (cause is IOException) return true
            cause = cause.cause
            depth++
        }
        return false
    }

    // ── Auth helper ──────────────────────────────────────────────────────

    private suspend fun getCurrentUserId(): String? {
        return try {
            SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        const val OP_JOB_CREATE = "job:create"
        const val OP_JOB_UPDATE = "job:update"
        const val OP_JOB_STATUS = "job:status"
        const val OP_JOB_DELETE = "job:delete"
        const val OP_JOB_INVOICE = "job:invoice"
        const val OP_JOB_REORDER = "job:reorder"
        private const val TAG = "JobRepository"
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
                        routeOrder = 1,
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
                        routeOrder = 2,
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
                        routeOrder = 3,
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
                        routeOrder = 4,
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

@Serializable
private data class JobStatusPayload(
    @SerialName("status") val status: String,
    @SerialName("invoice_client_id") val invoiceClientId: String? = null,
    @SerialName("invoice_amount") val invoiceAmount: Double? = null,
)

@Serializable
private data class JobInvoicePayload(
    @SerialName("client_id") val clientId: String,
    @SerialName("amount") val amount: Double,
)

@Serializable
private data class JobReorderPayload(
    val orders: List<JobRouteOrder>,
)

@Serializable
private data class JobRouteOrder(
    val id: String,
    @SerialName("route_order") val routeOrder: Int,
)
