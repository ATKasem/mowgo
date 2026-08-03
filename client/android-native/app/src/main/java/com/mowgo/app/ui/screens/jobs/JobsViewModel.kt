package com.mowgo.app.ui.screens.jobs

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

data class JobsUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val jobs: List<JobWithClient> = emptyList(),
    val clients: List<Client> = emptyList(),
    val editingJob: JobWithClient? = null,
    val message: String? = null,
    val uploadingPhotoJobIds: Set<String> = emptySet(),
)

class JobsViewModel : ViewModel() {
    private val repository = JobRepository()
    private val photoRepository = JobPhotoRepository(repository)
    private val _uiState = MutableStateFlow(JobsUiState())
    val uiState: StateFlow<JobsUiState> = _uiState.asStateFlow()

    // Generation counter: only the latest load() may write results, so a slow
    // refresh can't overwrite newer state from a post-mutation reload.
    private var loadGeneration = 0

    init { load() }

    fun load() {
        val generation = ++loadGeneration
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val jobs = repository.loadJobs()
                val clients = repository.loadClients()
                if (generation == loadGeneration) {
                    _uiState.value = _uiState.value.copy(isLoading = false, jobs = jobs, clients = clients)
                }
            } catch (error: Exception) {
                if (generation == loadGeneration) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Failed to load jobs",
                    )
                }
            }
        }
    }

    fun toggleDone(jobId: String) {
        val job = _uiState.value.jobs.firstOrNull { it.id == jobId } ?: return
        val status = if (job.status == Job.STATUS_DONE) Job.STATUS_SCHEDULED else Job.STATUS_DONE
        viewModelScope.launch {
            try {
                repository.updateJobStatus(jobId, status)
                load()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(message = error.message ?: "Failed to update job")
            }
        }
    }

    fun delete(jobId: String) {
        viewModelScope.launch {
            try {
                repository.deleteJob(jobId)
                _uiState.value = _uiState.value.copy(message = "Job deleted")
                load()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(message = error.message ?: "Failed to delete job")
            }
        }
    }

    fun edit(job: JobWithClient) { _uiState.value = _uiState.value.copy(editingJob = job) }
    fun dismissEdit() { _uiState.value = _uiState.value.copy(editingJob = null) }

    fun update(job: Job) {
        viewModelScope.launch {
            try {
                repository.updateJob(job)
                _uiState.value = _uiState.value.copy(editingJob = null, message = "Job updated")
                load()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(message = error.message ?: "Failed to update job")
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
                    message = "Photo uploaded",
                )
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    uploadingPhotoJobIds = _uiState.value.uploadingPhotoJobIds - jobId,
                    message = "Photo upload failed: ${error.message}",
                )
            }
        }
    }

    fun showPhotoError(message: String) {
        _uiState.value = _uiState.value.copy(message = message)
    }

    fun dismissMessage() { _uiState.value = _uiState.value.copy(message = null) }
}
