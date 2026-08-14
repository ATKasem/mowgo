package com.mowgo.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.mowgo.app.data.local.entity.CachedInvoiceEntity

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM cached_invoices ORDER BY created_at DESC")
    suspend fun getAll(): List<CachedInvoiceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(invoices: List<CachedInvoiceEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(invoice: CachedInvoiceEntity)

    @Query("DELETE FROM cached_invoices WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM cached_invoices")
    suspend fun clearAll()

    @Transaction
    suspend fun replaceAll(invoices: List<CachedInvoiceEntity>) {
        clearAll()
        insertAll(invoices)
    }
}
