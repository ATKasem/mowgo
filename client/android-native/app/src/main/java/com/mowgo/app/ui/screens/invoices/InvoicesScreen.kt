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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.data.SupabaseClientProvider
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import com.mowgo.app.data.model.Estimate
import com.mowgo.app.ui.screens.today.ClientPickerDialog
import com.mowgo.app.ui.theme.MowGoColors
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
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val paymentSheet = activity?.let { hostActivity ->
        remember(hostActivity) {
            PaymentSheet.Builder { result ->
                val payment = viewModel.uiState.value.pendingPayment
                when (result) {
                    is PaymentSheetResult.Completed -> {
                        if (payment != null) {
                            viewModel.paymentCompleted(payment)
                        } else {
                            viewModel.paymentFailed("Could not recover payment confirmation details.")
                        }
                    }
                    is PaymentSheetResult.Canceled -> viewModel.paymentCanceled()
                    is PaymentSheetResult.Failed -> viewModel.paymentFailed(
                        result.error.localizedMessage ?: "Payment failed.",
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
                viewModel.paymentFailed("Could not present payment sheet.")
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
            title = { Text("Confirm Payment") },
            text = { Text(state.paymentError!!) },
            confirmButton = {
                TextButton(onClick = { viewModel.retryConfirmPayment() }) {
                    Text("Retry")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissPendingPayment() }) {
                    Text("Dismiss")
                }
            },
        )
    }

    // Delete confirmation dialog
    state.showDeleteConfirmation?.let { invoice ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissDeleteConfirmation() },
            title = { Text("Delete Invoice", color = MowGoColors.TextPrimaryDark) },
            text = {
                Text(
                    text = "Delete this invoice for $${String.format("%.2f", invoice.amount)}? This cannot be undone.",
                    color = MowGoColors.TextSecondaryDark,
                )
            },
            containerColor = MowGoColors.SurfaceDark,
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteInvoice(invoice.id) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MowGoColors.DangerDark,
                    ),
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissDeleteConfirmation() }) {
                    Text("Cancel", color = MowGoColors.TextSecondaryDark)
                }
            },
        )
    }

    // Mark paid confirmation dialog
    state.showMarkPaidConfirmation?.let { invoice ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissMarkPaidConfirmation() },
            title = { Text("Mark as Paid", color = MowGoColors.TextPrimaryDark) },
            text = {
                Text(
                    text = "Mark invoice for $${String.format("%.2f", invoice.amount)} as paid?",
                    color = MowGoColors.TextSecondaryDark,
                )
            },
            containerColor = MowGoColors.SurfaceDark,
            confirmButton = {
                Button(
                    onClick = { viewModel.markInvoicePaid(invoice.id) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MowGoColors.DeepGreenDark,
                    ),
                ) {
                    Text("Mark Paid")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissMarkPaidConfirmation() }) {
                    Text("Cancel", color = MowGoColors.TextSecondaryDark)
                }
            },
        )
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
                    containerColor = MowGoColors.DeepGreenDark,
                    contentColor = MowGoColors.OnAccent,
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { if (showingEstimates) viewModel.showNewEstimateDialog() else viewModel.showNewInvoiceDialog() },
                containerColor = MowGoColors.DeepGreenDark,
                contentColor = MowGoColors.OnAccent,
            ) {
                Icon(Icons.Filled.Add, contentDescription = if (showingEstimates) "New Estimate" else "New Invoice")
            }
        },
        containerColor = MowGoColors.BackgroundDark,
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = !showingEstimates, onClick = { showingEstimates = false }, label = { Text("Invoices") }, modifier = Modifier.weight(1f))
                FilterChip(selected = showingEstimates, onClick = { showingEstimates = true }, label = { Text("Estimates") }, modifier = Modifier.weight(1f))
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
                    CircularProgressIndicator(color = MowGoColors.DeepGreenDark)
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
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).clickable(onClick = onClick), colors = CardDefaults.cardColors(containerColor = MowGoColors.SurfaceDark), shape = RoundedCornerShape(12.dp)) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(clientName ?: "Unknown Client", color = MowGoColors.TextPrimaryDark, fontWeight = FontWeight.SemiBold)
                estimate.createdAt?.let { Text(it.take(10), style = MaterialTheme.typography.bodySmall, color = MowGoColors.TextSecondaryDark) }
                estimate.note?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MowGoColors.TextSecondaryDark, maxLines = 1) }
                if (estimate.jobId != null) Text("Converted ✓", style = MaterialTheme.typography.labelSmall, color = MowGoColors.SuccessDark)
            }
            EstimateStatusChip(estimate.status)
            Spacer(Modifier.width(10.dp))
            Text("$${String.format("%.2f", estimate.amount)}", color = MowGoColors.TextPrimaryDark, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun EstimateStatusChip(status: String) {
    val color = when (status) { Estimate.STATUS_SENT -> MowGoColors.InfoDark; Estimate.STATUS_APPROVED -> MowGoColors.SuccessDark; Estimate.STATUS_DECLINED -> MowGoColors.DangerDark; else -> MowGoColors.TextSecondaryDark }
    Surface(shape = RoundedCornerShape(8.dp), color = color.copy(alpha = .15f)) { Text(status.replaceFirstChar { it.uppercase() }, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = color) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewEstimateDialog(clients: List<Client>, onDismiss: () -> Unit, onSave: (String, Double, String?, Boolean) -> Unit) {
    val context = LocalContext.current
    var selected by remember { mutableStateOf<Client?>(null) }; var amount by remember { mutableStateOf("") }; var note by remember { mutableStateOf("") }; var picker by remember { mutableStateOf(false) }
    if (picker) ClientPickerDialog(clients = clients, onSelect = { selected = it; amount = it.rate.toString(); picker = false }, onDismiss = { picker = false })
    AlertDialog(onDismissRequest = onDismiss, title = { Text("New Estimate", color = MowGoColors.TextPrimaryDark) }, containerColor = MowGoColors.SurfaceDark,
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(value = selected?.name ?: "", onValueChange = {}, label = { Text("Client *") }, readOnly = true, enabled = false, modifier = Modifier.fillMaxWidth().clickable { picker = true }, colors = OutlinedTextFieldDefaults.colors(disabledTextColor = MowGoColors.TextPrimaryDark, disabledBorderColor = MowGoColors.TextSecondaryDark))
            OutlinedTextField(value = amount, onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Amount ($) *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Note (optional)") }, modifier = Modifier.fillMaxWidth())
        } },
        confirmButton = { Button(onClick = { val client = selected; val value = amount.toDoubleOrNull(); if (client != null && value != null) { val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager; clipboard.setPrimaryClip(ClipData.newPlainText("Estimate", "Hi ${client.name}, here's your estimate: $${String.format("%.2f", value)} for lawn care. Valid for 30 days. Thanks!")); onSave(client.id, value, note.ifBlank { null }, true) } }, enabled = selected != null && amount.toDoubleOrNull() != null) { Text("Send") } },
        dismissButton = { Row { TextButton(onClick = onDismiss) { Text("Cancel") }; TextButton(onClick = { val client = selected; val value = amount.toDoubleOrNull(); if (client != null && value != null) onSave(client.id, value, note.ifBlank { null }, false) }, enabled = selected != null && amount.toDoubleOrNull() != null) { Text("Save Draft") } } })
}

@Composable
private fun EstimateDetailDialog(estimate: Estimate, clientName: String?, onDismiss: () -> Unit, onStatus: (String) -> Unit, onConvert: () -> Unit) {
    val context = LocalContext.current
    val copy: (String) -> Unit = { value -> val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager; clipboard.setPrimaryClip(ClipData.newPlainText("Estimate", value)); Toast.makeText(context, "Copied", Toast.LENGTH_SHORT).show() }
    val name = clientName ?: "there"; val amount = "$${String.format("%.2f", estimate.amount)}"
    val estimateMessage = "Hi $name, here's your estimate: $amount for lawn care. Valid for 30 days. Thanks!"
    val canNudge = estimate.status == Estimate.STATUS_SENT && estimate.sentAt?.let { runCatching { Instant.parse(it).isBefore(Instant.now().minusSeconds(3 * 86400)) }.getOrDefault(false) } == true
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Estimate", color = MowGoColors.TextPrimaryDark) }, containerColor = MowGoColors.SurfaceDark,
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            EstimateCard(estimate, clientName, onClick = {})
            TextButton(onClick = { copy(estimateMessage) }) { Text("Copy estimate text") }
            if (canNudge) TextButton(onClick = { copy("Hi $name, just checking in on your estimate for $amount from ${estimate.sentAt?.take(10)} — still want me to hold the spot? Happy to adjust anything. Thanks!") }) { Text("Nudge", color = MowGoColors.WarningDark) }
            if (estimate.status == Estimate.STATUS_DRAFT || estimate.status == Estimate.STATUS_SENT) { TextButton(onClick = { onStatus(Estimate.STATUS_APPROVED) }) { Text("Mark Approved") }; TextButton(onClick = { onStatus(Estimate.STATUS_DECLINED) }) { Text("Mark Declined", color = MowGoColors.DangerDark) } }
            if (estimate.status == Estimate.STATUS_APPROVED && estimate.jobId == null) Button(onClick = onConvert) { Text("Convert to Job") }
            if (estimate.jobId != null) Text("Converted ✓", color = MowGoColors.SuccessDark)
        } }, confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } })
}

