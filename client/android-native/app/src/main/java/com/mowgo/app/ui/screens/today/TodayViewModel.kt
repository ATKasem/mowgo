package com.mowgo.app.ui.screens.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.JobPhotoRepository
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
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
    val showSnackbar: String? = null,
    val showNewJobDialog: Boolean = false,
    val editingJob: JobWithClient? = null,
    val uploadingPhotoJobId: String? = null,
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
        get() = todayJobs.count {
            it.status == Job.STATUS_SCHEDULED || it.status == Job.STATUS_IN_PROGRESS
        }
}

class TodayViewModel : ViewModel() {

    private val repository = JobRepository()
    private val photoRepository = JobPhotoRepository(repository)

    private val _uiState = MutableStateFlow(TodayUiState())
    val uiState: StateFlow<TodayUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val jobs = repository.loadJobs()
                val clients = repository.loadClients()
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    jobs = jobs,
                    clients = clients,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
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
        )
    }

    fun dismissRainDelayDialog() {
        _uiState.value = _uiState.value.copy(showRainDelayDialog = false)
    }

    fun confirmRainDelay() {
        val count = _uiState.value.rainDelayCount
        _uiState.value = _uiState.value.copy(showRainDelayDialog = false)
        viewModelScope.launch {
            try {
                val moved = repository.rainDelay()
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Moved $moved jobs to tomorrow",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to delay: ${e.message}",
                )
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
        _uiState.value = _uiState.value.copy(uploadingPhotoJobId = jobId)
        viewModelScope.launch {
            try {
                val url = photoRepository.uploadJobPhoto(jobId, imageData)
                _uiState.value = _uiState.value.copy(
                    jobs = _uiState.value.jobs.map { item ->
                        if (item.id == jobId) item.copy(job = item.job.copy(photoUrl = url)) else item
                    },
                    uploadingPhotoJobId = null,
                    showSnackbar = "Photo uploaded",
                )
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    uploadingPhotoJobId = null,
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
