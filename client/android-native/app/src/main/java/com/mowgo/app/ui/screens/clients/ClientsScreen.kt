package com.mowgo.app.ui.screens.clients

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
import com.mowgo.app.ui.theme.MowGoColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClientsScreen(
    viewModel: ClientsViewModel = viewModel(),
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
    state.showDeleteConfirmation?.let { client ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissDeleteConfirmation() },
            title = { Text("Delete Client", color = MowGoColors.TextPrimaryDark) },
            text = {
                Text(
                    text = "Delete \"${client.name}\"? This cannot be undone.",
                    color = MowGoColors.TextSecondaryDark,
                )
            },
            containerColor = MowGoColors.SurfaceDark,
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteClient(client.id) },
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

    // New client dialog
    if (state.showNewClientDialog) {
        ClientFormDialog(
            title = "New Client",
            onDismiss = { viewModel.dismissNewClientDialog() },
            onSave = { name, address, phone, rate, keyCode, petInstructions ->
                viewModel.createClient(name, address, phone, rate, keyCode, petInstructions)
            },
        )
    }

    // Edit client dialog
    state.editingClient?.let { editing ->
        ClientFormDialog(
            title = "Edit Client",
            initialClient = editing,
            onDismiss = { viewModel.dismissEditClientDialog() },
            onSave = { name, address, phone, rate, keyCode, petInstructions ->
                viewModel.updateClient(
                    editing.copy(
                        name = name,
                        address = address,
                        phone = phone,
                        rate = rate,
                        keyCode = keyCode,
                        petInstructions = petInstructions,
                    )
                )
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
                onClick = { viewModel.showNewClientDialog() },
                containerColor = MowGoColors.DeepGreenDark,
                contentColor = MowGoColors.OnAccent,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "New Client")
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
            if (state.isLoading && state.clients.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = MowGoColors.DeepGreenDark)
                }
            } else if (state.error != null && state.clients.isEmpty()) {
                ErrorContent(
                    error = state.error!!,
                    onRetry = { viewModel.refresh() },
                )
            } else if (state.clients.isEmpty()) {
                EmptyContent()
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 80.dp),
                ) {
                    item {
                        Text(
                            text = "Clients",
                            style = MaterialTheme.typography.titleLarge,
                            color = MowGoColors.TextPrimaryDark,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                    items(
                        items = state.clients,
                        key = { it.id },
                    ) { client ->
                        ClientCard(
                            client = client,
                            onEdit = { viewModel.showEditClientDialog(client) },
                            onDelete = { viewModel.confirmDeleteClient(client) },
                        )
                    }
                }
            }
        }
    }
}

// ── Client Card ─────────────────────────────────────────────────────────

@Composable
private fun ClientCard(
    client: Client,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }

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
                // Avatar circle with initial
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .then(
                            Modifier.fillMaxSize()
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Surface(
                        modifier = Modifier.size(40.dp),
                        shape = RoundedCornerShape(20.dp),
                        color = MowGoColors.DeepGreenDark.copy(alpha = 0.2f),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = client.name.firstOrNull()?.uppercase() ?: "?",
                                style = MaterialTheme.typography.titleMedium,
                                color = MowGoColors.DeepGreenDark,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Client info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = client.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = MowGoColors.TextPrimaryDark,
                        fontWeight = FontWeight.SemiBold,
                    )
                    client.address?.let { addr ->
                        Text(
                            text = addr,
                            style = MaterialTheme.typography.bodySmall,
                            color = MowGoColors.TextSecondaryDark,
                        )
                    }
                }

                // Rate
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "$${String.format("%.0f", client.rate)}",
                        style = MaterialTheme.typography.titleMedium,
                        color = MowGoColors.DeepGreenDark,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            // Expandable details
            if (expanded) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = MowGoColors.ElevatedDark)
                Spacer(modifier = Modifier.height(8.dp))

                // Phone
                client.phone?.let { phone ->
                    DetailRow(icon = Icons.Filled.Phone, label = "Phone", value = phone)
                }

                // Gate code
                client.keyCode?.let { code ->
                    DetailRow(icon = Icons.Filled.Key, label = "Gate Code", value = code)
                }

                // Pet instructions
                client.petInstructions?.let { pets ->
                    DetailRow(icon = Icons.Filled.Pets, label = "Pets", value = pets)
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = onEdit,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MowGoColors.InfoDark,
                        ),
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = androidx.compose.ui.graphics.SolidColor(
                                MowGoColors.InfoDark.copy(alpha = 0.5f),
                            ),
                        ),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Edit", style = MaterialTheme.typography.labelSmall)
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

@Composable
private fun DetailRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MowGoColors.TextSecondaryDark,
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "$label: ",
            style = MaterialTheme.typography.bodySmall,
            color = MowGoColors.TextSecondaryDark,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = MowGoColors.TextPrimaryDark,
        )
    }
}

// ── Client Form Dialog ──────────────────────────────────────────────────

@Composable
private fun ClientFormDialog(
    title: String,
    initialClient: Client? = null,
    onDismiss: () -> Unit,
    onSave: (name: String, address: String?, phone: String?, rate: Double, keyCode: String?, petInstructions: String?) -> Unit,
) {
    var name by remember { mutableStateOf(initialClient?.name ?: "") }
    var address by remember { mutableStateOf(initialClient?.address ?: "") }
    var phone by remember { mutableStateOf(initialClient?.phone ?: "") }
    var rateText by remember { mutableStateOf(if (initialClient != null) String.format("%.0f", initialClient.rate) else "") }
    var keyCode by remember { mutableStateOf(initialClient?.keyCode ?: "") }
    var petInstructions by remember { mutableStateOf(initialClient?.petInstructions ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = title,
                color = MowGoColors.TextPrimaryDark,
                fontWeight = FontWeight.Bold,
            )
        },
        containerColor = MowGoColors.SurfaceDark,
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name *") },
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
                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it },
                    label = { Text("Address") },
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
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone") },
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
                OutlinedTextField(
                    value = rateText,
                    onValueChange = { rateText = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Rate ($)") },
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
                OutlinedTextField(
                    value = keyCode,
                    onValueChange = { keyCode = it },
                    label = { Text("Gate Code") },
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
                OutlinedTextField(
                    value = petInstructions,
                    onValueChange = { petInstructions = it },
                    label = { Text("Pet Instructions") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
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
                    val rate = rateText.toDoubleOrNull() ?: 0.0
                    onSave(
                        name,
                        address.ifBlank { null },
                        phone.ifBlank { null },
                        rate,
                        keyCode.ifBlank { null },
                        petInstructions.ifBlank { null },
                    )
                },
                enabled = name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MowGoColors.DeepGreenDark,
                ),
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MowGoColors.TextSecondaryDark)
            }
        },
    )
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
            imageVector = Icons.Filled.Groups,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MowGoColors.DeepGreenDark.copy(alpha = 0.3f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No clients yet",
            style = MaterialTheme.typography.titleMedium,
            color = MowGoColors.TextPrimaryDark,
        )
        Text(
            text = "Add your first client to get started.",
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
