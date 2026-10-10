package com.mowgo.app.ui.screens.more

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.ExportRepository
import com.mowgo.app.data.ProfileRepository
import com.mowgo.app.data.PaymentRepository
import com.mowgo.app.data.SettingsRepository
import com.mowgo.app.data.SupabaseClientProvider
import com.mowgo.app.data.auth.AuthRepository
import com.mowgo.app.data.model.Profile
import com.mowgo.app.data.model.ReferralStatus
import com.mowgo.app.data.sync.SyncManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
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
    val billingInterval: String = "year",
    val pendingBillingUrl: String? = null,
    /** Card payments live on the server (provider implemented). */
    val cardPaymentsEnabled: Boolean = false,
    /** Owner's merchant status; null until loaded. */
    val merchantStatus: String? = null,
    /// Set when a trial was just granted, before the async profile reload lands.
    /// Guards the double-tap window: a second grant_trial call would return
    /// false (server-side one-shot) and show a misleading error.
    val trialJustGranted: Boolean = false,
    val exportLoadingAction: String? = null,
    val exportMessage: String? = null,
    val exportError: String? = null,
    val rainAlertsEnabled: Boolean = true,
    val leadAlertsEnabled: Boolean = true,
    val isOffline: Boolean = false,
    val pendingSyncCount: Int = 0,
    val referralStatus: ReferralStatus? = null,
    val referralLoading: Boolean = true,
    val referralError: String? = null,
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

    init {
        loadProfile()
        loadReferrals()
        // Trial-first no-card flow: converge expired trials on app open
        // (idempotent; cron is the backstop). Best-effort, non-blocking.
        viewModelScope.launch {
            runCatching { profileRepository.expireTrial() }
            loadProfile()
        }
        // Skip the initial emission (loadProfile() above already covers current state) —
        // only react to genuine offline→online transitions.
        viewModelScope.launch {
            SyncManager.isOnline.drop(1).collect { refreshSyncStatus() }
        }
    }

    fun loadProfile() {
        val generation = ++profileLoadGeneration
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val profile = profileRepository.loadProfile()
                val pending = runCatching { SyncManager.pendingMutationCount() }.getOrDefault(0)
                if (generation == profileLoadGeneration) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        profile = profile,
                        rainAlertsEnabled = profile?.rainAlertsEnabled ?: true,
                        leadAlertsEnabled = profile?.leadAlertsEnabled ?: true,
                        isOffline = !SyncManager.isOnline.value,
                        pendingSyncCount = pending,
                    )
                }
            } catch (error: Exception) {
                if (generation == profileLoadGeneration) {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = error.message ?: "Failed to load profile")
                }
            }
        }
    }

    fun loadReferrals() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(referralLoading = true, referralError = null)
            try {
                val status = profileRepository.loadReferralStatus()
                _uiState.value = _uiState.value.copy(referralLoading = false, referralStatus = status)
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(referralLoading = false, referralError = error.message ?: "Failed to load referrals")
            }
        }
    }

    private suspend fun refreshSyncStatus() {
        val pending = runCatching { SyncManager.pendingMutationCount() }.getOrDefault(0)
        _uiState.value = _uiState.value.copy(isOffline = !SyncManager.isOnline.value, pendingSyncCount = pending)
    }

    fun onResume() {
        loadProfile()
    }

    fun updateProfile(name: String, phone: String, email: String, venmoHandle: String = "", cashappHandle: String = "", zelleHandle: String = "") {
        // Invalidate any in-flight load so it can't clobber the saved profile.
        profileLoadGeneration++
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true, error = null, saveMessage = null)
            try {
                profileRepository.updateProfile(name, phone, email, venmoHandle, cashappHandle, zelleHandle)
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    profile = (_uiState.value.profile ?: Profile()).copy(
                        businessName = name, phone = phone, email = email,
                        venmoHandle = venmoHandle, cashappHandle = cashappHandle, zelleHandle = zelleHandle,
                    ),
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

    fun setProfileRainAlerts(value: Boolean) {
        profileLoadGeneration++
        val previous = _uiState.value
        _uiState.value = previous.copy(rainAlertsEnabled = value, error = null)
        viewModelScope.launch {
            try {
                profileRepository.updateRainAlertsEnabled(value)
                _uiState.value = _uiState.value.copy(
                    profile = _uiState.value.profile?.copy(rainAlertsEnabled = value),
                )
                loadProfile()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    rainAlertsEnabled = previous.rainAlertsEnabled,
                    profile = _uiState.value.profile?.copy(rainAlertsEnabled = previous.rainAlertsEnabled),
                    error = error.message ?: "Failed to save alert preference",
                )
            }
        }
    }

    fun setLeadAlerts(value: Boolean) {
        profileLoadGeneration++
        val previous = _uiState.value
        _uiState.value = previous.copy(leadAlertsEnabled = value, error = null)
        viewModelScope.launch {
            try {
                profileRepository.updateLeadAlertsEnabled(value)
                _uiState.value = _uiState.value.copy(
                    profile = _uiState.value.profile?.copy(leadAlertsEnabled = value),
                )
                loadProfile()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    leadAlertsEnabled = previous.leadAlertsEnabled,
                    profile = _uiState.value.profile?.copy(leadAlertsEnabled = previous.leadAlertsEnabled),
                    error = error.message ?: "Failed to save alert preference",
                )
            }
        }
    }

    fun setBillingInterval(interval: String) {
        _uiState.value = _uiState.value.copy(billingInterval = interval)
    }

    fun startCheckout(tier: String, interval: String = "month") {
        if (_uiState.value.billingLoadingAction != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                billingLoadingAction = "checkout:$tier",
                billingError = null,
                billingMessage = null,
            )
            try {
                val url = paymentRepository.createCheckoutSession(tier, interval)
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

    /**
     * Trial-first no-card flow: grant the 14-day no-card trial for a plan.
     * One-shot per human (email-normalized, enforced server-side) — repeated
     * calls return false. Returns true if granted.
     */
    fun grantTrial(plan: String) {
        if (_uiState.value.billingLoadingAction != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                billingLoadingAction = "trial:$plan",
                billingError = null,
                billingMessage = null,
            )
            try {
                val granted = profileRepository.grantTrial(plan)
                if (granted) {
                    // Set the flag BEFORE the profile reload lands so the button
                    // doesn't re-enable as "Start Free Trial" (stale hasUsedTrial)
                    // and let a second tap hit the one-shot RPC → false → error.
                    _uiState.value = _uiState.value.copy(
                        trialJustGranted = true,
                        billingLoadingAction = null,
                    )
                    loadProfile()
                } else {
                    _uiState.value = _uiState.value.copy(
                        billingLoadingAction = null,
                        billingError = "Could not start your trial. Please try again.",
                    )
                }
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    billingLoadingAction = null,
                    billingError = error.message ?: "Could not start your trial.",
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

    fun loadCardPayments() {
        if (!SupabaseClientProvider.isConfigured) return
        viewModelScope.launch {
            val config = paymentRepository.paymentsConfig()
            val status = if (config.invoicePayments) {
                runCatching { paymentRepository.merchantStatus() }.getOrNull()
            } else {
                "none"
            }
            _uiState.value = _uiState.value.copy(
                cardPaymentsEnabled = config.invoicePayments,
                merchantStatus = status ?: _uiState.value.merchantStatus ?: "none",
            )
        }
    }

    fun startMerchantOnboarding() {
        if (_uiState.value.billingLoadingAction != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                billingLoadingAction = "merchant",
                billingError = null,
                billingMessage = null,
            )
            try {
                val url = paymentRepository.merchantOnboardingUrl()
                _uiState.value = _uiState.value.copy(billingLoadingAction = null, pendingBillingUrl = url)
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    billingLoadingAction = null,
                    billingError = error.message ?: "Could not start card payment setup.",
                )
                loadCardPayments()
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

    fun exportData(kind: String, uri: Uri, context: Context) {
        if (_uiState.value.exportLoadingAction != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(exportLoadingAction = kind, exportMessage = null, exportError = null)
            try {
                val csv = when (kind) {
                    "clients" -> exportRepository.clientsCsv(exportRepository.exportClients())
                    "jobs" -> exportRepository.jobsCsv(exportRepository.exportJobs())
                    "invoices" -> exportRepository.invoicesCsv(exportRepository.exportInvoices())
                    "leads" -> {
                        val profileId = authRepository.currentSession?.user?.id.orEmpty()
                        if (com.mowgo.app.data.SupabaseClientProvider.isConfigured && profileId.isBlank()) {
                            throw IllegalStateException("Not authenticated")
                        }
                        exportRepository.leadsCsv(exportRepository.exportLeads(context, profileId))
                    }
                    else -> throw IllegalArgumentException("Unknown export type")
                }
                val output = context.contentResolver.openOutputStream(uri)
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
