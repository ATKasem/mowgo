package com.mowgo.app.data.model

/**
 * UI-friendly job model that joins Job data with Client info.
 * Created in the repository after fetching both tables.
 */
data class JobWithClient(
    val job: Job,
    val clientName: String,
    val clientRate: Double,
    val clientAddress: String?,
) {
    val id: String get() = job.id
    val title: String get() = job.title
    val scheduledDate: String get() = job.scheduledDate
    val scheduledTime: String? get() = job.scheduledTime
    val status: String get() = job.status
    val routeOrder: Int? get() = job.routeOrder
    val notes: String? get() = job.notes
    val assignedTo: String? get() = job.assignedTo
    val recurrenceRule: String? get() = job.recurrenceRule
    val clientId: String get() = job.clientId
    val userId: String get() = job.userId
}
