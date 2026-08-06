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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.R
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.ui.components.JobPhotoButton
import com.mowgo.app.ui.components.JobPhotoThumbnail
import com.mowgo.app.ui.theme.MowGoColors
import com.mowgo.app.ui.theme.extendedColors
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
                    containerColor = MaterialTheme.colorScheme.secondary,
                    contentColor = MowGoColors.OnAccent,
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.showNewJobDialog() },
                containerColor = MaterialTheme.colorScheme.secondary,
                contentColor = MowGoColors.OnAccent,
            ) {
                Icon(Icons.Filled.Add, contentDescription = stringResource(R.string.today_new_job_cd))
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
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
                        color = MaterialTheme.colorScheme.secondary,
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
                                Text(stringResource(R.string.today_rain_chance, forecast.precipitationProbability, forecast.date), Modifier.padding(12.dp), color = MowGoColors.OnAccent, fontWeight = FontWeight.SemiBold)
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
                            text = stringResource(R.string.today_jobs_header),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface,
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
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = weekday,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = businessName,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.secondary,
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
                text = stringResource(R.string.today_rain_delay),
                fontWeight = FontWeight.SemiBold,
            )
        }
        if (hasHistory) {
            TextButton(onClick = onHistory, modifier = Modifier.align(Alignment.End)) {
                Icon(Icons.Filled.History, null); Spacer(Modifier.width(4.dp)); Text(stringResource(R.string.today_rain_delay_history))
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
        DatePickerDialog({ showPicker = false }, confirmButton = { TextButton({ picker.selectedDateMillis?.let { target = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }; showPicker = false }) { Text(stringResource(R.string.action_ok)) } }, dismissButton = { TextButton({ showPicker = false }) { Text(stringResource(R.string.action_cancel)) } }) { DatePicker(picker) }
    }
    AlertDialog(
        onDismissRequest = { if (!applying) dismiss() }, title = { Text(stringResource(R.string.today_rain_delay)) }, containerColor = MaterialTheme.colorScheme.surface,
        text = { Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(stringResource(R.string.today_scheduled_jobs_move, count), color = MaterialTheme.colorScheme.onSurface)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf(stringResource(R.string.common_tomorrow), stringResource(R.string.today_pick_a_date)).forEachIndexed { index, label -> SegmentedButton(selected = custom == (index == 1), onClick = { custom = index == 1; if (!custom) target = tomorrow }, shape = SegmentedButtonDefaults.itemShape(index, 2), label = { Text(label) }) }
            }
            if (custom) OutlinedButton({ showPicker = true }, Modifier.fillMaxWidth()) { Icon(Icons.Filled.CalendarMonth, null); Spacer(Modifier.width(8.dp)); Text(target.toString()) }
            Text(stringResource(R.string.today_rain_delay_note), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } },
        confirmButton = { Button({ confirm(target.toString()) }, enabled = !applying && count > 0, colors = ButtonDefaults.buttonColors(containerColor = MowGoColors.RainBlue)) { if (applying) CircularProgressIndicator(Modifier.size(18.dp)) else Text(stringResource(R.string.today_confirm_rain_delay)) } },
        dismissButton = { TextButton(dismiss, enabled = !applying) { Text(stringResource(R.string.action_cancel)) } },
    )
}

@Composable
private fun RainDelayHistoryDialog(history: List<com.mowgo.app.data.model.RainDelayEntry>, undoing: Boolean, dismiss: () -> Unit, undo: (com.mowgo.app.data.model.RainDelayEntry) -> Unit) {
    AlertDialog(onDismissRequest = { if (!undoing) dismiss() }, title = { Text(stringResource(R.string.today_rain_delay_history)) }, containerColor = MaterialTheme.colorScheme.surface,
        text = { if (history.isEmpty()) Text(stringResource(R.string.today_no_rain_delays)) else LazyColumn(Modifier.heightIn(max = 420.dp)) { items(history, key = { it.createdAt }) { entry -> Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("${entry.date} → ${entry.targetDate}", color = MaterialTheme.colorScheme.onSurface); Text(stringResource(R.string.today_job_count, entry.jobCount), color = MaterialTheme.colorScheme.onSurfaceVariant) }; OutlinedButton({ undo(entry) }, enabled = !undoing) { Text(stringResource(R.string.today_undo)) } } } } },
        confirmButton = { TextButton(dismiss, enabled = !undoing) { Text(stringResource(R.string.status_done)) } })
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
            label = stringResource(R.string.today_jobs_header),
            value = totalJobs.toString(),
            color = MaterialTheme.colorScheme.secondary,
            modifier = Modifier.weight(1f),
        )
        StatCard(
            label = stringResource(R.string.today_stat_completed),
            value = completed.toString(),
            color = MaterialTheme.extendedColors.success,
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
            label = stringResource(R.string.today_stat_revenue),
            value = "$${String.format("%.0f", revenue)}",
            color = MaterialTheme.colorScheme.secondary,
            modifier = Modifier.weight(1f),
        )
        StatCard(
            label = stringResource(R.string.status_scheduled),
            value = scheduled.toString(),
            color = MaterialTheme.extendedColors.info,
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
            containerColor = MaterialTheme.colorScheme.surface,
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
                color = MaterialTheme.colorScheme.onSurfaceVariant,
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
            containerColor = MaterialTheme.colorScheme.surface,
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
                            .background(MaterialTheme.colorScheme.background),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "${order + 1}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                }

                // Job info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = jobWithClient.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = jobWithClient.clientName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                            label = stringResource(R.string.today_action_mark_done),
                            icon = Icons.Filled.CheckCircle,
                            color = MaterialTheme.extendedColors.success,
                            onClick = onMarkDone,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (jobWithClient.status != Job.STATUS_SKIPPED && jobWithClient.status != Job.STATUS_DONE) {
                        ActionButton(
                            label = stringResource(R.string.today_action_skip),
                            icon = Icons.Filled.SkipNext,
                            color = MaterialTheme.colorScheme.error,
                            onClick = onSkip,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    ActionButton(
                        label = stringResource(R.string.action_edit),
                        icon = Icons.Filled.Edit,
                        color = MaterialTheme.extendedColors.info,
                        onClick = onEdit,
                        modifier = Modifier.weight(1f),
                    )
                    ActionButton(
                        label = stringResource(R.string.action_delete),
                        icon = Icons.Filled.Delete,
                        color = MaterialTheme.colorScheme.error,
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
        Job.STATUS_SCHEDULED -> stringResource(R.string.status_scheduled) to MaterialTheme.extendedColors.info
        Job.STATUS_IN_PROGRESS -> stringResource(R.string.status_in_progress) to MaterialTheme.extendedColors.warning
        Job.STATUS_DONE -> stringResource(R.string.status_done) to MaterialTheme.extendedColors.success
        Job.STATUS_SKIPPED -> stringResource(R.string.status_skipped) to MaterialTheme.colorScheme.error
        else -> status to MaterialTheme.colorScheme.onSurfaceVariant
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
            tint = MaterialTheme.colorScheme.secondary.copy(alpha = 0.3f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.today_empty_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = stringResource(R.string.today_empty_detail),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
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
            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.5f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.error_generic_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = error,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondary,
            ),
        ) {
            Text(stringResource(R.string.action_retry))
        }
    }
}
