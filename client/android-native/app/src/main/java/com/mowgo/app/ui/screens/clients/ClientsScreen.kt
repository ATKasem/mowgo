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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.R
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Lead
import com.mowgo.app.data.model.LeadStatus
import com.mowgo.app.ui.theme.MowGoColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClientsScreen(viewModel: ClientsViewModel = viewModel(), onViewPlans: () -> Unit = {}) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.showSnackbar) {
        state.showSnackbar?.let { snackbar.showSnackbar(it); viewModel.dismissSnackbar() }
    }

    state.showDeleteConfirmation?.let { client -> ConfirmDialog(stringResource(R.string.clients_delete_client_title), stringResource(R.string.clients_delete_client_body, client.name), state.isMutating, { viewModel.dismissDeleteConfirmation() }) { viewModel.deleteClient(client.id) } }
    state.leadToDelete?.let { lead -> ConfirmDialog(stringResource(R.string.clients_delete_lead_title), stringResource(R.string.clients_delete_lead_body, lead.name), state.isMutating, { viewModel.dismissDeleteLead() }) { viewModel.deleteLead(lead) } }
    state.leadToConvert?.let { lead -> ConfirmDialog(stringResource(R.string.clients_convert_lead_title), stringResource(R.string.clients_convert_lead_body, lead.name), state.isMutating, { viewModel.dismissConvertLead() }, stringResource(R.string.clients_convert), isDestructive = false) { viewModel.convertLead(lead) } }

    if (state.showUpgradePrompt) {
        AlertDialog(
            onDismissRequest = viewModel::dismissUpgradePrompt,
            title = { Text(stringResource(R.string.clients_upgrade_title)) },
            text = { Text(stringResource(R.string.clients_upgrade_body)) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissUpgradePrompt(); onViewPlans() }) { Text(stringResource(R.string.clients_view_plans)) }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissUpgradePrompt) { Text(stringResource(R.string.clients_not_now)) }
            },
        )
    }

    if (state.showNewClientDialog) ClientFormDialog(stringResource(R.string.clients_new_client_title), onDismiss = viewModel::dismissNewClientDialog, onSave = viewModel::createClient)
    if (state.showNewLeadDialog) NewLeadDialog(state.isMutating, viewModel::dismissNewLeadDialog, viewModel::createLead)
    state.editingClient?.let { editing ->
        ClientFormDialog(stringResource(R.string.clients_edit_client_title), editing, viewModel::dismissEditClientDialog) { name, address, phone, rate, keyCode, pets ->
            viewModel.updateClient(editing.copy(name = name, address = address, phone = phone, rate = rate, keyCode = keyCode, petInstructions = pets))
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = { FloatingActionButton(viewModel::showNewDialog, containerColor = MaterialTheme.colorScheme.secondary) { Icon(Icons.Filled.Add, if (state.segment == ClientSegment.CLIENTS) stringResource(R.string.clients_new_client_title) else stringResource(R.string.clients_new_lead_cd)) } },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                ClientSegment.entries.forEachIndexed { index, segment ->
                    SegmentedButton(
                        selected = state.segment == segment,
                        onClick = { viewModel.selectSegment(segment) },
                        shape = SegmentedButtonDefaults.itemShape(index, ClientSegment.entries.size),
                        label = { Text(if (segment == ClientSegment.CLIENTS) stringResource(R.string.clients_tab_clients) else stringResource(R.string.clients_tab_leads)) },
                        colors = SegmentedButtonDefaults.colors(activeContainerColor = MaterialTheme.colorScheme.secondary, activeContentColor = MowGoColors.OnAccent),
                    )
                }
            }
            PullToRefreshBox(state.isLoading, viewModel::refresh, Modifier.fillMaxSize()) {
                when {
                    state.isLoading && state.clients.isEmpty() && state.leads.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MaterialTheme.colorScheme.secondary) }
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
    if (clients.isEmpty()) EmptyContent(stringResource(R.string.clients_empty_title), stringResource(R.string.clients_empty_detail), Icons.Filled.Groups)
    else LazyColumn(contentPadding = PaddingValues(bottom = 80.dp)) { items(clients, key = { it.id }) { ClientCard(it, { viewModel.showEditClientDialog(it) }, { viewModel.confirmDeleteClient(it) }) } }
}

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun LeadList(leads: List<Lead>, viewModel: ClientsViewModel) {
    if (leads.isEmpty()) { EmptyContent(stringResource(R.string.clients_leads_empty_title), stringResource(R.string.clients_leads_empty_detail), Icons.Filled.PersonSearch); return }
    val uriHandler = LocalUriHandler.current
    LazyColumn(contentPadding = PaddingValues(bottom = 80.dp)) {
        items(leads, key = { it.id }) { lead ->
            var statusMenu by remember(lead.id) { mutableStateOf(false) }
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp).combinedClickable(onClick = {}, onLongClick = { if (lead.status == LeadStatus.LOST.value) viewModel.confirmDeleteLead(lead) }),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(12.dp),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(lead.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold)
                            // Straggler: lead.source is a raw data key (e.g. "walk_in"); displaying it
                            // localized would require a source-key → label translation table.
                            SuggestionChip(onClick = {}, label = { Text(lead.source.replace('_', ' ').replaceFirstChar { it.uppercase() }) })
                        }
                        Box {
                            AssistChip(onClick = { statusMenu = true }, label = { Text(LeadStatus.from(lead.status).displayName) }, trailingIcon = { Icon(Icons.Filled.ArrowDropDown, null) })
                            DropdownMenu(statusMenu, { statusMenu = false }, containerColor = MaterialTheme.colorScheme.surface) {
                                LeadStatus.entries.forEach { status -> DropdownMenuItem({ Text(status.displayName) }, { statusMenu = false; viewModel.updateLeadStatus(lead, status) }) }
                            }
                        }
                    }
                    lead.address?.takeIf { it.isNotBlank() }?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        lead.phone?.takeIf { it.isNotBlank() }?.let { phone -> IconButton({ uriHandler.openUri("tel:${phone.filter { it.isDigit() || it == '+' }}") }) { Icon(Icons.Filled.Phone, stringResource(R.string.clients_call_cd, lead.name), tint = MaterialTheme.colorScheme.primary) } }
                        lead.email?.takeIf { it.isNotBlank() }?.let { email -> IconButton({ uriHandler.openUri("mailto:$email") }) { Icon(Icons.Filled.Email, stringResource(R.string.clients_email_cd, lead.name), tint = MaterialTheme.colorScheme.primary) } }
                        Spacer(Modifier.weight(1f))
                        if (LeadStatus.from(lead.status) in setOf(LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTED)) Button({ viewModel.confirmConvertLead(lead) }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) { Text(stringResource(R.string.clients_convert)) }
                        if (lead.status == LeadStatus.LOST.value) IconButton({ viewModel.confirmDeleteLead(lead) }) { Icon(Icons.Filled.Delete, stringResource(R.string.clients_delete_lost_lead_cd), tint = MaterialTheme.colorScheme.error) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ClientCard(client: Client, onEdit: () -> Unit, onDelete: () -> Unit) {
    var expanded by remember(client.id) { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(client.name.firstOrNull()?.uppercase() ?: "?", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(client.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold); client.address?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) } }
                Text("$${String.format("%.0f", client.rate)}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                IconButton({ expanded = !expanded }) { Icon(if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, stringResource(R.string.clients_details_cd)) }
            }
            if (expanded) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onEdit, Modifier.weight(1f)) { Icon(Icons.Filled.Edit, null); Text(stringResource(R.string.action_edit)) }
                OutlinedButton(onDelete, Modifier.weight(1f), colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Icon(Icons.Filled.Delete, null); Text(stringResource(R.string.action_delete)) }
            }
        }
    }
}

