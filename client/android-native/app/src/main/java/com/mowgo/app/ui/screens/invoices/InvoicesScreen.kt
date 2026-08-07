package com.mowgo.app.ui.screens.invoices

import android.content.Context
import android.content.ContextWrapper
import android.content.ClipData
import android.content.ClipboardManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import com.mowgo.app.R
import com.mowgo.app.data.SupabaseClientProvider
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import com.mowgo.app.data.model.Estimate
import com.mowgo.app.ui.screens.today.ClientPickerDialog
import com.mowgo.app.ui.theme.MowGoColors
import com.mowgo.app.ui.theme.extendedColors
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult
import java.time.Instant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicesScreen(
    viewModel: InvoicesViewModel = viewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showingEstimates by rememberSaveable { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val paymentRecoverErrorText = stringResource(R.string.invoices_payment_recover_error)
    val paymentFailedGenericText = stringResource(R.string.invoices_payment_failed_generic)
    val paymentSheetErrorText = stringResource(R.string.invoices_payment_sheet_error)
    val paymentTextCopiedText = stringResource(R.string.invoices_payment_text_copied)
    val reminderCopiedText = stringResource(R.string.invoices_reminder_copied)
    val invoiceDefaultClientName = stringResource(R.string.invoices_default_client_name)
    val payLineNoMethodsText = stringResource(R.string.invoices_pay_line_no_methods)
    val payLineMethodsFormat = stringResource(R.string.invoices_pay_line_methods_format)
    val invoiceMsgServicedWithDate = stringResource(R.string.invoices_msg_serviced_with_date)
    val invoiceMsgServicedNoDate = stringResource(R.string.invoices_msg_serviced_no_date)
    val invoiceMsgNudgeWithDate = stringResource(R.string.invoices_msg_nudge_with_date)
    val invoiceMsgNudgeNoDate = stringResource(R.string.invoices_msg_nudge_no_date)
    val paymentSheet = activity?.let { hostActivity ->
        remember(hostActivity) {
            PaymentSheet.Builder { result ->
                val payment = viewModel.uiState.value.pendingPayment
                when (result) {
                    is PaymentSheetResult.Completed -> {
                        if (payment != null) {
                            viewModel.paymentCompleted(payment)
                        } else {
                            viewModel.paymentFailed(paymentRecoverErrorText)
                        }
                    }
                    is PaymentSheetResult.Canceled -> viewModel.paymentCanceled()
                    is PaymentSheetResult.Failed -> viewModel.paymentFailed(
                        result.error.localizedMessage ?: paymentFailedGenericText,
                    )
                }
            }.build(hostActivity)
        }
    }

    LaunchedEffect(state.showSnackbar) {
        state.showSnackbar?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.dismissSnackbar()
        }
    }

    LaunchedEffect(state.paymentError, state.isPaymentConfirmationPending) {
        if (!state.isPaymentConfirmationPending) {
            state.paymentError?.let { message ->
                snackbarHostState.showSnackbar(message)
                viewModel.dismissPaymentError()
            }
        }
    }

    LaunchedEffect(state.pendingPayment) {
        val payment = state.pendingPayment
        if (payment != null && !state.isPaymentSheetPresenting && !state.isPaymentConfirmationPending) {
            if (paymentSheet == null) {
                viewModel.paymentFailed(paymentSheetErrorText)
            } else {
                viewModel.paymentSheetPresented()
                paymentSheet.presentWithPaymentIntent(
                    payment.clientSecret,
                    PaymentSheet.Configuration.Builder(merchantDisplayName = "MowGo").build(),
                )
            }
        }
    }

    if (state.isPaymentConfirmationPending && state.paymentError != null) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissPendingPayment() },
            title = { Text(stringResource(R.string.invoices_confirm_payment_title)) },
            text = { Text(state.paymentError!!) },
            confirmButton = {
                TextButton(onClick = { viewModel.retryConfirmPayment() }) {
                    Text(stringResource(R.string.action_retry))
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissPendingPayment() }) {
                    Text(stringResource(R.string.action_dismiss))
                }
            },
        )
    }

    // Delete confirmation dialog
    state.showDeleteConfirmation?.let { invoice ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissDeleteConfirmation() },
            title = { Text(stringResource(R.string.invoices_delete_title), color = MaterialTheme.colorScheme.onSurface) },
            text = {
                Text(
                    text = stringResource(R.string.invoices_delete_body, String.format("%.2f", invoice.amount)),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            containerColor = MaterialTheme.colorScheme.surface,
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteInvoice(invoice.id) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text(stringResource(R.string.action_delete))
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissDeleteConfirmation() }) {
                    Text(stringResource(R.string.action_cancel), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
        )
    }

    // Mark paid confirmation dialog
    state.showMarkPaidConfirmation?.let { invoice ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissMarkPaidConfirmation() },
            title = { Text(stringResource(R.string.invoices_mark_paid_title), color = MaterialTheme.colorScheme.onSurface) },
            text = {
                Text(
                    text = stringResource(R.string.invoices_mark_paid_body, String.format("%.2f", invoice.amount)),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            containerColor = MaterialTheme.colorScheme.surface,
            confirmButton = {
                Button(
                    onClick = { viewModel.markInvoicePaid(invoice.id) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondary,
                    ),
                ) {
                    Text(stringResource(R.string.invoices_mark_paid))
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissMarkPaidConfirmation() }) {
                    Text(stringResource(R.string.action_cancel), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
        )
    }

    // Void invoice confirmation dialog
    state.showVoidConfirmation?.let { invoice ->
        AlertDialog(
            onDismissRequest = {
                if (state.voidingInvoiceId == null) viewModel.dismissVoidConfirmation()
            },
            title = { Text(stringResource(R.string.invoices_void_title), color = MaterialTheme.colorScheme.onSurface) },
            text = {
                Text(
                    text = stringResource(R.string.invoices_void_body, String.format(java.util.Locale.US, "%.2f", invoice.amount)),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            containerColor = MaterialTheme.colorScheme.surface,
            confirmButton = {
                Button(
                    onClick = { viewModel.voidInvoice(invoice.id) },
                    enabled = state.voidingInvoiceId == null,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text(stringResource(R.string.invoices_void), color = MaterialTheme.colorScheme.onError)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { viewModel.dismissVoidConfirmation() },
                    enabled = state.voidingInvoiceId == null,
                ) {
                    Text(stringResource(R.string.action_cancel), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
        )
    }

    val voidSnackbarText = stringResource(R.string.invoices_void_snackbar)
    val voidFailedText = state.voidError?.let { stringResource(R.string.invoices_void_failed, it) }
    LaunchedEffect(state.voidSuccess, state.voidError) {
        if (state.voidSuccess) {
            snackbarHostState.showSnackbar(voidSnackbarText)
            viewModel.dismissVoidFeedback()
        }
        voidFailedText?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.dismissVoidFeedback()
        }
    }

    // New invoice dialog
    if (state.showNewInvoiceDialog) {
        NewInvoiceDialog(
            clients = state.clients,
            onDismiss = { viewModel.dismissNewInvoiceDialog() },
            onCreate = { clientId, amount ->
                viewModel.createInvoice(clientId, amount)
            },
        )
    }

    if (state.showNewEstimateDialog) {
        NewEstimateDialog(
            clients = state.clients,
            onDismiss = { viewModel.dismissNewEstimateDialog() },
            onSave = { clientId, amount, note, send -> viewModel.createEstimate(clientId, amount, note, send) },
        )
    }

    state.selectedEstimate?.let { estimate ->
        EstimateDetailDialog(
            estimate = estimate,
            clientName = state.estimatesWithClientName.firstOrNull { it.estimate.id == estimate.id }?.clientName,
            onDismiss = { viewModel.selectEstimate(null) },
            onStatus = { status -> viewModel.updateEstimateStatus(estimate.id, status) },
            onConvert = { viewModel.convertEstimate(estimate) },
        )
    }

    Scaffold(
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = MaterialTheme.colorScheme.secondary,
                    contentColor = MowGoColors.OnAccent,
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { if (showingEstimates) viewModel.showNewEstimateDialog() else viewModel.showNewInvoiceDialog() },
                containerColor = MaterialTheme.colorScheme.secondary,
                contentColor = MowGoColors.OnAccent,
            ) {
                Icon(Icons.Filled.Add, contentDescription = if (showingEstimates) stringResource(R.string.invoices_new_estimate_cd) else stringResource(R.string.invoices_new_invoice_cd))
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = !showingEstimates, onClick = { showingEstimates = false }, label = { Text(stringResource(R.string.invoices_tab_invoices)) }, modifier = Modifier.weight(1f))
                FilterChip(selected = showingEstimates, onClick = { showingEstimates = true }, label = { Text(stringResource(R.string.invoices_tab_estimates)) }, modifier = Modifier.weight(1f))
            }
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier
                .fillMaxSize()
                .weight(1f),
        ) {
            if (state.isLoading && state.invoices.isEmpty() && state.estimates.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.secondary)
                }
            } else if (state.error != null && state.invoices.isEmpty() && state.estimates.isEmpty()) {
                ErrorContent(
                    error = state.error!!,
                    onRetry = { viewModel.refresh() },
                )
            } else if (showingEstimates) {
                if (state.estimates.isEmpty()) EstimateEmptyContent() else LazyColumn(contentPadding = PaddingValues(bottom = 80.dp)) {
                    items(items = state.estimatesWithClientName, key = { it.estimate.id }) { item ->
                        EstimateCard(estimate = item.estimate, clientName = item.clientName, onClick = { viewModel.selectEstimate(item.estimate) })
                    }
                }
            } else if (state.invoices.isEmpty()) {
                EmptyContent()
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 80.dp),
                ) {
                    // Summary header
                    item {
                        InvoiceSummaryHeader(
                            unpaidCount = state.unpaidCount,
                            totalUnpaid = state.totalUnpaid,
                        )
                    }

                    items(
                        items = state.invoicesWithClientName,
                        key = { it.invoice.id },
                    ) { item ->
                        InvoiceCard(
                            invoice = item.invoice,
                            clientName = item.clientName,
                            isPaying = state.payingInvoiceId == item.invoice.id,
                            payEnabled = state.payingInvoiceId == null,
                            showPay = SupabaseClientProvider.isConfigured,
                            onPay = { viewModel.payInvoice(item) },
                            onMarkPaid = { viewModel.confirmMarkPaid(item.invoice) },
                            onDelete = { viewModel.confirmDeleteInvoice(item.invoice) },
                            onVoid = { viewModel.confirmVoidInvoice(item.invoice) },
                            onCopyText = {
                                val payLine = viewModel.invoicePayLine(payLineNoMethodsText, payLineMethodsFormat)
                                clipboard.setText(AnnotatedString(viewModel.invoiceText(item.invoice, item.clientName, invoiceDefaultClientName, invoiceMsgServicedWithDate, invoiceMsgServicedNoDate, payLine)))
                                scope.launch { snackbarHostState.showSnackbar(paymentTextCopiedText) }
                            },
                            onNudge = {
                                val payLine = viewModel.invoicePayLine(payLineNoMethodsText, payLineMethodsFormat)
                                clipboard.setText(AnnotatedString(viewModel.invoiceNudgeText(item.invoice, item.clientName, invoiceDefaultClientName, invoiceMsgNudgeWithDate, invoiceMsgNudgeNoDate, payLine)))
                                scope.launch { snackbarHostState.showSnackbar(reminderCopiedText) }
                            },
                        )
                    }
                }
            }
        }
        }
    }
}

