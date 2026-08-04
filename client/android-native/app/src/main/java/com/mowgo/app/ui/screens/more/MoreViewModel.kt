package com.mowgo.app.ui.screens.more

import android.content.ContentResolver
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.ExportRepository
import com.mowgo.app.data.ProfileRepository
import com.mowgo.app.data.PaymentRepository
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
    val isSigningOut: Boolean = false,
    val saveMessage: String? = null,
    val billingLoadingAction: String? = null,
    val billingError: String? = null,
    val billingMessage: String? = null,
    val pendingBillingUrl: String? = null,
    val exportLoadingAction: String? = null,
    val exportMessage: String? = null,
    val exportError: String? = null,
)

class MoreViewModel(
    private val settingsRepository: SettingsRepository,
    private val profileRepository: ProfileRepository = ProfileRepository(),
    private val authRepository: AuthRepository = AuthRepository(),
    private val paymentRepository: PaymentRepository = PaymentRepository(),
    private val exportRepository: ExportRepository = ExportRepository(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(MoreUiState())
    val uiState: StateFlow<MoreUiState> = _uiState.asStateFlow()
    val appearanceMode = settingsRepository.appearanceMode
    val jobCompletionAlerts = settingsRepository.jobCompletionAlerts
    val rainDelayAlerts = settingsRepository.rainDelayAlerts

    // Guards against a stale profile load overwriting a just-saved profile.
    private var profileLoadGeneration = 0

    init { loadProfile() }

    fun loadProfile() {
        val generation = ++profileLoadGeneration
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val profile = profileRepository.loadProfile()
                if (generation == profileLoadGeneration) {
                    _uiState.value = _uiState.value.copy(isLoading = false, profile = profile)
                }
            } catch (error: Exception) {
                if (generation == profileLoadGeneration) {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = error.message ?: "Failed to load profile")
                }
            }
        }
    }

    fun onResume() {
        loadProfile()
    }

    fun updateProfile(name: String, phone: String, email: String) {
        // Invalidate any in-flight load so it can't clobber the saved profile.
        profileLoadGeneration++
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

    fun startCheckout(tier: String) {
        if (_uiState.value.billingLoadingAction != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                billingLoadingAction = "checkout:$tier",
                billingError = null,
                billingMessage = null,
            )
            try {
                val url = paymentRepository.createCheckoutSession(tier)
                _uiState.value = _uiState.value.copy(
                    billingLoadingAction = null,
                    pendingBillingUrl = url,
                )
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    billingLoadingAction = null,
                    billingError = error.message ?: "Could not create checkout session.",
                )
            }
        }
    }

    fun openCustomerPortal() {
        if (_uiState.value.billingLoadingAction != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                billingLoadingAction = "portal",
                billingError = null,
                billingMessage = null,
            )
            try {
                val url = paymentRepository.createCustomerPortal()
                _uiState.value = _uiState.value.copy(
                    billingLoadingAction = null,
                    pendingBillingUrl = url,
                )
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    billingLoadingAction = null,
                    billingError = error.message ?: "Could not open subscription management.",
                )
            }
        }
    }

    fun cancelSubscription() {
        if (_uiState.value.billingLoadingAction != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                billingLoadingAction = "cancel",
                billingError = null,
                billingMessage = null,
            )
            try {
                paymentRepository.cancelSubscription()
                _uiState.value = _uiState.value.copy(
                    billingLoadingAction = null,
                    billingMessage = "Subscription canceled",
                )
                loadProfile()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    billingLoadingAction = null,
                    billingError = error.message ?: "Could not cancel subscription.",
                )
            }
        }
    }

    fun billingUrlHandled() {
        _uiState.value = _uiState.value.copy(pendingBillingUrl = null)
    }

    fun billingUrlFailed() {
        _uiState.value = _uiState.value.copy(
            pendingBillingUrl = null,
            billingError = "Could not open billing page.",
        )
    }

    fun signOut(onComplete: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSigningOut = true, error = null)
            try {
                authRepository.signOut()
                // Don't leak the previous account's device-local preferences or demo state.
                settingsRepository.clearNotificationPrefs()
                ProfileRepository.resetDemoState()
                onComplete()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    isSigningOut = false,
                    error = error.message ?: "Failed to sign out",
                )
            }
        }
    }

    fun dismissSaveMessage() { _uiState.value = _uiState.value.copy(saveMessage = null) }

    fun exportData(kind: String, uri: Uri, contentResolver: ContentResolver) {
        if (_uiState.value.exportLoadingAction != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(exportLoadingAction = kind, exportMessage = null, exportError = null)
            try {
                val csv = when (kind) {
                    "clients" -> exportRepository.clientsCsv(exportRepository.exportClients())
                    "jobs" -> exportRepository.jobsCsv(exportRepository.exportJobs())
                    "invoices" -> exportRepository.invoicesCsv(exportRepository.exportInvoices())
                    else -> throw IllegalArgumentException("Unknown export type")
                }
                val output = contentResolver.openOutputStream(uri)
                    ?: throw IllegalStateException("Could not open the selected file")
                output.use { it.write(csv.toByteArray(Charsets.UTF_8)) }
                _uiState.value = _uiState.value.copy(exportLoadingAction = null, exportMessage = "Exported")
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    exportLoadingAction = null,
                    exportError = error.message ?: "Export failed",
                )
            }
        }
    }

    fun dismissExportResult() {
        _uiState.value = _uiState.value.copy(exportMessage = null, exportError = null)
    }
}
