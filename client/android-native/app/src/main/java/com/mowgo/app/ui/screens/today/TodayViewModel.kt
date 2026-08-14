package com.mowgo.app.ui.screens.today

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.JobPhotoRepository
import com.mowgo.app.data.ProfileRepository
import com.mowgo.app.data.RainDelayHistoryStore
import com.mowgo.app.data.WeatherForecast
import com.mowgo.app.data.WeatherRepository
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.data.model.RainDelayEntry
import com.mowgo.app.data.SupabaseClientProvider
import com.mowgo.app.data.auth.AuthRepository
import com.mowgo.app.data.sync.SyncManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import com.mowgo.app.BuildConfig
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

/**
 * UI state for the Today screen.
 */
data class TodayUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val jobs: List<JobWithClient> = emptyList(),
    val clients: List<Client> = emptyList(),
    val businessName: String = "Green Thumb Lawn Care",
    val showRainDelayDialog: Boolean = false,
    val rainDelayCount: Int = 0,
    val rainDelayTargetDate: String = LocalDate.now().plusDays(1).toString(),
    val rainDelayHistory: List<RainDelayEntry> = emptyList(),
    val showRainDelayHistory: Boolean = false,
    val isApplyingRainDelay: Boolean = false,
    val isUndoingRainDelay: Boolean = false,
    val weatherForecast: WeatherForecast? = null,
    val hasBusinessLocation: Boolean? = null,
    val showSnackbar: String? = null,
    val showNewJobDialog: Boolean = false,
    val editingJob: JobWithClient? = null,
    val uploadingPhotoJobIds: Set<String> = emptySet(),
    val isOffline: Boolean = false,
    val pendingSyncCount: Int = 0,
) {
    val todayJobs: List<JobWithClient>
        get() {
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            return jobs.filter { it.scheduledDate == today }
        }

    val completedCount: Int
        get() = todayJobs.count { it.status == Job.STATUS_DONE }

    val scheduledCount: Int
        get() = todayJobs.count { it.status == Job.STATUS_SCHEDULED }

    val inProgressCount: Int
        get() = todayJobs.count { it.status == Job.STATUS_IN_PROGRESS }

    val totalJobs: Int get() = todayJobs.size

    val todayRevenue: Double
        get() = todayJobs
            .filter { it.status == Job.STATUS_DONE }
            .sumOf { it.clientRate }

    val todayDate: String
        get() = LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))

    val todayWeekday: String
        get() = LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE", Locale.US))

    val movableJobCount: Int
        get() = todayJobs.count { it.status == Job.STATUS_SCHEDULED }
}

class TodayViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = JobRepository()
    private val photoRepository = JobPhotoRepository(repository)
    private val historyStore = RainDelayHistoryStore(application.applicationContext)
    private val weatherRepository = WeatherRepository()
    private val profileRepository = ProfileRepository()
    private var loadGeneration = 0
    private val pendingRecurringJobs = mutableSetOf<String>()
    private val httpClient = OkHttpClient()

    private val _uiState = MutableStateFlow(TodayUiState())
    val uiState: StateFlow<TodayUiState> = _uiState.asStateFlow()

    init {
        loadData()
        // Skip the initial emission (already reflected in loadData()'s first pass) —
        // only react to genuine offline→online transitions so we don't double-load at startup.
        viewModelScope.launch {
            SyncManager.isOnline.drop(1).collect { online ->
                _uiState.value = _uiState.value.copy(isOffline = !online)
                if (online) {
                    // Wait for the queued mutations to replay before reloading remote
                    // data — otherwise the reload can race the sync and stale server
                    // rows would overwrite optimistic local edits that haven't synced yet.
                    SyncManager.triggerSyncAndAwait()
                    loadData()
                }
            }
        }
    }

    fun loadData() {
        val generation = ++loadGeneration
        viewModelScope.launch {
            if (generation == loadGeneration) _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val jobs = repository.loadJobs()
                val clients = repository.loadClients()
                val history = historyStore.load()
                val profile = runCatching { profileRepository.loadProfile() }.getOrNull()
                val latitude = profile?.latitude
                val longitude = profile?.longitude
                val hasLocation = latitude != null && longitude != null
                val forecasts = if (hasLocation) weatherRepository.forecast(latitude, longitude) else null
                val todayForecast = forecasts?.firstOrNull { it.date == LocalDate.now().toString() } ?: forecasts?.firstOrNull()
                val pendingSyncCount = runCatching { SyncManager.pendingMutationCount() }.getOrDefault(0)
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    jobs = jobs,
                    clients = clients,
                    rainDelayHistory = history,
                    weatherForecast = todayForecast,
                    hasBusinessLocation = hasLocation,
                    isOffline = !SyncManager.isOnline.value,
                    pendingSyncCount = pendingSyncCount,
                )
            } catch (e: Exception) {
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load data",
                )
            }
        }
    }

    fun refresh() {
        loadData()
    }

    fun updateJobStatus(jobId: String, newStatus: String) {
        viewModelScope.launch {
            try {
                val completedJob = _uiState.value.jobs.firstOrNull { it.id == jobId }
                // Auto-invoicing on completion (mirrors web) is handled by the
                // repository so it's queued/replayed as part of the same offline
                // mutation as the status change instead of being dropped silently.
                repository.updateJobStatus(
                    jobId, newStatus,
                    invoiceClientId = completedJob?.job?.clientId,
                    invoiceAmount = completedJob?.clientRate,
                )
                if (newStatus == Job.STATUS_DONE) {
                    completedJob?.let { createNextRecurringJob(it) }
                }
                // Reload to get fresh state
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to update: ${e.message}",
                )
            }
        }
    }

    fun markDone(jobId: String) = updateJobStatus(jobId, Job.STATUS_DONE)
    fun skipJob(jobId: String) = updateJobStatus(jobId, Job.STATUS_SKIPPED)

    fun deleteJob(jobId: String) {
        viewModelScope.launch {
            try {
                repository.deleteJob(jobId)
                _uiState.value = _uiState.value.copy(showSnackbar = "Job deleted")
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to delete: ${e.message}",
                )
            }
        }
    }

    fun moveJob(jobId: String, newOrder: Int) {
        viewModelScope.launch {
            try {
                repository.reorderJob(jobId, newOrder)
                loadData()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(showSnackbar = "Failed to reorder: ${error.message}")
            }
        }
    }

    private suspend fun createNextRecurringJob(jobWithClient: JobWithClient) {
        val recurrence = jobWithClient.recurrenceRule?.takeUnless { it == "none" } ?: return
        val nextDate = when (recurrence) {
            "daily" -> LocalDate.parse(jobWithClient.scheduledDate).plusDays(1)
            "weekly" -> LocalDate.parse(jobWithClient.scheduledDate).plusWeeks(1)
            "biweekly" -> LocalDate.parse(jobWithClient.scheduledDate).plusWeeks(2)
            "monthly" -> LocalDate.parse(jobWithClient.scheduledDate).plusMonths(1)
            else -> return
        }.toString()
        val dedupeKey = "${jobWithClient.clientId}:$nextDate:${jobWithClient.title}"
        val alreadyExists = _uiState.value.jobs.any {
            it.clientId == jobWithClient.clientId && it.scheduledDate == nextDate && it.title == jobWithClient.title
        }
        if (alreadyExists || !pendingRecurringJobs.add(dedupeKey)) return
        try {
            repository.createJob(
                jobWithClient.job.copy(
                    id = "",
                    scheduledDate = nextDate,
                    status = Job.STATUS_SCHEDULED,
                    routeOrder = 99,
                    photoUrl = null,
                )
            )
            _uiState.value = _uiState.value.copy(showSnackbar = "Next ${recurrence.replaceFirstChar { it.uppercase() }} job created")
        } catch (error: Exception) {
            _uiState.value = _uiState.value.copy(showSnackbar = "Job completed, but recurring job failed: ${error.message}")
        } finally {
            pendingRecurringJobs.remove(dedupeKey)
        }
    }

    // ── Rain Delay ───────────────────────────────────────────────────────

    fun showRainDelayDialog() {
        val count = _uiState.value.movableJobCount
        if (count == 0) {
            _uiState.value = _uiState.value.copy(
                showSnackbar = "No jobs to move",
            )
            return
        }
        _uiState.value = _uiState.value.copy(
            showRainDelayDialog = true,
            rainDelayCount = count,
            rainDelayTargetDate = LocalDate.now().plusDays(1).toString(),
        )
    }

    fun dismissRainDelayDialog() {
        _uiState.value = _uiState.value.copy(showRainDelayDialog = false)
    }

    fun confirmRainDelay(targetDate: String) {
        val today = LocalDate.now()
        val parsedTarget = try { LocalDate.parse(targetDate) } catch (_: Exception) { null }
        if (parsedTarget == null || parsedTarget <= today) {
            _uiState.value = _uiState.value.copy(
                error = "Rain delay target must be in the future",
                showSnackbar = "Rain delay target must be in the future",
            )
            return
        }
        val sourceDate = today.toString()
        _uiState.value = _uiState.value.copy(isApplyingRainDelay = true, rainDelayTargetDate = targetDate)
        viewModelScope.launch {
            try {
                val entry = repository.rainDelay(sourceDate, targetDate)
                val history = if (entry == null) historyStore.load() else historyStore.add(entry)
                if (entry != null) viewModelScope.launch { sendRainDelaySms(entry, targetDate) }
                _uiState.value = _uiState.value.copy(
                    showRainDelayDialog = false,
                    isApplyingRainDelay = false,
                    rainDelayHistory = history,
                    showSnackbar = if (entry == null) "No jobs moved" else "Moved ${entry.jobCount} jobs to ${entry.targetDate}",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isApplyingRainDelay = false,
                    showSnackbar = "Failed to delay: ${e.message}",
                )
            }
        }
    }

    private suspend fun sendRainDelaySms(entry: RainDelayEntry, delayDate: String) {
        if (!SupabaseClientProvider.isConfigured || entry.jobIds.isEmpty()) return
        val token = AuthRepository().currentSession?.accessToken ?: return
        val movedJobs = _uiState.value.jobs.filter { it.id in entry.jobIds }
        val body = JSONObject()
            .put("jobIds", JSONArray(entry.jobIds))
            .put("targetDate", delayDate)
            .put("delays", JSONArray().apply {
                movedJobs.forEach { job ->
                    put(JSONObject()
                        .put("jobId", job.id)
                        .put("clientId", job.clientId)
                        .put("delayDate", delayDate))
                }
            })
            .toString()
        runCatching {
            withContext(Dispatchers.IO) {
                val request = Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL}/functions/v1/send-rain-delay-sms")
                    .header("Authorization", "Bearer $token")
                    .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()
                httpClient.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw IllegalStateException("Rain-delay SMS returned ${response.code}")
                }
            }
        }.onFailure { error ->
            if (BuildConfig.DEBUG) android.util.Log.w("TodayViewModel", "rain-delay SMS failed", error)
        }
    }

    fun showRainDelayHistory() { _uiState.value = _uiState.value.copy(showRainDelayHistory = true) }
    fun dismissRainDelayHistory() { if (!_uiState.value.isUndoingRainDelay) _uiState.value = _uiState.value.copy(showRainDelayHistory = false) }

    fun undoRainDelay(entry: RainDelayEntry) {
        if (_uiState.value.isUndoingRainDelay) return
        _uiState.value = _uiState.value.copy(isUndoingRainDelay = true)
        viewModelScope.launch {
            try {
                val result = repository.undoRainDelay(entry)
                val history = historyStore.replace(entry.createdAt, result.remainingEntry)
                val message = if (result.skippedCount > 0) "Partially undone — ${result.skippedCount} job(s) were missing or rescheduled manually." else "Rain delay undone"
                _uiState.value = _uiState.value.copy(isUndoingRainDelay = false, rainDelayHistory = history, showSnackbar = message)
                loadData()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(isUndoingRainDelay = false, showSnackbar = "Undo failed: ${error.message}")
            }
        }
    }

    // ── New Job ──────────────────────────────────────────────────────────

    fun showNewJobDialog() {
        _uiState.value = _uiState.value.copy(showNewJobDialog = true)
    }

    fun dismissNewJobDialog() {
        _uiState.value = _uiState.value.copy(showNewJobDialog = false)
    }

    fun createJob(
        title: String,
        clientId: String,
        scheduledDate: String,
        scheduledTime: String?,
        notes: String?,
        routeOrder: Int?,
        recurrenceRule: String,
    ) {
        viewModelScope.launch {
            try {
                val job = Job(
                    title = title,
                    clientId = clientId,
                    scheduledDate = scheduledDate,
                    scheduledTime = scheduledTime,
                    notes = notes,
                    routeOrder = routeOrder,
                    status = Job.STATUS_SCHEDULED,
                    recurrenceRule = recurrenceRule.takeUnless { it == "none" },
                )
                repository.createJob(job)
                _uiState.value = _uiState.value.copy(
                    showNewJobDialog = false,
                    showSnackbar = "Job created",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to create: ${e.message}",
                )
            }
        }
    }

    // ── Edit Job ─────────────────────────────────────────────────────────

    fun showEditJobDialog(job: JobWithClient) {
        _uiState.value = _uiState.value.copy(editingJob = job)
    }

    fun dismissEditJobDialog() {
        _uiState.value = _uiState.value.copy(editingJob = null)
    }

    fun updateJob(job: Job) {
        viewModelScope.launch {
            try {
                repository.updateJob(job)
                _uiState.value = _uiState.value.copy(
                    editingJob = null,
                    showSnackbar = "Job updated",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to update: ${e.message}",
                )
            }
        }
    }

    fun uploadJobPhoto(jobId: String, imageData: ByteArray) {
        _uiState.value = _uiState.value.copy(
            uploadingPhotoJobIds = _uiState.value.uploadingPhotoJobIds + jobId,
        )
        viewModelScope.launch {
            try {
                val url = photoRepository.uploadJobPhoto(jobId, imageData)
                _uiState.value = _uiState.value.copy(
                    jobs = _uiState.value.jobs.map { item ->
                        if (item.id == jobId) item.copy(job = item.job.copy(photoUrl = url)) else item
                    },
                    uploadingPhotoJobIds = _uiState.value.uploadingPhotoJobIds - jobId,
                    showSnackbar = "Photo uploaded",
                )
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    uploadingPhotoJobIds = _uiState.value.uploadingPhotoJobIds - jobId,
                    showSnackbar = "Photo upload failed: ${error.message}",
                )
            }
        }
    }

    fun showPhotoError(message: String) {
        _uiState.value = _uiState.value.copy(showSnackbar = message)
    }

    // ── Snackbar ─────────────────────────────────────────────────────────

    fun dismissSnackbar() {
        _uiState.value = _uiState.value.copy(showSnackbar = null)
    }
}
