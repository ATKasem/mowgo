package com.mowgo.app.ui.screens.clients

import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Lead
import com.mowgo.app.data.model.LeadStatus
import com.mowgo.app.ui.theme.MowGoColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClientsScreen(viewModel: ClientsViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.showSnackbar) {
        state.showSnackbar?.let { snackbar.showSnackbar(it); viewModel.dismissSnackbar() }
    }

    state.showDeleteConfirmation?.let { client -> ConfirmDialog("Delete Client", "Delete \"${client.name}\"? This cannot be undone.", state.isMutating, { viewModel.dismissDeleteConfirmation() }) { viewModel.deleteClient(client.id) } }
    state.leadToDelete?.let { lead -> ConfirmDialog("Delete Lead", "Delete lost lead \"${lead.name}\"?", state.isMutating, { viewModel.dismissDeleteLead() }) { viewModel.deleteLead(lead) } }
    state.leadToConvert?.let { lead -> ConfirmDialog("Convert Lead", "Create a client from \"${lead.name}\"?", state.isMutating, { viewModel.dismissConvertLead() }, "Convert") { viewModel.convertLead(lead) } }

    if (state.showNewClientDialog) ClientFormDialog("New Client", onDismiss = viewModel::dismissNewClientDialog, onSave = viewModel::createClient)
    if (state.showNewLeadDialog) NewLeadDialog(state.isMutating, viewModel::dismissNewLeadDialog, viewModel::createLead)
    state.editingClient?.let { editing ->
        ClientFormDialog("Edit Client", editing, viewModel::dismissEditClientDialog) { name, address, phone, rate, keyCode, pets ->
            viewModel.updateClient(editing.copy(name = name, address = address, phone = phone, rate = rate, keyCode = keyCode, petInstructions = pets))
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = { FloatingActionButton(viewModel::showNewDialog, containerColor = MowGoColors.DeepGreenDark) { Icon(Icons.Filled.Add, if (state.segment == ClientSegment.CLIENTS) "New Client" else "New Lead") } },
        containerColor = MowGoColors.BackgroundDark,
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                ClientSegment.entries.forEachIndexed { index, segment ->
                    SegmentedButton(
                        selected = state.segment == segment,
                        onClick = { viewModel.selectSegment(segment) },
                        shape = SegmentedButtonDefaults.itemShape(index, ClientSegment.entries.size),
                        label = { Text(if (segment == ClientSegment.CLIENTS) "Clients" else "Leads") },
                        colors = SegmentedButtonDefaults.colors(activeContainerColor = MowGoColors.DeepGreenDark, activeContentColor = MowGoColors.OnAccent),
                    )
                }
            }
            PullToRefreshBox(state.isLoading, viewModel::refresh, Modifier.fillMaxSize()) {
                when {
                    state.isLoading && state.clients.isEmpty() && state.leads.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MowGoColors.DeepGreenDark) }
                    state.error != null && state.clients.isEmpty() && state.leads.isEmpty() -> ErrorContent(state.error!!, viewModel::refresh)
                    state.segment == ClientSegment.CLIENTS -> ClientList(state.clients, viewModel)
                    else -> LeadList(state.leads, viewModel)
                }
            }
        }
    }
}

