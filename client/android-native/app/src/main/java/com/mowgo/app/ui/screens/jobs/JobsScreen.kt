package com.mowgo.app.ui.screens.jobs

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.ui.screens.today.EditJobDialog
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class JobFilter { ALL, SCHEDULED, DONE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobsScreen(viewModel: JobsViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var filter by remember { mutableStateOf(JobFilter.ALL) }
    var pendingDelete by remember { mutableStateOf<JobWithClient?>(null) }
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.dismissMessage()
        }
    }
    state.editingJob?.let { job ->
        EditJobDialog(job, state.clients, viewModel::dismissEdit, viewModel::update)
    }
    pendingDelete?.let { job ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Delete job?") },
            text = { Text("Delete ${job.clientName}'s ${job.title} job?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.delete(job.id)
                    pendingDelete = null
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Cancel") } },
        )
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Jobs", style = MaterialTheme.typography.titleLarge) }) },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = viewModel::load,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    JobFilter.entries.forEach { option ->
                        FilterChip(
                            selected = filter == option,
                            onClick = { filter = option },
                            label = { Text(option.name.lowercase().replaceFirstChar { it.titlecase() }) },
                        )
                    }
                }
                val filtered = state.jobs.filter {
                    when (filter) {
                        JobFilter.ALL -> true
                        JobFilter.SCHEDULED -> it.status == Job.STATUS_SCHEDULED || it.status == Job.STATUS_IN_PROGRESS
                        JobFilter.DONE -> it.status == Job.STATUS_DONE
                    }
                }.sortedWith(compareBy<JobWithClient> { it.scheduledDate }.thenBy { it.scheduledTime ?: "" })

                when {
                    state.isLoading && state.jobs.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                    state.error != null && state.jobs.isEmpty() -> JobsError(state.error ?: "Failed to load jobs", viewModel::load)
                    filtered.isEmpty() -> JobsEmpty()
                    else -> LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                        filtered.groupBy { it.scheduledDate }.forEach { (date, jobs) ->
                            item(key = "header-$date") { DateHeader(date) }
                            items(jobs, key = { it.id }) { job ->
                                JobsCard(job, { viewModel.toggleDone(job.id) }, { viewModel.edit(job) }, { pendingDelete = job })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DateHeader(value: String) {
    val date = runCatching { LocalDate.parse(value) }.getOrNull()
    val text = when (date) {
        LocalDate.now() -> "Today"
        LocalDate.now().plusDays(1) -> "Tomorrow"
        null -> value
        else -> date.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US))
    }
    Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(16.dp, 14.dp, 16.dp, 6.dp))
}

@Composable
private fun JobsCard(job: JobWithClient, onToggle: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    val done = job.status == Job.STATUS_DONE
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).clickable(onClick = onEdit),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(job.clientName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, textDecoration = if (done) TextDecoration.LineThrough else null)
                    Text(job.title, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                JobStatusChip(job.status)
                Box {
                    IconButton(onClick = { menu = true }) { Icon(Icons.Default.MoreVert, "Job options") }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(text = { Text("Edit") }, leadingIcon = { Icon(Icons.Default.Edit, null) }, onClick = { menu = false; onEdit() })
                        DropdownMenuItem(text = { Text("Delete") }, leadingIcon = { Icon(Icons.Default.Delete, null) }, onClick = { menu = false; onDelete() })
                    }
                }
            }
            job.clientAddress?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                job.scheduledTime?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                Text("$${String.format(Locale.US, "%.0f", job.clientRate)}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onToggle) {
                    Icon(if (done) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(if (done) "Completed" else "Complete")
                }
            }
        }
    }
}

@Composable
private fun JobStatusChip(status: String) {
    val label = when (status) { Job.STATUS_DONE -> "Done"; Job.STATUS_IN_PROGRESS -> "In Progress"; else -> "Scheduled" }
    Surface(color = MaterialTheme.colorScheme.primary.copy(alpha = .14f), shape = RoundedCornerShape(8.dp)) {
        Text(label, Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
private fun JobsEmpty() = Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.EventAvailable, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary.copy(alpha = .3f))
        Spacer(Modifier.height(16.dp)); Text("No jobs yet", style = MaterialTheme.typography.titleMedium)
        Text("Jobs will appear here.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun JobsError(message: String, retry: () -> Unit) = Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.ErrorOutline, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.error.copy(alpha = .5f))
        Spacer(Modifier.height(16.dp)); Text("Something went wrong", style = MaterialTheme.typography.titleMedium)
        Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(16.dp)); Button(onClick = retry) { Text("Retry") }
    }
}
