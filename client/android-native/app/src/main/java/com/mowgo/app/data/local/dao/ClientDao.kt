package com.mowgo.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.mowgo.app.data.local.entity.CachedClientEntity

@Dao
interface ClientDao {
    @Query("SELECT * FROM cached_clients ORDER BY name ASC")
    suspend fun getAll(): List<CachedClientEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(clients: List<CachedClientEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(client: CachedClientEntity)

    @Query("DELETE FROM cached_clients WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM cached_clients")
    suspend fun clearAll()

    @Transaction
    suspend fun replaceAll(clients: List<CachedClientEntity>) {
        clearAll()
        insertAll(clients)
    }
}
