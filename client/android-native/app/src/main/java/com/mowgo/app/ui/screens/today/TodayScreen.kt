package com.mowgo.app.ui.screens.today

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.ui.components.JobPhotoButton
import com.mowgo.app.ui.components.JobPhotoThumbnail
import com.mowgo.app.ui.theme.MowGoColors
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    viewModel: TodayViewModel = viewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    // Snackbar host
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.showSnackbar) {
        state.showSnackbar?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.dismissSnackbar()
        }
    }

    if (state.showRainDelayDialog) {
        RainDelayDialog(state.rainDelayCount, state.isApplyingRainDelay, viewModel::dismissRainDelayDialog, viewModel::confirmRainDelay)
    }
    if (state.showRainDelayHistory) {
        RainDelayHistoryDialog(state.rainDelayHistory, state.isUndoingRainDelay, viewModel::dismissRainDelayHistory, viewModel::undoRainDelay)
    }

    // New job dialog
    if (state.showNewJobDialog) {
        NewJobDialog(
            clients = state.clients,
            onDismiss = { viewModel.dismissNewJobDialog() },
            onCreate = { title, clientId, date, time, notes, routeOrder ->
                viewModel.createJob(title, clientId, date, time, notes, routeOrder)
            },
        )
    }

    // Edit job dialog
    state.editingJob?.let { editingJob ->
        EditJobDialog(
            jobWithClient = editingJob,
            clients = state.clients,
            onDismiss = { viewModel.dismissEditJobDialog() },
            onSave = { updatedJob -> viewModel.updateJob(updatedJob) },
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
                onClick = { viewModel.showNewJobDialog() },
                containerColor = MowGoColors.DeepGreenDark,
                contentColor = MowGoColors.OnAccent,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "New Job")
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
            if (state.isLoading && state.jobs.isEmpty()) {
                // Initial loading state
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(
                        color = MowGoColors.DeepGreenDark,
                    )
                }
            } else if (state.error != null && state.jobs.isEmpty()) {
                // Error state
                ErrorContent(
                    error = state.error!!,
                    onRetry = { viewModel.refresh() },
                )
            } else if (state.todayJobs.isEmpty()) {
                Column(Modifier.fillMaxSize()) {
                    TodayHeader(
                        date = state.todayDate,
                        weekday = state.todayWeekday,
                        businessName = state.businessName,
                        movableJobCount = state.movableJobCount,
                        onRainDelay = viewModel::showRainDelayDialog,
                        hasHistory = state.rainDelayHistory.isNotEmpty(),
                        onHistory = viewModel::showRainDelayHistory,
                    )
                    EmptyContent()
                }
            } else {
                // Content
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 80.dp),
                ) {
                    // Header
                    item {
                        TodayHeader(
                            date = state.todayDate,
                            weekday = state.todayWeekday,
                            businessName = state.businessName,
                            movableJobCount = state.movableJobCount,
                            onRainDelay = { viewModel.showRainDelayDialog() },
                            hasHistory = state.rainDelayHistory.isNotEmpty(),
                            onHistory = viewModel::showRainDelayHistory,
                        )
                    }

                    state.weatherAlert?.let { forecast ->
                        item {
                            Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), colors = CardDefaults.cardColors(containerColor = MowGoColors.RainBlue)) {
                                Text("Rain chance ${forecast.precipitationProbability}% on ${forecast.date}", Modifier.padding(12.dp), color = MowGoColors.OnAccent, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }

                    // Stats grid
                    item {
                        StatsRow(
                            totalJobs = state.totalJobs,
                            completed = state.completedCount,
                            revenue = state.todayRevenue,
                            scheduled = state.scheduledCount + state.inProgressCount,
                        )
                    }

                    // Job list header
                    item {
                        Text(
                            text = "Today's Jobs",
                            style = MaterialTheme.typography.titleMedium,
                            color = MowGoColors.TextPrimaryDark,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                        )
                    }

                    // Job cards
                    items(
                        items = state.todayJobs,
                        key = { it.id },
                    ) { jobWithClient ->
                        JobCard(
                            jobWithClient = jobWithClient,
                            onMarkDone = { viewModel.markDone(jobWithClient.id) },
                            onSkip = { viewModel.skipJob(jobWithClient.id) },
                            onEdit = { viewModel.showEditJobDialog(jobWithClient) },
                            onDelete = { viewModel.deleteJob(jobWithClient.id) },
                            isUploadingPhoto = jobWithClient.id in state.uploadingPhotoJobIds,
                            onPhotoReady = { bytes -> viewModel.uploadJobPhoto(jobWithClient.id, bytes) },
                            onPhotoError = viewModel::showPhotoError,
                        )
                    }
                }
            }
        }
    }
}

