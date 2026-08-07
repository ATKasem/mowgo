package com.mowgo.app.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.R
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.data.model.UserProfile
import com.mowgo.app.ui.navigation.NavRoutes
import com.mowgo.app.ui.screens.clients.ClientFormDialog
import com.mowgo.app.ui.screens.today.NewJobDialog
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToTab: (String) -> Unit,
    viewModel: DashboardViewModel = viewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showAddJob by remember { mutableStateOf(false) }
    var showAddClient by remember { mutableStateOf(false) }
    var showInvite by remember { mutableStateOf(false) }
    var memberToRemove by remember { mutableStateOf<UserProfile?>(null) }

    val loaded = state as? DashboardUiState.Loaded
    LaunchedEffect(loaded?.actionMessage) {
        val message = loaded?.actionMessage
        if (message != null) {
            snackbarHostState.showSnackbar(message)
            viewModel.dismissActionMessage()
        }
    }

    if (showAddJob && loaded != null) {
        NewJobDialog(
            clients = loaded.clients,
            onDismiss = { showAddJob = false },
            onCreate = { title, clientId, date, time, notes, routeOrder ->
                viewModel.createJob(title, clientId, date, time, notes, routeOrder) {
                    showAddJob = false
                }
            },
        )
    }
    if (showAddClient) {
        ClientFormDialog(
            title = stringResource(R.string.clients_new_client_title),
            onDismiss = { showAddClient = false },
            onSave = { name, address, phone, rate, keyCode, petInstructions ->
                viewModel.createClient(name, address, phone, rate, keyCode, petInstructions) {
                    showAddClient = false
                }
            },
        )
    }
    if (showInvite && loaded != null) {
        InviteCrewDialog(
            isInviting = loaded.isInviting,
            error = loaded.inviteError,
            onDismiss = {
                showInvite = false
                viewModel.dismissInviteError()
            },
            onInvite = { email ->
                viewModel.inviteMember(email) { showInvite = false }
            },
        )
    }
    memberToRemove?.let { member ->
        AlertDialog(
            onDismissRequest = { memberToRemove = null },
            title = { Text(stringResource(R.string.dashboard_remove_crew_title)) },
            text = { Text(stringResource(R.string.dashboard_remove_crew_body, member.businessName?.ifBlank { null } ?: stringResource(R.string.dashboard_remove_crew_default))) },
            confirmButton = {
                Button(
                    onClick = {
                        val selectedMember = memberToRemove
                        memberToRemove = null
                        if (selectedMember != null) viewModel.removeMember(selectedMember)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text(stringResource(R.string.dashboard_remove)) }
            },
            dismissButton = { TextButton(onClick = { memberToRemove = null }) { Text(stringResource(R.string.action_cancel)) } },
        )
    }
    loaded?.removeError?.let { message ->
        ErrorAlert(
            title = stringResource(R.string.dashboard_remove_error_title),
            message = message,
            onDismiss = viewModel::dismissRemoveError,
        )
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(stringResource(R.string.dashboard_title), fontWeight = FontWeight.Bold)
                        Text(
                            LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, MMMM d", Locale.ENGLISH)),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { innerPadding ->
        when (val current = state) {
            DashboardUiState.Loading -> LoadingContent(Modifier.padding(innerPadding))
            is DashboardUiState.Error -> DashboardErrorContent(
                message = current.message,
                onRetry = viewModel::retry,
                modifier = Modifier.padding(innerPadding),
            )
            is DashboardUiState.Loaded -> PullToRefreshBox(
                isRefreshing = current.isRefreshing,
                onRefresh = viewModel::refresh,
                modifier = Modifier.fillMaxSize().padding(innerPadding),
            ) {
                DashboardContent(
                    state = current,
                    onNavigateToTab = onNavigateToTab,
                    onAddJob = { showAddJob = true },
                    onAddClient = { showAddClient = true },
                    onInvite = { showInvite = true },
                    onRemove = { memberToRemove = it },
                )
            }
        }
    }
}

@Composable
private fun DashboardContent(
    state: DashboardUiState.Loaded,
    onNavigateToTab: (String) -> Unit,
    onAddJob: () -> Unit,
    onAddClient: () -> Unit,
    onInvite: () -> Unit,
    onRemove: (UserProfile) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { StatsGrid(state, onNavigateToTab) }
        if (state.isOwner) item { QuickActions(onAddJob, onAddClient) }
        item { TodayPreview(state.todayJobs, onNavigateToTab) }
        if (state.isOwner && state.teamProgress.isNotEmpty()) item { TeamCard(state.teamProgress) }
        if (state.isOwner) item { CrewRoster(state.teamMembers, onInvite, onRemove) }
    }
}

