package com.mowgo.app.ui.screens.more

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.R
import com.mowgo.app.data.AuthRepository
import com.mowgo.app.data.WebhookConfig
import com.mowgo.app.data.WebhookRepository
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private data class WebhookEvent(val key: String, val titleRes: Int, val detailRes: Int)
private val availableWebhookEvents = listOf(
    WebhookEvent("job.created", R.string.integrations_event_job_created_title, R.string.integrations_event_job_created_detail),
    WebhookEvent("job.updated", R.string.integrations_event_job_updated_title, R.string.integrations_event_job_updated_detail),
    WebhookEvent("job.completed", R.string.integrations_event_job_completed_title, R.string.integrations_event_job_completed_detail),
    WebhookEvent("invoice.paid", R.string.integrations_event_invoice_paid_title, R.string.integrations_event_invoice_paid_detail),
    WebhookEvent("customer.created", R.string.integrations_event_customer_created_title, R.string.integrations_event_customer_created_detail),
    WebhookEvent("payment.failed", R.string.integrations_event_payment_failed_title, R.string.integrations_event_payment_failed_detail),
    WebhookEvent("rain.delay.applied", R.string.integrations_event_rain_delay_title, R.string.integrations_event_rain_delay_detail),
    WebhookEvent("job.skipped", R.string.integrations_event_job_skipped_title, R.string.integrations_event_job_skipped_detail),
    WebhookEvent("lead.created", R.string.integrations_event_lead_created_title, R.string.integrations_event_lead_created_detail),
    WebhookEvent("lead.status.updated", R.string.integrations_event_lead_status_title, R.string.integrations_event_lead_status_detail),
)

private data class QboState(
    val connected: Boolean = false,
    val companyName: String? = null,
    val lastSyncedAt: String? = null,
    val loading: Boolean = true,
    val syncing: Boolean = false,
    val error: String? = null,
)

