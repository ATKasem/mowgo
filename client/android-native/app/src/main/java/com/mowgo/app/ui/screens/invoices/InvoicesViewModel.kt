package com.mowgo.app.ui.screens.invoices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.InvoiceRepository
import com.mowgo.app.data.EstimateRepository
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.PaymentRepository
import com.mowgo.app.data.ProfileRepository
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import com.mowgo.app.data.model.Estimate
import com.mowgo.app.data.model.Profile
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
    val estimates: List<Estimate> = emptyList(),
    val clients: List<Client> = emptyList(),
    val profile: Profile? = null,
    val showNewInvoiceDialog: Boolean = false,
    val showNewEstimateDialog: Boolean = false,
    val selectedEstimate: Estimate? = null,
    val showDeleteConfirmation: Invoice? = null,
    val showMarkPaidConfirmation: Invoice? = null,
    val showVoidConfirmation: Invoice? = null,
    val voidingInvoiceId: String? = null,
    val voidSuccess: Boolean = false,
    val voidError: String? = null,
    val showSnackbar: String? = null,
    val payingInvoiceId: String? = null,
    /** Hosted payment page to open (one-shot event for the screen). */
    val pendingPaymentUrl: String? = null,
    /** A payment page was opened; refresh when the user comes back. */
    val awaitingPaymentReturn: Boolean = false,
    val paymentError: String? = null,
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
    val estimatesWithClientName: List<EstimateWithClient> get() {
        val clientMap = clients.associateBy { it.id }
        return estimates.map { EstimateWithClient(it, it.clientName ?: clientMap[it.clientId]?.name) }
    }
}

data class EstimateWithClient(val estimate: Estimate, val clientName: String?)

data class InvoiceWithClient(
    val invoice: Invoice,
    val clientName: String?,
)

class InvoicesViewModel : ViewModel() {

    private val invoiceRepository = InvoiceRepository()
    private val jobRepository = JobRepository()
    private val paymentRepository = PaymentRepository()
    private val estimateRepository = EstimateRepository()
    private var loadGeneration = 0