private data class StatDefinition(
    val icon: ImageVector,
    val color: Color,
    val value: String,
    val label: String,
    val sub: String?,
    val route: String,
)

@Composable
private fun StatsGrid(state: DashboardUiState.Loaded, onNavigateToTab: (String) -> Unit) {
    val stats = if (state.isOwner) listOf(
        StatDefinition(Icons.Filled.TrendingUp, Color(0xFF22C55E), currency(state.todayRevenue), stringResource(R.string.dashboard_stat_revenue_today), if (state.todayJobs.isEmpty()) stringResource(R.string.dashboard_stat_no_jobs) else stringResource(R.string.dashboard_stat_jobs_done, state.todayDoneCount, state.todayJobs.size), NavRoutes.TODAY),
        StatDefinition(Icons.Filled.Receipt, Color(0xFFF59E0B), currency(state.outstanding), stringResource(R.string.dashboard_stat_outstanding), stringResource(R.string.dashboard_stat_unpaid_invoices), NavRoutes.INVOICES),
        StatDefinition(Icons.Filled.CheckCircle, Color(0xFFA855F7), state.weeklyJobs.size.toString(), stringResource(R.string.dashboard_stat_jobs_week), stringResource(R.string.dashboard_stat_revenue_amount, currency(state.weeklyRevenue)), NavRoutes.TODAY),
        StatDefinition(Icons.Filled.Groups, Color(0xFF3B82F6), state.activeClients.toString(), stringResource(R.string.dashboard_stat_active_clients), stringResource(R.string.dashboard_stat_recurring, state.recurringClients), NavRoutes.CLIENTS),
    ) else listOf(
        StatDefinition(Icons.Filled.CheckCircle, Color(0xFF22C55E), state.weeklyJobs.size.toString(), stringResource(R.string.dashboard_stat_jobs_week), stringResource(R.string.dashboard_stat_done_count, state.weeklyDoneCount), NavRoutes.TODAY),
        StatDefinition(Icons.Filled.Groups, Color(0xFF3B82F6), state.activeClients.toString(), stringResource(R.string.dashboard_stat_active_clients), null, NavRoutes.CLIENTS),
    )

    LazyVerticalGrid(
        columns = GridCells.Adaptive(150.dp),
        modifier = Modifier.fillMaxWidth().height(if (state.isOwner) 292.dp else 140.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        userScrollEnabled = false,
    ) {
        gridItems(stats) { stat ->
            Card(
                modifier = Modifier.fillMaxWidth().height(140.dp).clickable { onNavigateToTab(stat.route) },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Icon(stat.icon, null, tint = stat.color, modifier = Modifier.size(24.dp))
                    Text(stat.value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(stat.label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                    stat.sub?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
        }
    }
}

@Composable
private fun QuickActions(onAddJob: () -> Unit, onAddClient: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        QuickAction(Icons.Filled.AddCircle, stringResource(R.string.dashboard_add_job), onAddJob, Modifier.weight(1f))
        QuickAction(Icons.Filled.PersonAdd, stringResource(R.string.dashboard_add_client), onAddClient, Modifier.weight(1f))
    }
}

@Composable
private fun QuickAction(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier) {
    Card(
        modifier = modifier.height(56.dp).clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(14.dp),
    ) {
        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(7.dp))
            Text(label, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun TodayPreview(jobs: List<JobWithClient>, onNavigateToTab: (String) -> Unit) {
    DashboardSection {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.common_today), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (jobs.isNotEmpty()) TextButton(onClick = { onNavigateToTab(NavRoutes.TODAY) }) { Text(stringResource(R.string.dashboard_see_all)) }
        }
        if (jobs.isEmpty()) {
            Column(Modifier.fillMaxWidth().padding(vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Schedule, null, tint = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.size(32.dp))
                Spacer(Modifier.height(8.dp))
                Text(stringResource(R.string.dashboard_no_jobs_today), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            jobs.sortedBy { it.routeOrder ?: Int.MAX_VALUE }.take(3).forEach { TodayJobRow(it) }
        }
    }
}

@Composable
private fun TodayJobRow(job: JobWithClient) {
    val statusColor = when (job.status) {
        Job.STATUS_DONE -> Color(0xFF22C55E)
        Job.STATUS_IN_PROGRESS -> Color(0xFF06B6D4)
        else -> Color(0xFFF59E0B)
    }
    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(36.dp).background(MaterialTheme.colorScheme.surfaceVariant, CircleShape), contentAlignment = Alignment.Center) {
            Text(job.clientName.firstOrNull()?.uppercase() ?: "?", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(job.clientName.ifBlank { job.title }, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            job.scheduledTime?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        Text(
            when (job.status) {
                Job.STATUS_DONE -> stringResource(R.string.status_done)
                Job.STATUS_IN_PROGRESS -> stringResource(R.string.status_in_progress)
                Job.STATUS_SKIPPED -> stringResource(R.string.status_skipped)
                else -> stringResource(R.string.status_scheduled)
            },
            style = MaterialTheme.typography.labelSmall, color = statusColor,
        )
    }
}

@Composable
private fun TeamCard(rows: List<TeamProgressRow>) {
    DashboardSection {
        Text(stringResource(R.string.dashboard_team), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        rows.forEach { row ->
            val completed = row.done + row.inProgress
            val progress = if (row.total > 0) completed.toFloat() / row.total else 0f
            val color = if (row.isUnassigned) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).background(color, CircleShape))
                Spacer(Modifier.width(8.dp))
                Text(row.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text("$completed/${row.total}", style = MaterialTheme.typography.labelSmall)
                if (row.done > 0) {
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.dashboard_done_check), color = Color(0xFF22C55E), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(6.dp))
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().height(6.dp),
                color = color,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
            Spacer(Modifier.height(10.dp))
        }
    }
}

@Composable
private fun CrewRoster(members: List<UserProfile>, onInvite: () -> Unit, onRemove: (UserProfile) -> Unit) {
    DashboardSection {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.dashboard_crew), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            TextButton(onClick = onInvite) {
                Icon(Icons.Filled.PersonAdd, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.dashboard_invite))
            }
        }
        if (members.isEmpty()) {
            Text(stringResource(R.string.dashboard_no_crew), modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else members.forEach { member ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                val owner = member.role == "owner"
                Box(Modifier.size(8.dp).background(if (owner) Color(0xFF22C55E) else Color(0xFF3B82F6), CircleShape))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(member.businessName?.ifBlank { null } ?: stringResource(R.string.dashboard_crew_member_default), fontWeight = FontWeight.Medium)
                    Text(if (owner) stringResource(R.string.dashboard_owner) else stringResource(R.string.dashboard_crew), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (member.role == "crew") IconButton(onClick = { onRemove(member) }) {
                    Icon(Icons.Filled.Delete, stringResource(R.string.dashboard_remove_member_cd, member.businessName ?: ""), tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@Composable
private fun DashboardSection(content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp),
    ) { Column(Modifier.padding(16.dp), content = content) }
}

@Composable
private fun InviteCrewDialog(
    isInviting: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onInvite: (String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.dashboard_invite_crew_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.dashboard_invite_crew_body), color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(stringResource(R.string.dashboard_email_address)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall) }
            }
        },
        confirmButton = {
            Button(onClick = { onInvite(email) }, enabled = email.isNotBlank() && !isInviting) {
                if (isInviting) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Text(stringResource(R.string.dashboard_send_invite))
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

@Composable
private fun ErrorAlert(title: String, message: String, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_ok)) } },
    )
}

@Composable
private fun LoadingContent(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
private fun DashboardErrorContent(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(Icons.Filled.Assignment, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(12.dp))
        Text(message, color = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(12.dp))
        Button(onClick = onRetry) { Text(stringResource(R.string.action_retry)) }
    }
}

private fun currency(amount: Double): String = "$${String.format(Locale.US, "%.0f", amount)}"
