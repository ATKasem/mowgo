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
    val photoUrl: String? get() = job.photoUrl

    companion object {
        /**
         * Stable order for a day's stops, matching web and iOS: route order
         * first (unordered last), then time (untimed last), then id. Status
         * deliberately plays no part — a job must not move when it is started
         * or completed, or the next tap lands on a different job. Times compare
         * as HH:mm: the app writes "08:00", the DB returns "08:00:00".
         */
        val DISPLAY_ORDER: Comparator<JobWithClient> =
            compareBy<JobWithClient> { it.routeOrder ?: Int.MAX_VALUE }
                .thenBy(nullsLast()) { it.scheduledTime?.take(5) }
                .thenBy { it.id }

        /** All loaded jobs: by date, then [DISPLAY_ORDER] within each day. */
        val SCHEDULE_ORDER: Comparator<JobWithClient> =
            compareBy<JobWithClient> { it.scheduledDate }.then(DISPLAY_ORDER)
    }
}
