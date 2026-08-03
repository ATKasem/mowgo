package com.mowgo.app.ui.screens.clients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.InvoiceRepository
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.model.Client
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * UI state for the Clients screen.
 */
data class ClientsUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val clients: List<Client> = emptyList(),
    val showNewClientDialog: Boolean = false,
    val editingClient: Client? = null,
    val showDeleteConfirmation: Client? = null,
    val showSnackbar: String? = null,
)

class ClientsViewModel : ViewModel() {

    private val jobRepository = JobRepository()
    private val invoiceRepository = InvoiceRepository()

    private val _uiState = MutableStateFlow(ClientsUiState())
    val uiState: StateFlow<ClientsUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val clients = jobRepository.loadClients()
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    clients = clients,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load clients",
                )
            }
        }
    }

    fun refresh() = loadData()

    fun showNewClientDialog() {
        _uiState.value = _uiState.value.copy(showNewClientDialog = true)
    }

    fun dismissNewClientDialog() {
        _uiState.value = _uiState.value.copy(showNewClientDialog = false)
    }

    fun showEditClientDialog(client: Client) {
        _uiState.value = _uiState.value.copy(editingClient = client)
    }

    fun dismissEditClientDialog() {
        _uiState.value = _uiState.value.copy(editingClient = null)
    }

    fun createClient(
        name: String,
        address: String?,
        phone: String?,
        rate: Double,
        keyCode: String?,
        petInstructions: String?,
    ) {
        viewModelScope.launch {
            try {
                val client = Client(
                    name = name,
                    address = address,
                    phone = phone,
                    rate = rate,
                    keyCode = keyCode,
                    petInstructions = petInstructions,
                )
                invoiceRepository.createClient(client)
                _uiState.value = _uiState.value.copy(
                    showNewClientDialog = false,
                    showSnackbar = "Client created",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to create: ${e.message}",
                )
            }
        }
    }

    fun updateClient(client: Client) {
        viewModelScope.launch {
            try {
                invoiceRepository.updateClient(client)
                _uiState.value = _uiState.value.copy(
                    editingClient = null,
                    showSnackbar = "Client updated",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to update: ${e.message}",
                )
            }
        }
    }

    fun confirmDeleteClient(client: Client) {
        _uiState.value = _uiState.value.copy(showDeleteConfirmation = client)
    }

    fun dismissDeleteConfirmation() {
        _uiState.value = _uiState.value.copy(showDeleteConfirmation = null)
    }

    fun deleteClient(clientId: String) {
        viewModelScope.launch {
            try {
                invoiceRepository.deleteClient(clientId)
                _uiState.value = _uiState.value.copy(
                    showDeleteConfirmation = null,
                    showSnackbar = "Client deleted",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to delete: ${e.message}",
                )
            }
        }
    }

    fun dismissSnackbar() {
        _uiState.value = _uiState.value.copy(showSnackbar = null)
    }
}
