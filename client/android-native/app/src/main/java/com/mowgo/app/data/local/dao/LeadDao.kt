package com.mowgo.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.mowgo.app.data.local.entity.CachedLeadEntity

@Dao
interface LeadDao {
    @Query("SELECT * FROM cached_leads ORDER BY created_at DESC")
    suspend fun getAll(): List<CachedLeadEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(leads: List<CachedLeadEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(lead: CachedLeadEntity)

    @Query("DELETE FROM cached_leads WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM cached_leads")
    suspend fun clearAll()

    @Transaction
    suspend fun replaceAll(leads: List<CachedLeadEntity>) {
        clearAll()
        insertAll(leads)
    }
}
