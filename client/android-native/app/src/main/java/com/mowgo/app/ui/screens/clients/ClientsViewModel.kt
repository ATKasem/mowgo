package com.mowgo.app.ui.screens.clients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.InvoiceRepository
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.LeadRepository
import com.mowgo.app.data.ProfileRepository
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Lead
import com.mowgo.app.data.model.LeadStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class ClientSegment { CLIENTS, LEADS }

data class ClientsUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val clients: List<Client> = emptyList(),
    val leads: List<Lead> = emptyList(),
    val segment: ClientSegment = ClientSegment.CLIENTS,
    val showNewClientDialog: Boolean = false,
    val showNewLeadDialog: Boolean = false,
    val editingClient: Client? = null,
    val showDeleteConfirmation: Client? = null,
    val leadToDelete: Lead? = null,
    val leadToConvert: Lead? = null,
    val isMutating: Boolean = false,
    val showSnackbar: String? = null,
    val showUpgradePrompt: Boolean = false,
)

/** Mirrors the free-tier client cap enforced by the DB trigger (web/iOS use the same limit). */
private const val FREE_CLIENT_LIMIT = 5

class ClientsViewModel : ViewModel() {
    private val jobRepository = JobRepository()
    private val invoiceRepository = InvoiceRepository()
    private val leadRepository = LeadRepository(invoiceRepository)
    private val profileRepository = ProfileRepository()
    private val _uiState = MutableStateFlow(ClientsUiState())
    val uiState: StateFlow<ClientsUiState> = _uiState.asStateFlow()
    private var loadGeneration = 0

    init { loadData() }

    fun loadData() {
        val generation = ++loadGeneration
        viewModelScope.launch {
            if (generation == loadGeneration) _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val clients = invoiceRepository.loadClients()
                val leads = leadRepository.loadLeads()
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(isLoading = false, clients = clients, leads = leads)
            } catch (error: Exception) {
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(isLoading = false, error = error.message ?: "Failed to load clients and leads")
            }
        }
    }

    fun refresh() = loadData()
    fun selectSegment(segment: ClientSegment) { _uiState.value = _uiState.value.copy(segment = segment) }
    fun showNewDialog() { _uiState.value = if (_uiState.value.segment == ClientSegment.CLIENTS) _uiState.value.copy(showNewClientDialog = true) else _uiState.value.copy(showNewLeadDialog = true) }
    fun dismissNewClientDialog() { _uiState.value = _uiState.value.copy(showNewClientDialog = false) }
    fun dismissNewLeadDialog() { _uiState.value = _uiState.value.copy(showNewLeadDialog = false) }
    fun showEditClientDialog(client: Client) { _uiState.value = _uiState.value.copy(editingClient = client) }
    fun dismissEditClientDialog() { _uiState.value = _uiState.value.copy(editingClient = null) }
    fun confirmDeleteClient(client: Client) { _uiState.value = _uiState.value.copy(showDeleteConfirmation = client) }
    fun dismissDeleteConfirmation() { _uiState.value = _uiState.value.copy(showDeleteConfirmation = null) }
    fun confirmDeleteLead(lead: Lead) { if (lead.status == LeadStatus.LOST.value) _uiState.value = _uiState.value.copy(leadToDelete = lead) }
    fun dismissDeleteLead() { _uiState.value = _uiState.value.copy(leadToDelete = null) }
    fun confirmConvertLead(lead: Lead) { _uiState.value = _uiState.value.copy(leadToConvert = lead) }
    fun dismissConvertLead() { _uiState.value = _uiState.value.copy(leadToConvert = null) }
    fun dismissSnackbar() { _uiState.value = _uiState.value.copy(showSnackbar = null) }
    fun dismissUpgradePrompt() { _uiState.value = _uiState.value.copy(showUpgradePrompt = false) }

    fun createClient(name: String, address: String?, phone: String?, rate: Double, keyCode: String?, petInstructions: String?) {
        if (_uiState.value.isMutating) return
        _uiState.value = _uiState.value.copy(isMutating = true)
        viewModelScope.launch {
            try {
                val profile = profileRepository.loadProfile()
                val isFreeTier = profile == null || profile.tier.isBlank() || profile.tier == "free"
                if (isFreeTier && _uiState.value.clients.size >= FREE_CLIENT_LIMIT) {
                    _uiState.value = _uiState.value.copy(showNewClientDialog = false, showUpgradePrompt = true)
                    return@launch
                }
                invoiceRepository.createClient(Client(name = name, address = address, phone = phone, rate = rate, keyCode = keyCode, petInstructions = petInstructions))
                _uiState.value = _uiState.value.copy(showNewClientDialog = false, showSnackbar = "Client created")
                loadData()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(showSnackbar = "Failed: ${error.message}")
            } finally {
                _uiState.value = _uiState.value.copy(isMutating = false)
            }
        }
    }

    fun updateClient(client: Client) = mutate("Client updated") {
        invoiceRepository.updateClient(client)
        _uiState.value = _uiState.value.copy(editingClient = null)
    }

    fun deleteClient(clientId: String) = mutate("Client deleted") {
        invoiceRepository.deleteClient(clientId)
        _uiState.value = _uiState.value.copy(showDeleteConfirmation = null)
    }

    fun createLead(name: String, phone: String?, email: String?, address: String?, source: String, notes: String?) = mutate("Lead created") {
        leadRepository.createLead(Lead(name = name.trim(), phone = phone, email = email, address = address, source = source, notes = notes))
        _uiState.value = _uiState.value.copy(showNewLeadDialog = false)
    }

    fun updateLeadStatus(lead: Lead, status: LeadStatus) = mutate("Lead status updated") {
        leadRepository.updateLeadStatus(lead, status)
    }

    fun deleteLead(lead: Lead) {
        if (lead.status != LeadStatus.LOST.value) return
        mutate("Lead deleted") {
            leadRepository.deleteLead(lead.id)
            _uiState.value = _uiState.value.copy(leadToDelete = null)
        }
    }

    fun convertLead(lead: Lead) = mutate("Lead converted to client") {
        leadRepository.convertLeadToClient(lead)
        _uiState.value = _uiState.value.copy(leadToConvert = null, segment = ClientSegment.CLIENTS)
    }

    private fun mutate(success: String, action: suspend () -> Unit) {
        if (_uiState.value.isMutating) return
        _uiState.value = _uiState.value.copy(isMutating = true)
        viewModelScope.launch {
            try {
                action()
                _uiState.value = _uiState.value.copy(showSnackbar = success)
                loadData()
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(showSnackbar = "Failed: ${error.message}")
            } finally {
                _uiState.value = _uiState.value.copy(isMutating = false)
            }
        }
    }
}