@Composable
private fun ClientList(clients: List<Client>, viewModel: ClientsViewModel) {
    if (clients.isEmpty()) EmptyContent("No clients yet", "Add your first client to get started.", Icons.Filled.Groups)
    else LazyColumn(contentPadding = PaddingValues(bottom = 80.dp)) { items(clients, key = { it.id }) { ClientCard(it, { viewModel.showEditClientDialog(it) }, { viewModel.confirmDeleteClient(it) }) } }
}

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun LeadList(leads: List<Lead>, viewModel: ClientsViewModel) {
    if (leads.isEmpty()) { EmptyContent("No leads yet", "Add a lead to start building your pipeline.", Icons.Filled.PersonSearch); return }
    val uriHandler = LocalUriHandler.current
    LazyColumn(contentPadding = PaddingValues(bottom = 80.dp)) {
        items(leads, key = { it.id }) { lead ->
            var statusMenu by remember(lead.id) { mutableStateOf(false) }
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp).combinedClickable(onClick = {}, onLongClick = { if (lead.status == LeadStatus.LOST.value) viewModel.confirmDeleteLead(lead) }),
                colors = CardDefaults.cardColors(containerColor = MowGoColors.SurfaceDark), shape = RoundedCornerShape(12.dp),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(lead.name, color = MowGoColors.TextPrimaryDark, fontWeight = FontWeight.SemiBold)
                            SuggestionChip(onClick = {}, label = { Text(lead.source.replace('_', ' ').replaceFirstChar { it.uppercase() }) })
                        }
                        Box {
                            AssistChip(onClick = { statusMenu = true }, label = { Text(LeadStatus.from(lead.status).displayName) }, trailingIcon = { Icon(Icons.Filled.ArrowDropDown, null) })
                            DropdownMenu(statusMenu, { statusMenu = false }, containerColor = MowGoColors.SurfaceDark) {
                                LeadStatus.entries.forEach { status -> DropdownMenuItem({ Text(status.displayName) }, { statusMenu = false; viewModel.updateLeadStatus(lead, status) }) }
                            }
                        }
                    }
                    lead.address?.takeIf { it.isNotBlank() }?.let { Text(it, color = MowGoColors.TextSecondaryDark, style = MaterialTheme.typography.bodySmall) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        lead.phone?.takeIf { it.isNotBlank() }?.let { phone -> IconButton({ uriHandler.openUri("tel:${phone.filter { it.isDigit() || it == '+' }}") }) { Icon(Icons.Filled.Phone, "Call ${lead.name}", tint = MowGoColors.BrandGreenDark) } }
                        lead.email?.takeIf { it.isNotBlank() }?.let { email -> IconButton({ uriHandler.openUri("mailto:$email") }) { Icon(Icons.Filled.Email, "Email ${lead.name}", tint = MowGoColors.BrandGreenDark) } }
                        Spacer(Modifier.weight(1f))
                        if (LeadStatus.from(lead.status) in setOf(LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTED)) Button({ viewModel.confirmConvertLead(lead) }, colors = ButtonDefaults.buttonColors(containerColor = MowGoColors.DeepGreenDark)) { Text("Convert") }
                        if (lead.status == LeadStatus.LOST.value) IconButton({ viewModel.confirmDeleteLead(lead) }) { Icon(Icons.Filled.Delete, "Delete lost lead", tint = MowGoColors.DangerDark) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ClientCard(client: Client, onEdit: () -> Unit, onDelete: () -> Unit) {
    var expanded by remember(client.id) { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp), colors = CardDefaults.cardColors(containerColor = MowGoColors.SurfaceDark)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(client.name.firstOrNull()?.uppercase() ?: "?", color = MowGoColors.BrandGreenDark, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(client.name, color = MowGoColors.TextPrimaryDark, fontWeight = FontWeight.SemiBold); client.address?.let { Text(it, color = MowGoColors.TextSecondaryDark, style = MaterialTheme.typography.bodySmall) } }
                Text("$${String.format("%.0f", client.rate)}", color = MowGoColors.BrandGreenDark, fontWeight = FontWeight.Bold)
                IconButton({ expanded = !expanded }) { Icon(if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, "Details") }
            }
            if (expanded) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onEdit, Modifier.weight(1f)) { Icon(Icons.Filled.Edit, null); Text("Edit") }
                OutlinedButton(onDelete, Modifier.weight(1f), colors = ButtonDefaults.outlinedButtonColors(contentColor = MowGoColors.DangerDark)) { Icon(Icons.Filled.Delete, null); Text("Delete") }
            }
        }
    }
}

