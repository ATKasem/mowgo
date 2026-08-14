package com.mowgo.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A single queued offline write. `operation` identifies which repository call to
 * replay (e.g. "job:status", "job:create") — see [com.mowgo.app.data.sync.SyncManager].
 */
@Entity(tableName = "mutation_queue")
data class MutationEntity(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "id")
    val id: Long = 0,

    @ColumnInfo(name = "operation")
    val operation: String,

    @ColumnInfo(name = "entity_id")
    val entityId: String,

    @ColumnInfo(name = "payload")
    val payload: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "status")
    val status: String = STATUS_PENDING,

    @ColumnInfo(name = "retry_count")
    val retryCount: Int = 0,
) {
    companion object {
        const val STATUS_PENDING = "pending"
        const val STATUS_PROCESSING = "processing"
        const val STATUS_FAILED = "failed"
    }
}
