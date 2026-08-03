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
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.ui.theme.MowGoColors

/**
 * Dialog for editing an existing job.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditJobDialog(
    jobWithClient: JobWithClient,
    clients: List<Client>,
    onDismiss: () -> Unit,
    onSave: (Job) -> Unit,
) {
    var title by remember { mutableStateOf(jobWithClient.title) }
    var selectedClient by remember {
        mutableStateOf(clients.find { it.id == jobWithClient.clientId })
    }
    var notes by remember { mutableStateOf(jobWithClient.notes ?: "") }
    var routeOrderText by remember { mutableStateOf(jobWithClient.routeOrder?.toString() ?: "") }
    var showClientPicker by remember { mutableStateOf(false) }

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

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = MowGoColors.SurfaceDark),
            shape = RoundedCornerShape(16.dp),
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = "Edit Job",
                    style = MaterialTheme.typography.titleLarge,
                    color = MowGoColors.TextPrimaryDark,
                    fontWeight = FontWeight.Bold,
                )

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

                OutlinedTextField(
                    value = routeOrderText,
                    onValueChange = { routeOrderText = it.filter { c -> c.isDigit() } },
                    label = { Text("Route Order") },
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

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes") },
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

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = MowGoColors.TextSecondaryDark)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val updatedJob = jobWithClient.job.copy(
                                title = title,
                                clientId = selectedClient?.id ?: jobWithClient.clientId,
                                notes = notes.ifBlank { null },
                                routeOrder = routeOrderText.toIntOrNull(),
                            )
                            onSave(updatedJob)
                        },
                        enabled = title.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MowGoColors.DeepGreenDark,
                        ),
                    ) {
                        Text("Save")
                    }
                }
            }
        }
    }
}
