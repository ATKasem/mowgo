package com.mowgo.app.ui.screens.invoices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.InvoiceRepository
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * UI state for the Invoices screen.
 */
data class InvoicesUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val invoices: List<Invoice> = emptyList(),
    val clients: List<Client> = emptyList(),
    val showNewInvoiceDialog: Boolean = false,
    val showDeleteConfirmation: Invoice? = null,
    val showMarkPaidConfirmation: Invoice? = null,
    val showSnackbar: String? = null,
) {
    /** Invoices enriched with client names for display. */
    val invoicesWithClientName: List<InvoiceWithClient>
        get() {
            val clientMap = clients.associateBy { it.id }
            return invoices.map { invoice ->
                InvoiceWithClient(
                    invoice = invoice,
                    clientName = clientMap[invoice.clientId]?.name,
                )
            }
        }

    val unpaidCount: Int get() = invoices.count { it.status == Invoice.STATUS_UNPAID }
    val paidCount: Int get() = invoices.count { it.status == Invoice.STATUS_PAID }
    val totalUnpaid: Double get() = invoices.filter { it.status == Invoice.STATUS_UNPAID }.sumOf { it.amount }
}

data class InvoiceWithClient(
    val invoice: Invoice,
    val clientName: String?,
)

class InvoicesViewModel : ViewModel() {

    private val invoiceRepository = InvoiceRepository()
    private val jobRepository = JobRepository()

    private val _uiState = MutableStateFlow(InvoicesUiState())
    val uiState: StateFlow<InvoicesUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val invoices = invoiceRepository.loadInvoices()
                val clients = jobRepository.loadClients()
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    invoices = invoices,
                    clients = clients,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load invoices",
                )
            }
        }
    }

    fun refresh() = loadData()

    fun showNewInvoiceDialog() {
        _uiState.value = _uiState.value.copy(showNewInvoiceDialog = true)
    }

    fun dismissNewInvoiceDialog() {
        _uiState.value = _uiState.value.copy(showNewInvoiceDialog = false)
    }

    fun createInvoice(
        clientId: String,
        amount: Double,
    ) {
        viewModelScope.launch {
            try {
                val invoice = Invoice(
                    clientId = clientId,
                    amount = amount,
                    status = Invoice.STATUS_UNPAID,
                )
                invoiceRepository.createInvoice(invoice)
                _uiState.value = _uiState.value.copy(
                    showNewInvoiceDialog = false,
                    showSnackbar = "Invoice created",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to create: ${e.message}",
                )
            }
        }
    }

    fun confirmMarkPaid(invoice: Invoice) {
        _uiState.value = _uiState.value.copy(showMarkPaidConfirmation = invoice)
    }

    fun dismissMarkPaidConfirmation() {
        _uiState.value = _uiState.value.copy(showMarkPaidConfirmation = null)
    }

    fun markInvoicePaid(invoiceId: String) {
        viewModelScope.launch {
            try {
                invoiceRepository.markInvoicePaid(invoiceId)
                _uiState.value = _uiState.value.copy(
                    showMarkPaidConfirmation = null,
                    showSnackbar = "Invoice marked as paid",
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showSnackbar = "Failed to update: ${e.message}",
                )
            }
        }
    }

    fun confirmDeleteInvoice(invoice: Invoice) {
        _uiState.value = _uiState.value.copy(showDeleteConfirmation = invoice)
    }

    fun dismissDeleteConfirmation() {
        _uiState.value = _uiState.value.copy(showDeleteConfirmation = null)
    }

    fun deleteInvoice(invoiceId: String) {
        viewModelScope.launch {
            try {
                invoiceRepository.deleteInvoice(invoiceId)
                _uiState.value = _uiState.value.copy(
                    showDeleteConfirmation = null,
                    showSnackbar = "Invoice deleted",
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