@Composable
private fun EstimateEmptyContent() { Column(modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Icon(Icons.Filled.Description, null, modifier = Modifier.size(64.dp), tint = MowGoColors.DeepGreenDark.copy(alpha = .3f)); Text("No estimates yet", color = MowGoColors.TextPrimaryDark, style = MaterialTheme.typography.titleMedium); Text("Pick a client and send one in 10 seconds", color = MowGoColors.TextSecondaryDark) } }

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
            containerColor = MowGoColors.SurfaceDark,
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
                    text = "Outstanding",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MowGoColors.TextSecondaryDark,
                )
                Text(
                    text = "$unpaidCount unpaid",
                    style = MaterialTheme.typography.titleMedium,
                    color = MowGoColors.TextPrimaryDark,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "Total Due",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MowGoColors.TextSecondaryDark,
                )
                Text(
                    text = "$${String.format("%.2f", totalUnpaid)}",
                    style = MaterialTheme.typography.titleLarge,
                    color = MowGoColors.WarningDark,
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
) {
    var expanded by remember { mutableStateOf(false) }
    val isPaid = invoice.status == Invoice.STATUS_PAID

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable { expanded = !expanded },
        colors = CardDefaults.cardColors(
            containerColor = MowGoColors.SurfaceDark,
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
                    tint = if (isPaid) MowGoColors.SuccessDark else MowGoColors.WarningDark,
                )

                Spacer(modifier = Modifier.width(12.dp))

                // Client + date info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = clientName ?: "Unknown Client",
                        style = MaterialTheme.typography.titleMedium,
                        color = MowGoColors.TextPrimaryDark,
                        fontWeight = FontWeight.SemiBold,
                    )
                    invoice.createdAt?.let { date ->
                        Text(
                            text = formatDate(date),
                            style = MaterialTheme.typography.bodySmall,
                            color = MowGoColors.TextSecondaryDark,
                        )
                    }
                }

                // Amount + status chip
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "$${String.format("%.2f", invoice.amount)}",
                        style = MaterialTheme.typography.titleMedium,
                        color = MowGoColors.TextPrimaryDark,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    InvoiceStatusChip(status = invoice.status)
                }
            }

            // Expandable actions
            if (expanded) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = MowGoColors.ElevatedDark)
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
                            tint = MowGoColors.SuccessDark,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Paid ${formatDate(invoice.paidAt)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MowGoColors.SuccessDark,
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (!isPaid) {
                        if (showPay) {
                            Button(
                                onClick = onPay,
                                enabled = payEnabled,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MowGoColors.DeepGreenDark,
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
                                    Text("Pay", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        OutlinedButton(
                            onClick = onMarkPaid,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MowGoColors.DeepGreenDark,
                            ),
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = androidx.compose.ui.graphics.SolidColor(
                                    MowGoColors.DeepGreenDark.copy(alpha = 0.5f),
                                ),
                            ),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                            shape = RoundedCornerShape(8.dp),
                        ) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Mark Paid", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    OutlinedButton(
                        onClick = onDelete,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MowGoColors.DangerDark,
                        ),
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = androidx.compose.ui.graphics.SolidColor(
                                MowGoColors.DangerDark.copy(alpha = 0.5f),
                            ),
                        ),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Delete", style = MaterialTheme.typography.labelSmall)
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
        Invoice.STATUS_PAID -> "Paid" to MowGoColors.SuccessDark
        Invoice.STATUS_UNPAID -> "Unpaid" to MowGoColors.WarningDark
        else -> status to MowGoColors.TextSecondaryDark
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
                text = "New Invoice",
                color = MowGoColors.TextPrimaryDark,
                fontWeight = FontWeight.Bold,
            )
        },
        containerColor = MowGoColors.SurfaceDark,
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // Client picker
                OutlinedTextField(
                    value = selectedClient?.name ?: "",
                    onValueChange = {},
                    label = { Text("Client *") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showClientPicker = true },
                    readOnly = true,
                    enabled = false,
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledBorderColor = MowGoColors.TextSecondaryDark,
                        disabledLabelColor = MowGoColors.TextSecondaryDark,
                        disabledTextColor = MowGoColors.TextPrimaryDark,
                    ),
                )

                // Amount
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Amount ($) *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MowGoColors.DeepGreenDark,
                        unfocusedBorderColor = MowGoColors.TextSecondaryDark,
                        focusedLabelColor = MowGoColors.DeepGreenDark,
                        cursorColor = MowGoColors.DeepGreenDark,
                        focusedTextColor = MowGoColors.TextPrimaryDark,
                        unfocusedTextColor = MowGoColors.TextPrimaryDark,
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
                    containerColor = MowGoColors.DeepGreenDark,
                ),
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MowGoColors.TextSecondaryDark)
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
            tint = MowGoColors.DeepGreenDark.copy(alpha = 0.3f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No invoices yet",
            style = MaterialTheme.typography.titleMedium,
            color = MowGoColors.TextPrimaryDark,
        )
        Text(
            text = "Create an invoice to start tracking payments.",
            style = MaterialTheme.typography.bodyMedium,
            color = MowGoColors.TextSecondaryDark,
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
            tint = MowGoColors.DangerDark.copy(alpha = 0.5f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Something went wrong",
            style = MaterialTheme.typography.titleMedium,
            color = MowGoColors.TextPrimaryDark,
        )
        Text(
            text = error,
            style = MaterialTheme.typography.bodyMedium,
            color = MowGoColors.TextSecondaryDark,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(
                containerColor = MowGoColors.DeepGreenDark,
            ),
        ) {
            Text("Retry")
        }
    }
}