@Composable
private fun NewLeadDialog(saving: Boolean, dismiss: () -> Unit, save: (String, String?, String?, String?, String, String?) -> Unit) {
    var name by remember { mutableStateOf("") }; var phone by remember { mutableStateOf("") }; var email by remember { mutableStateOf("") }; var address by remember { mutableStateOf("") }; var notes by remember { mutableStateOf("") }; var source by remember { mutableStateOf("other") }; var sourceMenu by remember { mutableStateOf(false) }
    val sources = listOf("referral", "website", "google", "facebook", "yard_sign", "booking_link", "other")
    AlertDialog(dismiss, title = { Text("New Lead") }, containerColor = MowGoColors.SurfaceDark, text = {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            LeadField(name, { name = it }, "Name *"); LeadField(phone, { phone = it }, "Phone"); LeadField(email, { email = it }, "Email"); LeadField(address, { address = it }, "Address")
            Box { OutlinedButton({ sourceMenu = true }, Modifier.fillMaxWidth()) { Text("Source: ${source.replace('_', ' ').replaceFirstChar { it.uppercase() }}"); Spacer(Modifier.weight(1f)); Icon(Icons.Filled.ArrowDropDown, null) }; DropdownMenu(sourceMenu, { sourceMenu = false }) { sources.forEach { item -> DropdownMenuItem({ Text(item.replace('_', ' ').replaceFirstChar { it.uppercase() }) }, { source = item; sourceMenu = false }) } } }
            LeadField(notes, { notes = it }, "Notes", false)
        }
    }, confirmButton = { Button({ save(name.trim(), phone.trim().ifBlank { null }, email.trim().ifBlank { null }, address.trim().ifBlank { null }, source, notes.trim().ifBlank { null }) }, enabled = name.isNotBlank() && !saving) { Text("Save") } }, dismissButton = { TextButton(dismiss, enabled = !saving) { Text("Cancel") } })
}

@Composable private fun LeadField(value: String, change: (String) -> Unit, label: String, singleLine: Boolean = true) { OutlinedTextField(value, change, Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = singleLine, maxLines = if (singleLine) 1 else 4) }

@Composable
fun ClientFormDialog(title: String, initialClient: Client? = null, onDismiss: () -> Unit, onSave: (String, String?, String?, Double, String?, String?) -> Unit) {
    var name by remember { mutableStateOf(initialClient?.name ?: "") }; var address by remember { mutableStateOf(initialClient?.address ?: "") }; var phone by remember { mutableStateOf(initialClient?.phone ?: "") }; var rate by remember { mutableStateOf(initialClient?.rate?.toString() ?: "") }; var keyCode by remember { mutableStateOf(initialClient?.keyCode ?: "") }; var pets by remember { mutableStateOf(initialClient?.petInstructions ?: "") }
    AlertDialog(onDismiss, title = { Text(title) }, containerColor = MowGoColors.SurfaceDark, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { LeadField(name, { name = it }, "Name *"); LeadField(address, { address = it }, "Address"); LeadField(phone, { phone = it }, "Phone"); LeadField(rate, { rate = it.filter { c -> c.isDigit() || c == '.' } }, "Rate ($)"); LeadField(keyCode, { keyCode = it }, "Gate Code"); LeadField(pets, { pets = it }, "Pet Instructions", false) } }, confirmButton = { Button({ onSave(name.trim(), address.trim().ifBlank { null }, phone.trim().ifBlank { null }, rate.toDoubleOrNull() ?: 0.0, keyCode.trim().ifBlank { null }, pets.trim().ifBlank { null }) }, enabled = name.isNotBlank()) { Text("Save") } }, dismissButton = { TextButton(onDismiss) { Text("Cancel") } })
}

@Composable
private fun ConfirmDialog(title: String, message: String, busy: Boolean, dismiss: () -> Unit, confirmLabel: String = "Delete", confirm: () -> Unit) { AlertDialog(dismiss, title = { Text(title) }, text = { Text(message) }, containerColor = MowGoColors.SurfaceDark, confirmButton = { Button(confirm, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = if (confirmLabel == "Delete") MowGoColors.DangerDark else MowGoColors.DeepGreenDark)) { Text(confirmLabel) } }, dismissButton = { TextButton(dismiss, enabled = !busy) { Text("Cancel") } }) }

@Composable
private fun EmptyContent(title: String, detail: String, icon: androidx.compose.ui.graphics.vector.ImageVector) { Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Icon(icon, null, Modifier.size(64.dp), tint = MowGoColors.DeepGreenDark.copy(alpha = .3f)); Text(title, color = MowGoColors.TextPrimaryDark, style = MaterialTheme.typography.titleMedium); Text(detail, color = MowGoColors.TextSecondaryDark) } }

@Composable
private fun ErrorContent(error: String, retry: () -> Unit) { Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Icon(Icons.Filled.ErrorOutline, null, Modifier.size(64.dp), tint = MowGoColors.DangerDark); Text(error, color = MowGoColors.TextSecondaryDark, textAlign = TextAlign.Center); Button(retry) { Text("Retry") } } }
