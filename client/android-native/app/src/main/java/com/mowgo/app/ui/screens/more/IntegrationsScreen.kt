package com.mowgo.app.ui.screens.more

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.data.WebhookConfig
import com.mowgo.app.data.WebhookRepository
import kotlinx.coroutines.launch

private data class WebhookEvent(val key: String, val title: String, val detail: String)
private val availableWebhookEvents = listOf(
    WebhookEvent("job.created", "Job Created", "New job scheduled"),
    WebhookEvent("job.updated", "Job Updated", "Status, date, or details change"),
    WebhookEvent("job.completed", "Job Completed", "Status changes to done"),
    WebhookEvent("invoice.paid", "Invoice Paid", "Invoice is marked paid"),
    WebhookEvent("customer.created", "Customer Created", "New client added"),
    WebhookEvent("payment.failed", "Payment Failed", "Stripe payment fails"),
    WebhookEvent("rain.delay.applied", "Rain Delay Applied", "Jobs rescheduled due to rain"),
    WebhookEvent("job.skipped", "Job Skipped", "Job is skipped"),
    WebhookEvent("lead.created", "Lead Created", "New lead added"),
    WebhookEvent("lead.status.updated", "Lead Status Updated", "Lead status changes"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IntegrationsScreen(back: () -> Unit, viewModel: IntegrationsViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var editing by remember { mutableStateOf<WebhookConfig?>(null) }
    var deleting by remember { mutableStateOf<WebhookConfig?>(null) }
    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); viewModel.clearMessage() } }

    deleting?.let { config ->
        AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Delete Endpoint?") },
            text = { Text("This endpoint will stop receiving MowGo events.") },
            confirmButton = { TextButton(onClick = { viewModel.delete(config.id); deleting = null }) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } })
    }
    editing?.let { config ->
        WebhookEditorDialog(config, state.isSaving, { editing = null },
            { viewModel.save(it) { editing = null } },
            { current -> viewModel.regenerate(current) { editing = it } }, snackbar)
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, topBar = {
        TopAppBar(title = { Text("Integrations") }, navigationIcon = { IconButton(onClick = back) { Icon(Icons.Default.ArrowBack, "Back") } })
    }) { padding ->
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Send MowGo events to Zapier, Make, n8n, or any HTTPS endpoint that accepts POST JSON.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = { editing = WebhookConfig(secret = WebhookRepository.generateSecret()) }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Add, null); Spacer(Modifier.width(8.dp)); Text("Add Endpoint")
            }
            if (state.isLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (!state.isLoading && state.configs.isEmpty()) Card(Modifier.fillMaxWidth()) { Text("No webhook endpoints yet.", Modifier.padding(24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
            state.configs.forEach { config ->
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row { Icon(Icons.Default.Bolt, null, tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(8.dp));
                        Text(config.label?.takeIf { it.isNotBlank() } ?: "Untitled endpoint", fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Switch(config.isActive, { viewModel.toggle(config, it) }) }
                    Text(config.url, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${config.events.size} event${if (config.events.size == 1) "" else "s"}", style = MaterialTheme.typography.labelMedium)
                    Text(config.events.joinToString(" · "), maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        TextButton(onClick = { editing = config }) { Text("Edit") }
                        TextButton(onClick = { deleting = config }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                    }
                } }
            }
        }
    }
}

@Composable
private fun WebhookEditorDialog(config: WebhookConfig, saving: Boolean, cancel: () -> Unit,
    save: (WebhookConfig) -> Unit, regenerate: (WebhookConfig) -> Unit, snackbar: SnackbarHostState) {
    var draft by remember(config) { mutableStateOf(config) }
    var reveal by remember { mutableStateOf(false) }
    var confirmRegenerate by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val validUrl = remember(draft.url) { runCatching { java.net.URI(draft.url.trim()) }.getOrNull()?.let { it.scheme == "https" && !it.host.isNullOrBlank() } == true }
    if (confirmRegenerate) AlertDialog(onDismissRequest = { confirmRegenerate = false }, title = { Text("Generate a new secret?") },
        text = { Text("Your old secret will stop working immediately.") },
        confirmButton = { TextButton(onClick = { confirmRegenerate = false; regenerate(draft) }) { Text("Regenerate", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { confirmRegenerate = false }) { Text("Cancel") } })
    AlertDialog(onDismissRequest = cancel, title = { Text(if (draft.id.isBlank()) "Add Endpoint" else "Edit Endpoint") },
        text = { Column(Modifier.fillMaxWidth().heightIn(max = 560.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(draft.label.orEmpty(), { draft = draft.copy(label = it) }, label = { Text("Label (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(draft.url, { draft = draft.copy(url = it) }, label = { Text("HTTPS webhook URL") }, singleLine = true, isError = draft.url.isNotEmpty() && !validUrl, supportingText = { if (draft.url.isNotEmpty() && !validUrl) Text("Enter a valid HTTPS URL") }, modifier = Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth()) { Text(if (reveal) draft.secret else "•".repeat(32), fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f));
                IconButton(onClick = { reveal = !reveal }) { Icon(if (reveal) Icons.Default.VisibilityOff else Icons.Default.Visibility, "Reveal secret") }
                IconButton(onClick = { clipboard.setText(AnnotatedString(draft.secret)); scope.launch { snackbar.showSnackbar("Secret copied") } }) { Icon(Icons.Default.ContentCopy, "Copy secret") } }
            TextButton(onClick = { confirmRegenerate = true }) { Icon(Icons.Default.Refresh, null); Spacer(Modifier.width(6.dp)); Text("Regenerate Secret") }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("Events", fontWeight = FontWeight.SemiBold); TextButton(onClick = { draft = draft.copy(events = if (draft.events.size == availableWebhookEvents.size) emptyList() else availableWebhookEvents.map { it.key }) }) { Text(if (draft.events.size == availableWebhookEvents.size) "Deselect All" else "Select All") } }
            availableWebhookEvents.forEach { event -> Row(Modifier.fillMaxWidth().clickable { draft = draft.copy(events = if (draft.events.contains(event.key)) draft.events - event.key else draft.events + event.key) }.padding(vertical = 4.dp)) {
                Checkbox(draft.events.contains(event.key), { checked -> draft = draft.copy(events = if (checked) draft.events + event.key else draft.events - event.key) });
                Column { Text(event.title); Text(event.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
        } },
        confirmButton = { TextButton(onClick = { save(draft.copy(url = draft.url.trim(), label = draft.label?.trim())) }, enabled = validUrl && !saving) { Text(if (saving) "Saving…" else "Save") } },
        dismissButton = { TextButton(onClick = cancel) { Text("Cancel") } })
}