@Composable
private fun EstimateCard(estimate: Estimate, clientName: String?, onClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).clickable(onClick = onClick), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(12.dp)) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(clientName ?: stringResource(R.string.label_unknown_client), color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold)
                estimate.createdAt?.let { Text(it.take(10), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                estimate.note?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1) }
                if (estimate.jobId != null) Text(stringResource(R.string.invoices_converted), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.extendedColors.success)
            }
            EstimateStatusChip(estimate.status)
            Spacer(Modifier.width(10.dp))
            Text("$${String.format("%.2f", estimate.amount)}", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun EstimateStatusChip(status: String) {
    val color = when (status) { Estimate.STATUS_SENT -> MaterialTheme.extendedColors.info; Estimate.STATUS_APPROVED -> MaterialTheme.extendedColors.success; Estimate.STATUS_DECLINED -> MaterialTheme.colorScheme.error; else -> MaterialTheme.colorScheme.onSurfaceVariant }
    Surface(shape = RoundedCornerShape(8.dp), color = color.copy(alpha = .15f)) { Text(status.replaceFirstChar { it.uppercase() }, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = color) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewEstimateDialog(clients: List<Client>, onDismiss: () -> Unit, onSave: (String, Double, String?, Boolean) -> Unit) {
    val context = LocalContext.current
    val estimateMsgFormat = stringResource(R.string.invoices_estimate_msg_format)
    var selected by remember { mutableStateOf<Client?>(null) }; var amount by remember { mutableStateOf("") }; var note by remember { mutableStateOf("") }; var picker by remember { mutableStateOf(false) }
    if (picker) ClientPickerDialog(clients = clients, onSelect = { selected = it; amount = it.rate.toString(); picker = false }, onDismiss = { picker = false })
    AlertDialog(onDismissRequest = onDismiss, title = { Text(stringResource(R.string.invoices_new_estimate_title), color = MaterialTheme.colorScheme.onSurface) }, containerColor = MaterialTheme.colorScheme.surface,
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(value = selected?.name ?: "", onValueChange = {}, label = { Text(stringResource(R.string.label_client_required)) }, readOnly = true, enabled = false, modifier = Modifier.fillMaxWidth().clickable { picker = true }, colors = OutlinedTextFieldDefaults.colors(disabledTextColor = MaterialTheme.colorScheme.onSurface, disabledBorderColor = MaterialTheme.colorScheme.onSurfaceVariant))
            OutlinedTextField(value = amount, onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text(stringResource(R.string.label_amount_required)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text(stringResource(R.string.invoices_note_optional)) }, modifier = Modifier.fillMaxWidth())
        } },
        confirmButton = { Button(onClick = { val client = selected; val value = amount.toDoubleOrNull(); if (client != null && value != null) { val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager; clipboard.setPrimaryClip(ClipData.newPlainText("Estimate", String.format(estimateMsgFormat, client.name, String.format("%.2f", value)))); onSave(client.id, value, note.ifBlank { null }, true) } }, enabled = selected != null && amount.toDoubleOrNull() != null) { Text(stringResource(R.string.invoices_send)) } },
        dismissButton = { Row { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) }; TextButton(onClick = { val client = selected; val value = amount.toDoubleOrNull(); if (client != null && value != null) onSave(client.id, value, note.ifBlank { null }, false) }, enabled = selected != null && amount.toDoubleOrNull() != null) { Text(stringResource(R.string.invoices_save_draft)) } } })
}