// ── Header ──────────────────────────────────────────────────────────────

@Composable
private fun TodayHeader(
    date: String,
    weekday: String,
    businessName: String,
    movableJobCount: Int,
    onRainDelay: () -> Unit,
    hasHistory: Boolean,
    onHistory: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Text(
            text = date,
            style = MaterialTheme.typography.headlineSmall,
            color = MowGoColors.TextPrimaryDark,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = weekday,
            style = MaterialTheme.typography.bodyLarge,
            color = MowGoColors.TextSecondaryDark,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = businessName,
            style = MaterialTheme.typography.bodyMedium,
            color = MowGoColors.DeepGreenDark,
            fontWeight = FontWeight.Medium,
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Rain Delay button
        Button(
            onClick = onRainDelay,
            enabled = movableJobCount > 0,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = MowGoColors.RainBlue,
                contentColor = MowGoColors.OnAccent,
                disabledContainerColor = MowGoColors.RainBlue.copy(alpha = 0.3f),
                disabledContentColor = MowGoColors.OnAccent.copy(alpha = 0.5f),
            ),
            shape = RoundedCornerShape(12.dp),
        ) {
            Icon(
                Icons.Filled.Cloud,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Rain Delay",
                fontWeight = FontWeight.SemiBold,
            )
        }
        if (hasHistory) {
            TextButton(onClick = onHistory, modifier = Modifier.align(Alignment.End)) {
                Icon(Icons.Filled.History, null); Spacer(Modifier.width(4.dp)); Text("Rain Delay History")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RainDelayDialog(count: Int, applying: Boolean, dismiss: () -> Unit, confirm: (String) -> Unit) {
    var custom by remember { mutableStateOf(false) }
    var showPicker by remember { mutableStateOf(false) }
    val tomorrow = LocalDate.now().plusDays(1)
    var target by remember { mutableStateOf(tomorrow) }
    if (showPicker) {
        val minimum = tomorrow.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val picker = rememberDatePickerState(initialSelectedDateMillis = target.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(), selectableDates = object : SelectableDates { override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis >= minimum })
        DatePickerDialog({ showPicker = false }, confirmButton = { TextButton({ picker.selectedDateMillis?.let { target = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }; showPicker = false }) { Text("OK") } }, dismissButton = { TextButton({ showPicker = false }) { Text("Cancel") } }) { DatePicker(picker) }
    }
    AlertDialog(
        onDismissRequest = { if (!applying) dismiss() }, title = { Text("Rain Delay") }, containerColor = MowGoColors.SurfaceDark,
        text = { Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("$count scheduled jobs will move", color = MowGoColors.TextPrimaryDark)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("Tomorrow", "Pick a date").forEachIndexed { index, label -> SegmentedButton(selected = custom == (index == 1), onClick = { custom = index == 1; if (!custom) target = tomorrow }, shape = SegmentedButtonDefaults.itemShape(index, 2), label = { Text(label) }) }
            }
            if (custom) OutlinedButton({ showPicker = true }, Modifier.fillMaxWidth()) { Icon(Icons.Filled.CalendarMonth, null); Spacer(Modifier.width(8.dp)); Text(target.toString()) }
            Text("Only today's scheduled and in-progress jobs move.", color = MowGoColors.TextSecondaryDark)
        } },
        confirmButton = { Button({ confirm(target.toString()) }, enabled = !applying && count > 0, colors = ButtonDefaults.buttonColors(containerColor = MowGoColors.RainBlue)) { if (applying) CircularProgressIndicator(Modifier.size(18.dp)) else Text("Confirm Rain Delay") } },
        dismissButton = { TextButton(dismiss, enabled = !applying) { Text("Cancel") } },
    )
}

@Composable
private fun RainDelayHistoryDialog(history: List<com.mowgo.app.data.model.RainDelayEntry>, undoing: Boolean, dismiss: () -> Unit, undo: (com.mowgo.app.data.model.RainDelayEntry) -> Unit) {
    AlertDialog(onDismissRequest = { if (!undoing) dismiss() }, title = { Text("Rain Delay History") }, containerColor = MowGoColors.SurfaceDark,
        text = { if (history.isEmpty()) Text("No rain delays yet") else LazyColumn(Modifier.heightIn(max = 420.dp)) { items(history, key = { it.createdAt }) { entry -> Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("${entry.date} → ${entry.targetDate}", color = MowGoColors.TextPrimaryDark); Text("${entry.jobCount} job(s)", color = MowGoColors.TextSecondaryDark) }; OutlinedButton({ undo(entry) }, enabled = !undoing) { Text("Undo") } } } },
        confirmButton = { TextButton(dismiss, enabled = !undoing) { Text("Done") } })
}

