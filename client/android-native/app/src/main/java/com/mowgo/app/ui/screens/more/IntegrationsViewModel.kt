package com.mowgo.app.ui.screens.more

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.WebhookConfig
import com.mowgo.app.data.WebhookRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class IntegrationsUiState(
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val configs: List<WebhookConfig> = emptyList(),
    val error: String? = null,
    val message: String? = null,
)

class IntegrationsViewModel(
    private val repository: WebhookRepository = WebhookRepository(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(IntegrationsUiState())
    val uiState: StateFlow<IntegrationsUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        runCatching { repository.loadConfigs() }
            .onSuccess { _uiState.value = _uiState.value.copy(isLoading = false, configs = it) }
            .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.message ?: "Failed to load integrations") }
    }

    fun save(config: WebhookConfig, done: () -> Unit) = viewModelScope.launch {
        _uiState.value = _uiState.value.copy(isSaving = true, error = null)
        runCatching { repository.saveConfig(config) }
            .onSuccess { saved ->
                val configs = _uiState.value.configs.filterNot { it.id == saved.id } + saved
                _uiState.value = _uiState.value.copy(isSaving = false, configs = configs, message = "Endpoint saved")
                done()
            }
            .onFailure { _uiState.value = _uiState.value.copy(isSaving = false, error = it.message ?: "Failed to save endpoint") }
    }

    fun delete(id: String) = viewModelScope.launch {
        runCatching { repository.deleteConfig(id) }
            .onSuccess { _uiState.value = _uiState.value.copy(configs = _uiState.value.configs.filterNot { it.id == id }, message = "Endpoint deleted") }
            .onFailure { _uiState.value = _uiState.value.copy(error = it.message ?: "Failed to delete endpoint") }
    }

    fun toggle(config: WebhookConfig, active: Boolean) { save(config.copy(isActive = active)) {} }

    fun regenerate(config: WebhookConfig, updated: (WebhookConfig) -> Unit) = viewModelScope.launch {
        if (config.id.isBlank()) {
            updated(config.copy(secret = WebhookRepository.generateSecret()))
        } else {
            runCatching { repository.regenerateSecret(config.id) }
                .onSuccess { secret ->
                    val changed = config.copy(secret = secret)
                    _uiState.value = _uiState.value.copy(configs = _uiState.value.configs.map { if (it.id == config.id) changed else it })
                    updated(changed)
                }
                .onFailure { _uiState.value = _uiState.value.copy(error = it.message ?: "Failed to regenerate secret") }
        }
    }

    fun clearMessage() { _uiState.value = _uiState.value.copy(message = null) }
}