@Composable
private fun NewLeadDialog(saving: Boolean, dismiss: () -> Unit, save: (String, String?, String?, String?, String, String?) -> Unit) {
    var name by remember { mutableStateOf("") }; var phone by remember { mutableStateOf("") }; var email by remember { mutableStateOf("") }; var address by remember { mutableStateOf("") }; var notes by remember { mutableStateOf("") }; var source by remember { mutableStateOf("other") }; var sourceMenu by remember { mutableStateOf(false) }
    val sources = listOf("booking_link", "phone", "facebook", "referral", "walk_in", "other")
    AlertDialog(dismiss, title = { Text(stringResource(R.string.clients_new_lead_title)) }, containerColor = MaterialTheme.colorScheme.surface, text = {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            LeadField(name, { name = it }, stringResource(R.string.label_name_required)); LeadField(phone, { phone = it }, stringResource(R.string.label_phone)); LeadField(email, { email = it }, stringResource(R.string.label_email)); LeadField(address, { address = it }, stringResource(R.string.clients_address_label))
            Box { OutlinedButton({ sourceMenu = true }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.clients_source_prefix, source.replace('_', ' ').replaceFirstChar { it.uppercase() })); Spacer(Modifier.weight(1f)); Icon(Icons.Filled.ArrowDropDown, null) }; DropdownMenu(sourceMenu, { sourceMenu = false }) { sources.forEach { item -> DropdownMenuItem({ Text(item.replace('_', ' ').replaceFirstChar { it.uppercase() }) }, { source = item; sourceMenu = false }) } } }
            LeadField(notes, { notes = it }, stringResource(R.string.clients_notes_label), false)
        }
    }, confirmButton = { Button({ save(name.trim(), phone.trim().ifBlank { null }, email.trim().ifBlank { null }, address.trim().ifBlank { null }, source, notes.trim().ifBlank { null }) }, enabled = name.isNotBlank() && !saving) { Text(stringResource(R.string.action_save)) } }, dismissButton = { TextButton(dismiss, enabled = !saving) { Text(stringResource(R.string.action_cancel)) } })
}

