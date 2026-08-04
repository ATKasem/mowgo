package com.mowgo.app.ui.screens.today

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.JobPhotoRepository
import com.mowgo.app.data.RainDelayHistoryStore
import com.mowgo.app.data.WeatherForecast
import com.mowgo.app.data.WeatherRepository
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.data.model.RainDelayEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

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
    val weatherAlert: WeatherForecast? = null,
    val showSnackbar: String? = null,
    val showNewJobDialog: Boolean = false,
    val editingJob: JobWithClient? = null,
    val uploadingPhotoJobIds: Set<String> = emptySet(),
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
    private var loadGeneration = 0

    private val _uiState = MutableStateFlow(TodayUiState())
    val uiState: StateFlow<TodayUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        val generation = ++loadGeneration
        viewModelScope.launch {
            if (generation == loadGeneration) _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val jobs = repository.loadJobs()
                val clients = repository.loadClients()
                val history = historyStore.load()
                val weather = weatherRepository.forecast(null, null)?.firstOrNull { it.precipitationProbability >= 60 }
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    jobs = jobs,
                    clients = clients,
                    rainDelayHistory = history,
                    weatherAlert = weather,
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
                repository.updateJobStatus(jobId, newStatus)
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
