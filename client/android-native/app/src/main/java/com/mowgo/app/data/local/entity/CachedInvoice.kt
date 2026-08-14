package com.mowgo.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.mowgo.app.data.model.Invoice

/** Local cache of the Supabase `invoices` table, keyed by invoice id. */
@Entity(tableName = "cached_invoices")
data class CachedInvoiceEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "user_id")
    val userId: String,

    @ColumnInfo(name = "client_id")
    val clientId: String?,

    @ColumnInfo(name = "job_id")
    val jobId: String?,

    @ColumnInfo(name = "amount")
    val amount: Double,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "paid_at")
    val paidAt: String?,

    @ColumnInfo(name = "created_at")
    val createdAt: String?,
)

fun Invoice.toCachedEntity(): CachedInvoiceEntity = CachedInvoiceEntity(
    id = id,
    userId = userId,
    clientId = clientId,
    jobId = jobId,
    amount = amount,
    status = status,
    paidAt = paidAt,
    createdAt = createdAt,
)

fun CachedInvoiceEntity.toInvoice(): Invoice = Invoice(
    id = id,
    userId = userId,
    clientId = clientId,
    jobId = jobId,
    amount = amount,
    status = status,
    paidAt = paidAt,
    createdAt = createdAt,
)