@Composable private fun LeadField(value: String, change: (String) -> Unit, label: String, singleLine: Boolean = true) { OutlinedTextField(value, change, Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = singleLine, maxLines = if (singleLine) 1 else 4) }

@Composable
fun ClientFormDialog(title: String, initialClient: Client? = null, onDismiss: () -> Unit, onSave: (String, String?, String?, Double, String?, String?) -> Unit) {
    var name by remember { mutableStateOf(initialClient?.name ?: "") }; var address by remember { mutableStateOf(initialClient?.address ?: "") }; var phone by remember { mutableStateOf(initialClient?.phone ?: "") }; var rate by remember { mutableStateOf(initialClient?.rate?.toString() ?: "") }; var keyCode by remember { mutableStateOf(initialClient?.keyCode ?: "") }; var pets by remember { mutableStateOf(initialClient?.petInstructions ?: "") }
    AlertDialog(onDismiss, title = { Text(title) }, containerColor = MaterialTheme.colorScheme.surface, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { LeadField(name, { name = it }, stringResource(R.string.label_name_required)); LeadField(address, { address = it }, stringResource(R.string.clients_address_label)); LeadField(phone, { phone = it }, stringResource(R.string.label_phone)); LeadField(rate, { rate = it.filter { c -> c.isDigit() || c == '.' } }, stringResource(R.string.clients_rate_label)); LeadField(keyCode, { keyCode = it }, stringResource(R.string.clients_gate_code_label)); LeadField(pets, { pets = it }, stringResource(R.string.clients_pet_instructions_label), false) } }, confirmButton = { Button({ onSave(name.trim(), address.trim().ifBlank { null }, phone.trim().ifBlank { null }, rate.toDoubleOrNull() ?: 0.0, keyCode.trim().ifBlank { null }, pets.trim().ifBlank { null }) }, enabled = name.isNotBlank()) { Text(stringResource(R.string.action_save)) } }, dismissButton = { TextButton(onDismiss) { Text(stringResource(R.string.action_cancel)) } })
}

@Composable
private fun ConfirmDialog(title: String, message: String, busy: Boolean, dismiss: () -> Unit, confirmLabel: String = stringResource(R.string.action_delete), isDestructive: Boolean = true, confirm: () -> Unit) { AlertDialog(dismiss, title = { Text(title) }, text = { Text(message) }, containerColor = MaterialTheme.colorScheme.surface, confirmButton = { Button(confirm, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = if (isDestructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary)) { Text(confirmLabel) } }, dismissButton = { TextButton(dismiss, enabled = !busy) { Text(stringResource(R.string.action_cancel)) } }) }

@Composable
private fun EmptyContent(title: String, detail: String, icon: androidx.compose.ui.graphics.vector.ImageVector) { Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Icon(icon, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.secondary.copy(alpha = .3f)); Text(title, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium); Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant) } }

@Composable
private fun ErrorContent(error: String, retry: () -> Unit) { Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Icon(Icons.Filled.ErrorOutline, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.error); Text(error, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center); Button(retry) { Text(stringResource(R.string.action_retry)) } } }
