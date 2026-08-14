package com.mowgo.app.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.mowgo.app.data.local.entity.CachedJobEntity

@Dao
interface JobDao {
    @Query("SELECT * FROM cached_jobs ORDER BY scheduled_date ASC, route_order ASC")
    suspend fun getAll(): List<CachedJobEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(jobs: List<CachedJobEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(job: CachedJobEntity)

    @Query("DELETE FROM cached_jobs WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM cached_jobs")
    suspend fun clearAll()

    /** Write-through replace: swap the whole cached set for a fresh online load. */
    @Transaction
    suspend fun replaceAll(jobs: List<CachedJobEntity>) {
        clearAll()
        insertAll(jobs)
    }
}