// ── Stats Row ───────────────────────────────────────────────────────────

@Composable
private fun StatsRow(
    totalJobs: Int,
    completed: Int,
    revenue: Double,
    scheduled: Int,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        StatCard(
            label = "Today's Jobs",
            value = totalJobs.toString(),
            color = MowGoColors.DeepGreenDark,
            modifier = Modifier.weight(1f),
        )
        StatCard(
            label = "Completed",
            value = completed.toString(),
            color = MowGoColors.SuccessDark,
            modifier = Modifier.weight(1f),
        )
    }
    Spacer(modifier = Modifier.height(8.dp))
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        StatCard(
            label = "Revenue",
            value = "$${String.format("%.0f", revenue)}",
            color = MowGoColors.DeepGreenDark,
            modifier = Modifier.weight(1f),
        )
        StatCard(
            label = "Scheduled",
            value = scheduled.toString(),
            color = MowGoColors.InfoDark,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun StatCard(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MowGoColors.SurfaceDark,
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                color = color,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MowGoColors.TextSecondaryDark,
                textAlign = TextAlign.Center,
            )
        }
    }
}

// ── Job Card ────────────────────────────────────────────────────────────

@Composable
private fun JobCard(
    jobWithClient: JobWithClient,
    onMarkDone: () -> Unit,
    onSkip: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    isUploadingPhoto: Boolean,
    onPhotoReady: (ByteArray) -> Unit,
    onPhotoError: (String) -> Unit,
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
                // Route order badge
                jobWithClient.routeOrder?.let { order ->
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(MowGoColors.BackgroundDark),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "${order + 1}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MowGoColors.TextSecondaryDark,
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                }

                // Job info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = jobWithClient.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = MowGoColors.TextPrimaryDark,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = jobWithClient.clientName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MowGoColors.TextSecondaryDark,
                    )
                }

                JobPhotoThumbnail(
                    photoUrl = jobWithClient.photoUrl,
                    modifier = Modifier.padding(horizontal = 8.dp),
                )

                JobPhotoButton(
                    jobId = jobWithClient.id,
                    isUploading = isUploadingPhoto,
                    onImageReady = onPhotoReady,
                    onError = onPhotoError,
                )

                // Time + status chip
                Column(horizontalAlignment = Alignment.End) {
                    jobWithClient.scheduledTime?.let { time ->
                        Text(
                            text = time,
                            style = MaterialTheme.typography.bodySmall,
                            color = MowGoColors.TextSecondaryDark,
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    StatusChip(status = jobWithClient.status)
                }
            }

            // Expandable actions
            AnimatedVisibility(visible = expanded) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (jobWithClient.status != Job.STATUS_DONE) {
                        ActionButton(
                            label = "Mark Done",
                            icon = Icons.Filled.CheckCircle,
                            color = MowGoColors.SuccessDark,
                            onClick = onMarkDone,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (jobWithClient.status != Job.STATUS_SKIPPED && jobWithClient.status != Job.STATUS_DONE) {
                        ActionButton(
                            label = "Skip",
                            icon = Icons.Filled.SkipNext,
                            color = MowGoColors.DangerDark,
                            onClick = onSkip,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    ActionButton(
                        label = "Edit",
                        icon = Icons.Filled.Edit,
                        color = MowGoColors.InfoDark,
                        onClick = onEdit,
                        modifier = Modifier.weight(1f),
                    )
                    ActionButton(
                        label = "Delete",
                        icon = Icons.Filled.Delete,
                        color = MowGoColors.DangerDark,
                        onClick = onDelete,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = color,
        ),
        border = ButtonDefaults.outlinedButtonBorder.copy(
            brush = androidx.compose.ui.graphics.SolidColor(color.copy(alpha = 0.5f)),
        ),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
        shape = RoundedCornerShape(8.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

// ── Status Chip ─────────────────────────────────────────────────────────

@Composable
private fun StatusChip(status: String) {
    val (text, color) = when (status) {
        Job.STATUS_SCHEDULED -> "Scheduled" to MowGoColors.InfoDark
        Job.STATUS_IN_PROGRESS -> "In Progress" to MowGoColors.WarningDark
        Job.STATUS_DONE -> "Done" to MowGoColors.SuccessDark
        Job.STATUS_SKIPPED -> "Skipped" to MowGoColors.DangerDark
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

// ── Empty State ─────────────────────────────────────────────────────────

@Composable
private fun EmptyContent() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.EventAvailable,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MowGoColors.DeepGreenDark.copy(alpha = 0.3f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No jobs today",
            style = MaterialTheme.typography.titleMedium,
            color = MowGoColors.TextPrimaryDark,
        )
        Text(
            text = "Your schedule will appear here.",
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
