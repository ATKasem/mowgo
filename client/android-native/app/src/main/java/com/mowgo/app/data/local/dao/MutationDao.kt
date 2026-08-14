package com.mowgo.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.mowgo.app.data.local.entity.MutationEntity

@Dao
interface MutationDao {
    /** Oldest retryable pending mutation, FIFO. */
    @Query("SELECT * FROM mutation_queue WHERE status = 'pending' AND retry_count < :maxRetries ORDER BY id ASC LIMIT 1")
    suspend fun oldest(maxRetries: Int): MutationEntity?

    @Query("SELECT * FROM mutation_queue ORDER BY id ASC")
    suspend fun getAll(): List<MutationEntity>

    @Query("SELECT COUNT(*) FROM mutation_queue")
    suspend fun count(): Int

    @Insert
    suspend fun insert(mutation: MutationEntity): Long

    @Query("UPDATE mutation_queue SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: Long, status: String)

    @Query("UPDATE mutation_queue SET status = :status, retry_count = retry_count + 1 WHERE id = :id")
    suspend fun recordFailure(id: Long, status: String)

    @Query("DELETE FROM mutation_queue WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM mutation_queue")
    suspend fun clearAll()
}