@Composable
private fun EstimateDetailDialog(estimate: Estimate, clientName: String?, onDismiss: () -> Unit, onStatus: (String) -> Unit, onConvert: () -> Unit) {
    val context = LocalContext.current
    val copiedText = stringResource(R.string.action_copied)
    val copy: (String) -> Unit = { value -> val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager; clipboard.setPrimaryClip(ClipData.newPlainText("Estimate", value)); Toast.makeText(context, copiedText, Toast.LENGTH_SHORT).show() }
    val estimateMsgFormat = stringResource(R.string.invoices_estimate_msg_format)
    val estimateNudgeFormat = stringResource(R.string.invoices_estimate_nudge_format)
    val defaultClientName = stringResource(R.string.invoices_default_client_name)
    val name = clientName ?: defaultClientName; val amount = String.format("%.2f", estimate.amount)
    val estimateMessage = String.format(estimateMsgFormat, name, amount)
    val canNudge = estimate.status == Estimate.STATUS_SENT && estimate.sentAt?.let { runCatching { Instant.parse(it).isBefore(Instant.now().minusSeconds(3 * 86400)) }.getOrDefault(false) } == true
    AlertDialog(onDismissRequest = onDismiss, title = { Text(stringResource(R.string.invoices_estimate_title), color = MaterialTheme.colorScheme.onSurface) }, containerColor = MaterialTheme.colorScheme.surface,
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            EstimateCard(estimate, clientName, onClick = {})
            TextButton(onClick = { copy(estimateMessage) }) { Text(stringResource(R.string.invoices_copy_estimate_text)) }
            if (canNudge) TextButton(onClick = { copy(String.format(estimateNudgeFormat, name, amount, estimate.sentAt?.take(10) ?: "")) }) { Text(stringResource(R.string.invoices_nudge), color = MaterialTheme.extendedColors.warning) }
            if (estimate.status == Estimate.STATUS_DRAFT || estimate.status == Estimate.STATUS_SENT) { TextButton(onClick = { onStatus(Estimate.STATUS_APPROVED) }) { Text(stringResource(R.string.invoices_mark_approved)) }; TextButton(onClick = { onStatus(Estimate.STATUS_DECLINED) }) { Text(stringResource(R.string.invoices_mark_declined), color = MaterialTheme.colorScheme.error) } }
            if (estimate.status == Estimate.STATUS_APPROVED && estimate.jobId == null) Button(onClick = onConvert) { Text(stringResource(R.string.invoices_convert_to_job)) }
            if (estimate.jobId != null) Text(stringResource(R.string.invoices_converted), color = MaterialTheme.extendedColors.success)
        } }, confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_close)) } })
}

