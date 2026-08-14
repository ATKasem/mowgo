package com.mowgo.app.data.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.local.AppDatabaseProvider
import com.mowgo.app.data.local.MutationQueue

/**
 * Replays queued offline mutations in FIFO order. Stops (returning [Result.retry])
 * at the first failure instead of skipping ahead, so a later write can't land
 * before an earlier one that hasn't made it through yet.
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val jobRepository = JobRepository()

    override suspend fun doWork(): Result {
        val queue = AppDatabaseProvider.mutationQueue
        while (true) {
            val result = queue.processNext { mutation ->
                jobRepository.replayMutation(mutation.operation, mutation.entityId, mutation.payload)
            }
            when (result) {
                MutationQueue.ProcessResult.Empty -> return Result.success()
                MutationQueue.ProcessResult.Success -> continue
                MutationQueue.ProcessResult.Failed -> return Result.retry()
            }
        }
    }
}
