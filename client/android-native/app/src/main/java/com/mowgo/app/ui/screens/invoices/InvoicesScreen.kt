package com.mowgo.app.ui.screens.invoices

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import com.mowgo.app.ui.screens.today.ClientPickerDialog
import com.mowgo.app.ui.theme.MowGoColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicesScreen(
    viewModel: InvoicesViewModel = viewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.showSnackbar) {
        state.showSnackbar?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.dismissSnackbar()
        }
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
                onClick = { viewModel.showNewInvoiceDialog() },
                containerColor = MowGoColors.DeepGreenDark,
                contentColor = MowGoColors.OnAccent,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "New Invoice")
            }
        },
        containerColor = MowGoColors.BackgroundDark,
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            if (state.isLoading && state.invoices.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = MowGoColors.DeepGreenDark)
                }
            } else if (state.error != null && state.invoices.isEmpty()) {
                ErrorContent(
                    error = state.error!!,
                    onRetry = { viewModel.refresh() },
                )
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
                            onMarkPaid = { viewModel.confirmMarkPaid(item.invoice) },
                            onDelete = { viewModel.confirmDeleteInvoice(item.invoice) },
                        )
                    }
                }
            }
        }
    }
}

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
                    val clientId = selectedClient?.id ?: return@AlertDialog
                    val amount = amountText.toDoubleOrNull() ?: return@AlertDialog
                    onCreate(clientId, amount)
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
