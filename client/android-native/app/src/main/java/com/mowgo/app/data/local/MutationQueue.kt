package com.mowgo.app.data.local

import com.mowgo.app.data.local.dao.MutationDao
import com.mowgo.app.data.local.entity.MutationEntity
import com.mowgo.app.data.sync.SyncManager

/** A dequeued mutation, ready to be replayed against the online repositories. */
data class QueuedMutation(
    val id: Long,
    val operation: String,
    val entityId: String,
    val payload: String,
)

/**
 * Room-backed FIFO queue of offline writes. Mutations are replayed in the order
 * they were enqueued — [processNext] always picks the oldest row, and stops
 * (without deleting it) on failure so a later mutation can't apply out of order
 * ahead of one that didn't make it through yet.
 */
class MutationQueue(private val dao: MutationDao) {

    sealed class ProcessResult {
        object Empty : ProcessResult()
        object Success : ProcessResult()
        object Failed : ProcessResult()
    }

    suspend fun enqueue(operation: String, entityId: String, payload: String) {
        dao.insert(
            MutationEntity(
                operation = operation,
                entityId = entityId,
                payload = payload,
                createdAt = System.currentTimeMillis(),
            )
        )
        // Don't wait solely for the next offline→online transition — a mutation can
        // be queued mid-session (a single request failing) without the device ever
        // being reported fully offline, so nothing else would schedule the replay.
        SyncManager.triggerSync()
    }

    suspend fun pendingCount(): Int = dao.count()

    suspend fun pending(): List<QueuedMutation> = dao.getAll().map {
        QueuedMutation(it.id, it.operation, it.entityId, it.payload)
    }

    /**
     * Attempts the oldest queued mutation via [execute]. Removes it on success;
     * on failure marks it failed (kept at the head of the queue for the next retry)
     * and returns [ProcessResult.Failed] so the caller stops draining.
     */
    suspend fun processNext(execute: suspend (QueuedMutation) -> Unit): ProcessResult {
        val next = dao.oldest(MAX_RETRIES) ?: return ProcessResult.Empty
        dao.updateStatus(next.id, MutationEntity.STATUS_PROCESSING)
        return try {
            execute(QueuedMutation(next.id, next.operation, next.entityId, next.payload))
            dao.deleteById(next.id)
            ProcessResult.Success
        } catch (_: Exception) {
            val status = if (next.retryCount + 1 >= MAX_RETRIES) {
                MutationEntity.STATUS_FAILED
            } else {
                MutationEntity.STATUS_PENDING
            }
            dao.recordFailure(next.id, status)
            ProcessResult.Failed
        }
    }

    suspend fun clearAll() = dao.clearAll()

    private companion object {
        const val MAX_RETRIES = 3
    }
}
