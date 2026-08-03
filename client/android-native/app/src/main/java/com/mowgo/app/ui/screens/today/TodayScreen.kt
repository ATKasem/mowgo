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

    // Rain delay confirmation dialog
    if (state.showRainDelayDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissRainDelayDialog() },
            title = {
                Text("Rain Delay", color = MowGoColors.TextPrimaryDark)
            },
            text = {
                Text(
                    text = "Move ${state.rainDelayCount} jobs to tomorrow?",
                    color = MowGoColors.TextSecondaryDark,
                )
            },
            containerColor = MowGoColors.SurfaceDark,
            confirmButton = {
                Button(
                    onClick = { viewModel.confirmRainDelay() },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MowGoColors.RainBlue,
                    ),
                ) {
                    Text("Move to Tomorrow")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissRainDelayDialog() }) {
                    Text("Cancel", color = MowGoColors.TextSecondaryDark)
                }
            },
        )
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
                // Empty state
                EmptyContent()
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
                        )
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
    }
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
