package com.mowgo.app.ui.screens.more

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.ProfileRepository
import com.mowgo.app.data.SettingsRepository
import com.mowgo.app.data.auth.AuthRepository
import com.mowgo.app.data.model.Profile
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class MoreUiState(
    val isLoading: Boolean = true,
    val profile: Profile? = null,
    val error: String? = null,
    val isSaving: Boolean = false,
    val saveMessage: String? = null,
)

class MoreViewModel(
    private val settingsRepository: SettingsRepository,
    private val profileRepository: ProfileRepository = ProfileRepository(),
    private val authRepository: AuthRepository = AuthRepository(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(MoreUiState())
    val uiState: StateFlow<MoreUiState> = _uiState.asStateFlow()
    val appearanceMode = settingsRepository.appearanceMode
    val jobCompletionAlerts = settingsRepository.jobCompletionAlerts
    val rainDelayAlerts = settingsRepository.rainDelayAlerts

    init { loadProfile() }

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                _uiState.value = _uiState.value.copy(isLoading = false, profile = profileRepository.loadProfile())
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = error.message ?: "Failed to load profile")
            }
        }
    }

    fun updateProfile(name: String, phone: String, email: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true, error = null, saveMessage = null)
            try {
                profileRepository.updateProfile(name, phone, email)
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    profile = (_uiState.value.profile ?: Profile()).copy(businessName = name, phone = phone, email = email),
                    saveMessage = "Changes saved",
                )
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(isSaving = false, error = error.message ?: "Failed to save changes")
            }
        }
    }

    fun setAppearance(value: String) { viewModelScope.launch { settingsRepository.setAppearanceMode(value) } }
    fun setCompletionAlerts(value: Boolean) { viewModelScope.launch { settingsRepository.setJobCompletionAlerts(value) } }
    fun setRainAlerts(value: Boolean) { viewModelScope.launch { settingsRepository.setRainDelayAlerts(value) } }
    fun signOut(onComplete: () -> Unit) { viewModelScope.launch { authRepository.signOut(); onComplete() } }
    fun dismissSaveMessage() { _uiState.value = _uiState.value.copy(saveMessage = null) }
}