@Composable
private fun EstimateEmptyContent() { Column(modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Icon(Icons.Filled.Description, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.secondary.copy(alpha = .3f)); Text(stringResource(R.string.invoices_estimates_empty_title), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium); Text(stringResource(R.string.invoices_estimates_empty_detail), color = MaterialTheme.colorScheme.onSurfaceVariant) } }

// ── Summary Header ──────────────────────────────────────────────────────

@Composable
private fun InvoiceSummaryHeader(
    unpaidCount: Int,
    totalUnpaid: Double,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    text = stringResource(R.string.invoices_outstanding),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = stringResource(R.string.invoices_unpaid_count, unpaidCount),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = stringResource(R.string.invoices_total_due),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "$${String.format("%.2f", totalUnpaid)}",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.extendedColors.warning,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

// ── Invoice Card ────────────────────────────────────────────────────────

@Composable
private fun InvoiceCard(
    invoice: Invoice,
    clientName: String?,
    isPaying: Boolean,
    payEnabled: Boolean,
    showPay: Boolean,
    onPay: () -> Unit,
    onMarkPaid: () -> Unit,
    onDelete: () -> Unit,
    onVoid: (() -> Unit)? = null,
    onCopyText: (() -> Unit)? = null,
    onNudge: (() -> Unit)? = null,
) {
    var expanded by remember { mutableStateOf(false) }
    val isPaid = invoice.status == Invoice.STATUS_PAID
    val isVoided = invoice.status == Invoice.STATUS_VOIDED
    val canNudge = !isPaid && !isVoided && onNudge != null && (invoice.createdAt?.let { raw ->
        runCatching {
            java.time.Instant.parse(raw)
                .isBefore(java.time.Instant.now().minus(java.time.Duration.ofDays(3)))
        }.getOrDefault(false)
    } ?: false)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable { expanded = !expanded },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Invoice icon
                Icon(
                    imageVector = Icons.Filled.Receipt,
                    contentDescription = null,
                    modifier = Modifier.size(32.dp),
                    tint = if (isPaid) MaterialTheme.extendedColors.success else MaterialTheme.extendedColors.warning,
                )

                Spacer(modifier = Modifier.width(12.dp))

                // Client + date info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = clientName ?: stringResource(R.string.label_unknown_client),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.SemiBold,
                    )
                    invoice.createdAt?.let { date ->
                        Text(
                            text = formatDate(date),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                // Amount + status chip
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "$${String.format("%.2f", invoice.amount)}",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    InvoiceStatusChip(status = invoice.status)
                }
            }

            // Expandable actions
            if (expanded) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))

                // Paid-at info
                if (isPaid && invoice.paidAt != null) {
                    Row(
                        modifier = Modifier.padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.CheckCircle,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.extendedColors.success,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = stringResource(R.string.invoices_paid_on, formatDate(invoice.paidAt)),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.extendedColors.success,
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (!isPaid && !isVoided) {
                        onCopyText?.let { copyText ->
                            OutlinedButton(
                                onClick = copyText,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    contentColor = MaterialTheme.colorScheme.secondary,
                                ),
                                border = ButtonDefaults.outlinedButtonBorder.copy(
                                    brush = androidx.compose.ui.graphics.SolidColor(
                                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.5f),
                                    ),
                                ),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(8.dp),
                            ) {
                                Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(stringResource(R.string.invoices_copy_text), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                        if (canNudge) {
                            OutlinedButton(
                                onClick = { onNudge?.invoke() },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    contentColor = MaterialTheme.extendedColors.warning,
                                ),
                                border = ButtonDefaults.outlinedButtonBorder.copy(
                                    brush = androidx.compose.ui.graphics.SolidColor(
                                        MaterialTheme.extendedColors.warning.copy(alpha = 0.5f),
                                    ),
                                ),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(8.dp),
                            ) {
                                Text(stringResource(R.string.invoices_nudge), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                        if (invoice.status == Invoice.STATUS_UNPAID || invoice.status == Invoice.STATUS_OVERDUE) {
                            if (onVoid != null) {
                                OutlinedButton(
                                    onClick = onVoid,
                                    modifier = Modifier.weight(1f),
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        contentColor = MaterialTheme.colorScheme.error,
                                    ),
                                    border = ButtonDefaults.outlinedButtonBorder.copy(
                                        brush = androidx.compose.ui.graphics.SolidColor(
                                            MaterialTheme.colorScheme.error.copy(alpha = 0.5f),
                                        ),
                                    ),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                    shape = RoundedCornerShape(8.dp),
                                ) {
                                    Text(stringResource(R.string.invoices_void), style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        if (showPay) {
                            Button(
                                onClick = onPay,
                                enabled = payEnabled,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.secondary,
                                    contentColor = MowGoColors.OnAccent,
                                ),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(8.dp),
                            ) {
                                if (isPaying) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                        color = MowGoColors.OnAccent,
                                    )
                                } else {
                                    Icon(Icons.Filled.CreditCard, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(stringResource(R.string.invoices_pay), style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        if (!isVoided) {
                            OutlinedButton(
                                onClick = onMarkPaid,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    contentColor = MaterialTheme.colorScheme.secondary,
                                ),
                                border = ButtonDefaults.outlinedButtonBorder.copy(
                                    brush = androidx.compose.ui.graphics.SolidColor(
                                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.5f),
                                    ),
                                ),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(8.dp),
                            ) {
                                Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(stringResource(R.string.invoices_mark_paid), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                    OutlinedButton(
                        onClick = onDelete,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error,
                        ),
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = androidx.compose.ui.graphics.SolidColor(
                                MaterialTheme.colorScheme.error.copy(alpha = 0.5f),
                            ),
                        ),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(stringResource(R.string.action_delete), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

private tailrec fun Context.findActivity(): ComponentActivity? = when (this) {
    is ComponentActivity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

// ── Invoice Status Chip ─────────────────────────────────────────────────

@Composable
private fun InvoiceStatusChip(status: String) {
    val (text, color) = when (status) {
        Invoice.STATUS_PAID -> stringResource(R.string.invoices_status_paid) to MaterialTheme.extendedColors.success
        Invoice.STATUS_UNPAID -> stringResource(R.string.invoices_status_unpaid) to MaterialTheme.extendedColors.warning
        Invoice.STATUS_OVERDUE -> stringResource(R.string.invoices_status_overdue) to MaterialTheme.colorScheme.error
        else -> status to MaterialTheme.colorScheme.onSurfaceVariant
    }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.15f),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Medium,
        )
    }
}

// ── New Invoice Dialog ──────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewInvoiceDialog(
    clients: List<Client>,
    onDismiss: () -> Unit,
    onCreate: (clientId: String, amount: Double) -> Unit,
) {
    var selectedClient by remember { mutableStateOf<Client?>(null) }
    var amountText by remember { mutableStateOf("") }
    var showClientPicker by remember { mutableStateOf(false) }

    if (showClientPicker) {
        ClientPickerDialog(
            clients = clients,
            onSelect = { client ->
                selectedClient = client
                showClientPicker = false
            },
            onDismiss = { showClientPicker = false },
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(R.string.invoices_new_invoice_title),
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )
        },
        containerColor = MaterialTheme.colorScheme.surface,
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // Client picker
                OutlinedTextField(
                    value = selectedClient?.name ?: "",
                    onValueChange = {},
                    label = { Text(stringResource(R.string.label_client_required)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showClientPicker = true },
                    readOnly = true,
                    enabled = false,
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledBorderColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        disabledTextColor = MaterialTheme.colorScheme.onSurface,
                    ),
                )

                // Amount
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text(stringResource(R.string.label_amount_required)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.secondary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        focusedLabelColor = MaterialTheme.colorScheme.secondary,
                        cursorColor = MaterialTheme.colorScheme.secondary,
                        focusedTextColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                    ),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val clientId = selectedClient?.id
                    val amount = amountText.toDoubleOrNull()
                    if (clientId != null && amount != null) {
                        onCreate(clientId, amount)
                    }
                },
                enabled = selectedClient != null && amountText.toDoubleOrNull() != null,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.secondary,
                ),
            ) {
                Text(stringResource(R.string.action_create))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
    )
}

// ── Helper ──────────────────────────────────────────────────────────────

private fun formatDate(isoDate: String): String {
    return try {
        val instant = Instant.parse(isoDate)
        val formatter = java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy")
            .withZone(java.time.ZoneId.systemDefault())
        formatter.format(instant)
    } catch (_: Exception) {
        isoDate.take(10)
    }
}

// ── Empty State ─────────────────────────────────────────────────────────

@Composable
private fun EmptyContent() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Receipt,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.secondary.copy(alpha = 0.3f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.invoices_empty_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = stringResource(R.string.invoices_empty_detail),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

// ── Error State ─────────────────────────────────────────────────────────

@Composable
private fun ErrorContent(
    error: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.5f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.error_generic_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = error,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondary,
            ),
        ) {
            Text(stringResource(R.string.action_retry))
        }
    }
}
