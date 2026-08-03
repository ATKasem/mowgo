package com.mowgo.app.ui.screens.today

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.mowgo.app.data.model.Client
import com.mowgo.app.ui.theme.MowGoColors
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Dialog for creating a new job.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewJobDialog(
    clients: List<Client>,
    onDismiss: () -> Unit,
    onCreate: (title: String, clientId: String, date: String, time: String?, notes: String?, routeOrder: Int?) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var selectedClient by remember { mutableStateOf<Client?>(null) }
    var selectedDate by remember { mutableStateOf(LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)) }
    var selectedTime by remember { mutableStateOf<String?>(null) }
    var notes by remember { mutableStateOf("") }
    var routeOrderText by remember { mutableStateOf("") }
    var showClientPicker by remember { mutableStateOf(false) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    // Time slots 8:00 - 17:00 in 30-min increments
    val timeSlots = remember {
        (0..18).map { i ->
            val hour = 8 + i / 2
            val min = (i % 2) * 30
            String.format("%02d:%02d", hour, min)
        }
    }

    if (showClientPicker) {
        ClientPickerDialog(
            clients = clients,
            onSelect = { client ->
                selectedClient = client
                showClientPicker = false
            },
            onDismiss = { showClientPicker = false },
        )
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        val instant = java.time.Instant.ofEpochMilli(millis)
                        val date = instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                        selectedDate = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
                    }
                    showDatePicker = false
                }) {
                    Text("OK", color = MowGoColors.DeepGreenDark)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text("Cancel", color = MowGoColors.TextSecondaryDark)
                }
            },
            colors = DatePickerDefaults.colors(
                containerColor = MowGoColors.SurfaceDark,
            ),
        ) {
            DatePicker(
                state = datePickerState,
                colors = DatePickerDefaults.colors(
                    containerColor = MowGoColors.SurfaceDark,
                    selectedDayContainerColor = MowGoColors.DeepGreenDark,
                    todayDateBorderColor = MowGoColors.DeepGreenDark,
                ),
            )
        }
    }

    if (showTimePicker) {
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Select Time", color = MowGoColors.TextPrimaryDark) },
            containerColor = MowGoColors.SurfaceDark,
            text = {
                LazyColumn {
                    items(timeSlots) { slot ->
                        val isSelected = slot == selectedTime
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (isSelected) MowGoColors.DeepGreenDark.copy(alpha = 0.2f)
                                    else MowGoColors.BackgroundDark
                                )
                                .clickable {
                                    selectedTime = slot
                                    showTimePicker = false
                                }
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = slot,
                                color = if (isSelected) MowGoColors.DeepGreenDark
                                else MowGoColors.TextPrimaryDark,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            )
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) {
                    Text("Cancel", color = MowGoColors.TextSecondaryDark)
                }
            },
        )
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = MowGoColors.SurfaceDark),
            shape = RoundedCornerShape(16.dp),
        ) {
            LazyColumn(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Text(
                        text = "New Job",
                        style = MaterialTheme.typography.titleLarge,
                        color = MowGoColors.TextPrimaryDark,
                        fontWeight = FontWeight.Bold,
                    )
                }

                // Title
                item {
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Job Title") },
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
                }

                // Client picker
                item {
                    OutlinedTextField(
                        value = selectedClient?.name ?: "",
                        onValueChange = {},
                        label = { Text("Client") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showClientPicker = true },
                        readOnly = true,
                        enabled = false,
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledBorderColor = MowGoColors.TextSecondaryDark,
                            disabledLabelColor = MowGoColors.TextSecondaryDark,
                            disabledTextColor = MowGoColors.TextPrimaryDark,
                        ),
                    )
                }

                // Date
                item {
                    OutlinedTextField(
                        value = selectedDate,
                        onValueChange = {},
                        label = { Text("Date") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showDatePicker = true },
                        readOnly = true,
                        enabled = false,
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledBorderColor = MowGoColors.TextSecondaryDark,
                            disabledLabelColor = MowGoColors.TextSecondaryDark,
                            disabledTextColor = MowGoColors.TextPrimaryDark,
                        ),
                    )
                }

                // Time
                item {
                    OutlinedTextField(
                        value = selectedTime ?: "Tap to select",
                        onValueChange = {},
                        label = { Text("Time") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showTimePicker = true },
                        readOnly = true,
                        enabled = false,
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledBorderColor = MowGoColors.TextSecondaryDark,
                            disabledLabelColor = if (selectedTime != null) MowGoColors.TextSecondaryDark else MowGoColors.TextSecondaryDark,
                            disabledTextColor = MowGoColors.TextPrimaryDark,
                        ),
                    )
                }

                // Route order
                item {
                    OutlinedTextField(
                        value = routeOrderText,
                        onValueChange = { routeOrderText = it.filter { c -> c.isDigit() } },
                        label = { Text("Route Order (optional)") },
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
                }

                // Notes
                item {
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Notes (optional)") },
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

                // Buttons
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TextButton(onClick = onDismiss) {
                            Text("Cancel", color = MowGoColors.TextSecondaryDark)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                val clientId = selectedClient?.id ?: return@Button
                                val routeOrder = routeOrderText.toIntOrNull()
                                onCreate(title, clientId, selectedDate, selectedTime, notes.ifBlank { null }, routeOrder)
                            },
                            enabled = title.isNotBlank() && selectedClient != null,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MowGoColors.DeepGreenDark,
                            ),
                        ) {
                            Text("Create")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ClientPickerDialog(
    clients: List<Client>,
    onSelect: (Client) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Select Client", color = MowGoColors.TextPrimaryDark) },
        containerColor = MowGoColors.SurfaceDark,
        text = {
            LazyColumn {
                items(clients) { client ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { onSelect(client) }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = client.name,
                                color = MowGoColors.TextPrimaryDark,
                                fontWeight = FontWeight.Medium,
                            )
                            if (client.address != null) {
                                Text(
                                    text = client.address,
                                    color = MowGoColors.TextSecondaryDark,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                        Text(
                            text = "$${String.format("%.0f", client.rate)}",
                            color = MowGoColors.DeepGreenDark,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MowGoColors.TextSecondaryDark)
            }
        },
    )
}