    private val _uiState = MutableStateFlow(InvoicesUiState())
    val uiState: StateFlow<InvoicesUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        val generation = ++loadGeneration
        viewModelScope.launch {
            if (generation == loadGeneration) _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val invoices = invoiceRepository.loadInvoices()
                val clients = jobRepository.loadClients()
                val estimates = estimateRepository.loadEstimates()
                val profile = ProfileRepository().loadProfile()
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    invoices = invoices,
                    clients = clients,
                    estimates = estimates,
                    profile = profile,
                )
            } catch (e: Exception) {
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load invoices",
                )
            }
        }
    }

    fun refresh() = loadData()

    /**
     * Opens the payment provider's hosted page for this invoice. The invoice is
     * marked paid by the provider's webhook, not by the app — we just refresh
     * when the user returns.
     */
    fun payInvoice(invoice: InvoiceWithClient) {
        if (_uiState.value.payingInvoiceId != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                payingInvoiceId = invoice.invoice.id,
                paymentError = null,
            )
            try {
                val url = paymentRepository.invoicePaymentLink(invoice.invoice.id)
                _uiState.value = _uiState.value.copy(
                    payingInvoiceId = null,
                    pendingPaymentUrl = url,
                )
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    payingInvoiceId = null,
                    paymentError = error.message ?: "Could not open the payment page.",
                )
                // e.g. "already paid" — pull fresh state.
                loadData()
            }
        }
    }

    fun paymentUrlOpened() {
        _uiState.value = _uiState.value.copy(pendingPaymentUrl = null, awaitingPaymentReturn = true)
    }

    fun paymentUrlFailed(message: String) {
        _uiState.value = _uiState.value.copy(pendingPaymentUrl = null, paymentError = message)
    }

    fun onReturnedFromPayment() {
        if (!_uiState.value.awaitingPaymentReturn) return
        _uiState.value = _uiState.value.copy(awaitingPaymentReturn = false)
        loadData()
    }

    fun dismissPaymentError() {
        _uiState.value = _uiState.value.copy(paymentError = null)
    }

    fun showNewInvoiceDialog() {
        _uiState.value = _uiState.value.copy(showNewInvoiceDialog = true)
    }

    fun dismissNewInvoiceDialog() {
        _uiState.value = _uiState.value.copy(showNewInvoiceDialog = false)
    }

    // ── Payment request texts (mirror web: Zelle first — clients default to
    // the first option listed; only configured methods appear) ───────────

    private fun payMethods(profile: Profile?): List<String> {
        if (profile == null) return emptyList()
        val parts = mutableListOf<String>()
        profile.zelleHandle?.trim()?.takeIf { it.isNotBlank() }?.let {
            parts += "Zelle: $it"
        }
        profile.venmoHandle?.trim()?.removePrefix("@")?.takeIf { it.isNotBlank() }?.let {
            parts += "Venmo: @$it"
        }
        profile.cashappHandle?.trim()?.removePrefix("$")?.takeIf { it.isNotBlank() }?.let {
            parts += "Cash App: $$it"
        }
        return parts
    }

    fun invoicePayLine(noMethodsText: String, methodsFormat: String): String {
        val methods = payMethods(_uiState.value.profile)
        return if (methods.isEmpty()) {
            noMethodsText
        } else {
            String.format(methodsFormat, methods.joinToString(" · "))
        }
    }

    fun invoiceText(
        invoice: Invoice,
        clientName: String?,
        defaultName: String,
        withDateFormat: String,
        noDateFormat: String,
        payLine: String,
    ): String {
        val name = clientName?.takeIf { it.isNotBlank() } ?: defaultName
        val amount = String.format(java.util.Locale.US, "%.2f", invoice.amount)
        val date = invoice.createdAt?.take(10)?.let { raw ->
            runCatching { java.time.LocalDate.parse(raw).format(java.time.format.DateTimeFormatter.ofPattern("MMM d")) }.getOrNull()
        }
        return if (date != null) {
            String.format(withDateFormat, name, date, amount, payLine)
        } else {
            String.format(noDateFormat, name, amount, payLine)
        }
    }

    fun invoiceNudgeText(
        invoice: Invoice,
        clientName: String?,
        defaultName: String,
        withDateFormat: String,
        noDateFormat: String,
        payLine: String,
    ): String {
        val name = clientName?.takeIf { it.isNotBlank() } ?: defaultName
        val amount = String.format(java.util.Locale.US, "%.2f", invoice.amount)
        val date = invoice.createdAt?.take(10)?.let { raw ->
            runCatching { java.time.LocalDate.parse(raw).format(java.time.format.DateTimeFormatter.ofPattern("MMM d")) }.getOrNull()
        }
        return if (date != null) {
            // Resource order: %1$s=name, %2$s=amount, %3$s=date, %4$s=payLine
            String.format(withDateFormat, name, amount, date, payLine)
        } else {
            String.format(noDateFormat, name, amount, payLine)
        }
    }

    fun createInvoice(
        clientId: String,
        amount: Double,
    ) {
        viewModelScope.launch {
            try {
                // Defense-in-depth: mirror web/iOS caps on manual invoices.
                if (amount <= 0 || amount > 100_000) {
                    _uiState.value = _uiState.value.copy(
                        showSnackbar = "Amount must be between \$0.01 and \$100,000",
                    )
                    return@launch
                }
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

    fun confirmVoidInvoice(invoice: Invoice) {
        _uiState.value = _uiState.value.copy(showVoidConfirmation = invoice)
    }

    fun dismissVoidConfirmation() {
        _uiState.value = _uiState.value.copy(showVoidConfirmation = null)
    }

    fun voidInvoice(invoiceId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(voidingInvoiceId = invoiceId)
            try {
                invoiceRepository.voidInvoice(invoiceId)
                _uiState.value = _uiState.value.copy(
                    showVoidConfirmation = null,
                    voidingInvoiceId = null,
                    voidSuccess = true,
                    voidError = null,
                )
                loadData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    voidingInvoiceId = null,
                    voidError = e.message ?: "unknown",
                )
            }
        }
    }

    fun dismissVoidFeedback() {
        _uiState.value = _uiState.value.copy(voidSuccess = false, voidError = null)
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

    fun showNewEstimateDialog() { _uiState.value = _uiState.value.copy(showNewEstimateDialog = true) }
    fun dismissNewEstimateDialog() { _uiState.value = _uiState.value.copy(showNewEstimateDialog = false) }
    fun selectEstimate(estimate: Estimate?) { _uiState.value = _uiState.value.copy(selectedEstimate = estimate) }

    fun createEstimate(clientId: String, amount: Double, note: String?, send: Boolean) {
        val generation = ++loadGeneration
        viewModelScope.launch {
            try {
                estimateRepository.createEstimate(Estimate(clientId = clientId, amount = amount, note = note), send)
                if (generation == loadGeneration) {
                    _uiState.value = _uiState.value.copy(showNewEstimateDialog = false, showSnackbar = if (send) "Estimate sent" else "Draft saved")
                    loadData()
                }
            } catch (e: Exception) { if (generation == loadGeneration) _uiState.value = _uiState.value.copy(showSnackbar = "Failed to save: ${e.message}") }
        }
    }

    fun updateEstimateStatus(id: String, status: String) {
        val generation = ++loadGeneration
        viewModelScope.launch {
            try {
                val updated = estimateRepository.updateEstimateStatus(id, status)
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(estimates = _uiState.value.estimates.map { if (it.id == id) updated ?: it else it }, selectedEstimate = updated)
            } catch (e: Exception) { if (generation == loadGeneration) _uiState.value = _uiState.value.copy(showSnackbar = "Failed to update: ${e.message}") }
        }
    }

    fun convertEstimate(estimate: Estimate) {
        val generation = ++loadGeneration
        viewModelScope.launch {
            try {
                val updated = estimateRepository.convertEstimateToJob(estimate)
                if (generation == loadGeneration) _uiState.value = _uiState.value.copy(estimates = _uiState.value.estimates.map { if (it.id == estimate.id) updated ?: it else it }, selectedEstimate = updated, showSnackbar = "Job created")
            } catch (e: Exception) { if (generation == loadGeneration) _uiState.value = _uiState.value.copy(showSnackbar = "Failed to convert: ${e.message}") }
        }
    }
}