private const val QBO_BASE_URL = "https://mowgoapp.com/api/integrations"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IntegrationsScreen(back: () -> Unit, viewModel: IntegrationsViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var editing by remember { mutableStateOf<WebhookConfig?>(null) }
    var deleting by remember { mutableStateOf<WebhookConfig?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var qboState by remember { mutableStateOf(QboState()) }
    var showDisconnectDialog by remember { mutableStateOf(false) }

    // Fetch QBO status on launch
    LaunchedEffect(Unit) {
        try {
            val auth = AuthRepository(context.applicationContext)
            val session = auth.currentSession
            val token = session?.accessToken ?: return@LaunchedEffect
            val conn = java.net.URL("$QBO_BASE_URL/qbo-status").openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Accept", "application/json")
            conn.connectTimeout = 10000
            val responseCode = conn.responseCode
            if (responseCode == 200) {
                val body = conn.inputStream.bufferedReader().readText()
                val json = JSONObject(body)
                qboState = QboState(
                    connected = json.optBoolean("connected", false),
                    companyName = json.optString("companyName", null),
                    lastSyncedAt = json.optString("lastSyncedAt", null),
                    loading = false,
                )
            } else {
                qboState = QboState(loading = false)
            }
            conn.disconnect()
        } catch (e: Exception) {
            qboState = QboState(loading = false, error = e.message)
        }
    }

    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); viewModel.clearMessage() } }

    // Disconnect dialog
    if (showDisconnectDialog) {
        AlertDialog(
            onDismissRequest = { showDisconnectDialog = false },
            title = { Text(stringResource(R.string.qbo_disconnect)) },
            text = { Text(stringResource(R.string.qbo_disconnect_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    showDisconnectDialog = false
                    scope.launch {
                        try {
                            val auth = AuthRepository(context.applicationContext)
                            val session = auth.currentSession
                            val token = session?.accessToken ?: return@launch
                            val conn = java.net.URL("$QBO_BASE_URL/qbo-disconnect").openConnection() as java.net.HttpURLConnection
                            conn.requestMethod = "POST"
                            conn.setRequestProperty("Authorization", "Bearer $token")
                            conn.connectTimeout = 10000
                            conn.responseCode
                            conn.disconnect()
                            qboState = QboState(loading = false)
                        } catch (_: Exception) {}
                    }
                }) { Text(stringResource(R.string.action_delete), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { showDisconnectDialog = false }) { Text(stringResource(R.string.action_cancel)) } }
        )
    }

    deleting?.let { config ->
        AlertDialog(onDismissRequest = { deleting = null }, title = { Text(stringResource(R.string.integrations_delete_endpoint_title)) },
            text = { Text(stringResource(R.string.integrations_delete_endpoint_body)) },
            confirmButton = { TextButton(onClick = { viewModel.delete(config.id); deleting = null }) { Text(stringResource(R.string.action_delete), color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text(stringResource(R.string.action_cancel)) } })
    }
    editing?.let { config ->
        WebhookEditorDialog(config, state.isSaving, { editing = null },
            { viewModel.save(it) { editing = null } },
            { current -> viewModel.regenerate(current) { editing = it } }, snackbar)
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, topBar = {
        TopAppBar(title = { Text(stringResource(R.string.integrations_title)) }, navigationIcon = { IconButton(onClick = back) { Icon(Icons.Default.ArrowBack, stringResource(R.string.more_back_cd)) } })
    }) { padding ->
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            // === QuickBooks section ===
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            if (qboState.connected) Icons.Default.CheckCircle else Icons.Default.Link,
                            null,
                            tint = if (qboState.connected) androidx.compose.ui.graphics.Color(0xFF22C55E) else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(stringResource(R.string.qbo_integration), fontWeight = FontWeight.SemiBold)
                            Text(
                                if (qboState.connected && qboState.companyName != null)
                                    stringResource(R.string.qbo_connected, qboState.companyName)
                                else stringResource(R.string.qbo_description),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        if (!qboState.loading) {
                            if (qboState.connected) {
                                TextButton(onClick = { showDisconnectDialog = true }) {
                                    Text(stringResource(R.string.qbo_disconnect), color = MaterialTheme.colorScheme.error)
                                }
                            } else {
                                Button(
                                    onClick = {
                                        scope.launch {
                                            try {
                                                qboState = qboState.copy(loading = true)
                                                val auth = AuthRepository(context.applicationContext)
                                                val session = auth.currentSession
                                                val token = session?.accessToken ?: return@launch
                                                val conn = java.net.URL("$QBO_BASE_URL/qbo-connect").openConnection() as java.net.HttpURLConnection
                                                conn.requestMethod = "GET"
                                                conn.setRequestProperty("Authorization", "Bearer $token")
                                                conn.setRequestProperty("Accept", "application/json")
                                                conn.connectTimeout = 10000
                                                if (conn.responseCode == 200) {
                                                    val body = conn.inputStream.bufferedReader().readText()
                                                    val url = JSONObject(body).optString("url", "")
                                                    if (url.isNotEmpty()) {
                                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                                        context.startActivity(intent)
                                                    }
                                                }
                                                conn.disconnect()
                                                qboState = qboState.copy(loading = false)
                                            } catch (e: Exception) {
                                                qboState = qboState.copy(loading = false, error = e.message)
                                            }
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color(0xFF22C55E))
                                ) {
                                    Text(stringResource(R.string.qbo_connect))
                                }
                            }
                        }
                    }

                    if (qboState.connected) {
                        HorizontalDivider()
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                stringResource(R.string.qbo_last_synced, qboState.lastSyncedAt?.let {
                                    try {
                                        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                                        val date = fmt.parse(it.substringBefore("."))
                                        SimpleDateFormat("M/d/yy h:mm a", Locale.US).format(date ?: Date())
                                    } catch (_: Exception) { it }
                                } ?: stringResource(R.string.qbo_never)),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.weight(1f)
                            )
                            if (qboState.syncing) {
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                TextButton(onClick = {
                                    scope.launch {
                                        qboState = qboState.copy(syncing = true, error = null)
                                        try {
                                            val auth = AuthRepository(context.applicationContext)
                                            val session = auth.currentSession
                                            val token = session?.accessToken ?: return@launch
                                            val conn = java.net.URL("$QBO_BASE_URL/qbo-sync").openConnection() as java.net.HttpURLConnection
                                            conn.requestMethod = "POST"
                                            conn.setRequestProperty("Authorization", "Bearer $token")
                                            conn.setRequestProperty("Content-Type", "application/json")
                                            conn.doOutput = true
                                            conn.connectTimeout = 10000
                                            conn.outputStream.write("{}".toByteArray())
                                            val code = conn.responseCode
                                            conn.disconnect()
                                            if (code == 200) {
                                                qboState = qboState.copy(syncing = false)
                                                scope.launch { snackbar.showSnackbar(stringResource(R.string.qbo_sync_success)) }
                                                // Refresh status
                                                val statusConn = java.net.URL("$QBO_BASE_URL/qbo-status").openConnection() as java.net.HttpURLConnection
                                                statusConn.requestMethod = "GET"
                                                statusConn.setRequestProperty("Authorization", "Bearer $token")
                                                statusConn.connectTimeout = 10000
                                                if (statusConn.responseCode == 200) {
                                                    val body = statusConn.inputStream.bufferedReader().readText()
                                                    val json = JSONObject(body)
                                                    qboState = qboState.copy(
                                                        connected = json.optBoolean("connected"),
                                                        companyName = json.optString("companyName", null),
                                                        lastSyncedAt = json.optString("lastSyncedAt", null),
                                                    )
                                                }
                                                statusConn.disconnect()
                                            } else {
                                                qboState = qboState.copy(syncing = false)
                                            }
                                        } catch (e: Exception) {
                                            qboState = qboState.copy(syncing = false, error = e.message)
                                        }
                                    }
                                }) { Text(stringResource(R.string.qbo_sync_now)) }
                            }
                        }
                    }

                    if (qboState.error != null) {
                        Text(qboState.error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            // === Webhooks section ===
            Text(stringResource(R.string.integrations_intro), color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = { editing = WebhookConfig(secret = WebhookRepository.generateSecret()) }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Add, null); Spacer(Modifier.width(8.dp)); Text(stringResource(R.string.integrations_add_endpoint))
            }
            if (state.isLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (!state.isLoading && state.configs.isEmpty()) Card(Modifier.fillMaxWidth()) { Text(stringResource(R.string.integrations_no_endpoints), Modifier.padding(24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
            state.configs.forEach { config ->
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row { Icon(Icons.Default.Bolt, null, tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(8.dp));
                        Text(config.label?.takeIf { it.isNotBlank() } ?: stringResource(R.string.integrations_untitled_endpoint), fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Switch(config.isActive, { viewModel.toggle(config, it) }) }
                    Text(config.url, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        stringResource(if (config.events.size == 1) R.string.integrations_event_count_one else R.string.integrations_event_count_other, config.events.size),
                        style = MaterialTheme.typography.labelMedium,
                    )
                    Text(config.events.joinToString(" · "), maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        TextButton(onClick = { editing = config }) { Text(stringResource(R.string.action_edit)) }
                        TextButton(onClick = { deleting = config }) { Text(stringResource(R.string.action_delete), color = MaterialTheme.colorScheme.error) }
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
    val secretCopiedText = stringResource(R.string.integrations_secret_copied)
    if (confirmRegenerate) AlertDialog(onDismissRequest = { confirmRegenerate = false }, title = { Text(stringResource(R.string.integrations_generate_secret_title)) },
        text = { Text(stringResource(R.string.integrations_generate_secret_body)) },
        confirmButton = { TextButton(onClick = { confirmRegenerate = false; regenerate(draft) }) { Text(stringResource(R.string.integrations_regenerate), color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { confirmRegenerate = false }) { Text(stringResource(R.string.action_cancel)) } })
    AlertDialog(onDismissRequest = cancel, title = { Text(if (draft.id.isBlank()) stringResource(R.string.integrations_add_endpoint) else stringResource(R.string.integrations_edit_endpoint_title)) },
        text = { Column(Modifier.fillMaxWidth().heightIn(max = 560.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(draft.label.orEmpty(), { draft = draft.copy(label = it) }, label = { Text(stringResource(R.string.integrations_label_optional)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(draft.url, { draft = draft.copy(url = it) }, label = { Text(stringResource(R.string.integrations_https_url_label)) }, singleLine = true, isError = draft.url.isNotEmpty() && !validUrl, supportingText = { if (draft.url.isNotEmpty() && !validUrl) Text(stringResource(R.string.integrations_invalid_url)) }, modifier = Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth()) { Text(if (reveal) draft.secret else "•".repeat(32), fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f));
                IconButton(onClick = { reveal = !reveal }) { Icon(if (reveal) Icons.Default.VisibilityOff else Icons.Default.Visibility, stringResource(R.string.integrations_reveal_secret_cd)) }
                IconButton(onClick = { clipboard.setText(AnnotatedString(draft.secret)); scope.launch { snackbar.showSnackbar(secretCopiedText) } }) { Icon(Icons.Default.ContentCopy, stringResource(R.string.integrations_copy_secret_cd)) } }
            TextButton(onClick = { confirmRegenerate = true }) { Icon(Icons.Default.Refresh, null); Spacer(Modifier.width(6.dp)); Text(stringResource(R.string.integrations_regenerate_secret)) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(stringResource(R.string.integrations_events_label), fontWeight = FontWeight.SemiBold); TextButton(onClick = { draft = draft.copy(events = if (draft.events.size == availableWebhookEvents.size) emptyList() else availableWebhookEvents.map { it.key }) }) { Text(if (draft.events.size == availableWebhookEvents.size) stringResource(R.string.integrations_deselect_all) else stringResource(R.string.integrations_select_all)) } }
            availableWebhookEvents.forEach { event -> Row(Modifier.fillMaxWidth().clickable { draft = draft.copy(events = if (draft.events.contains(event.key)) draft.events - event.key else draft.events + event.key) }.padding(vertical = 4.dp)) {
                Checkbox(draft.events.contains(event.key), { checked -> draft = draft.copy(events = if (checked) draft.events + event.key else draft.events - event.key) });
                Column { Text(stringResource(event.titleRes)); Text(stringResource(event.detailRes), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
        } },
        confirmButton = { TextButton(onClick = { save(draft.copy(url = draft.url.trim(), label = draft.label?.trim())) }, enabled = validUrl && !saving) { Text(if (saving) stringResource(R.string.integrations_saving) else stringResource(R.string.action_save)) } },
        dismissButton = { TextButton(onClick = cancel) { Text(stringResource(R.string.action_cancel)) } })
}