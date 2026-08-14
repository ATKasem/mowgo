package com.mowgo.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.mowgo.app.data.model.Lead

/** Local cache of the Supabase `leads` table, keyed by lead id. */
@Entity(tableName = "cached_leads")
data class CachedLeadEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "user_id")
    val userId: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "phone")
    val phone: String?,

    @ColumnInfo(name = "email")
    val email: String?,

    @ColumnInfo(name = "address")
    val address: String?,

    @ColumnInfo(name = "source")
    val source: String,

    @ColumnInfo(name = "notes")
    val notes: String?,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "client_id")
    val clientId: String?,

    @ColumnInfo(name = "created_at")
    val createdAt: String?,

    @ColumnInfo(name = "updated_at")
    val updatedAt: String?,
)

fun Lead.toCachedEntity(): CachedLeadEntity = CachedLeadEntity(
    id = id,
    userId = userId,
    name = name,
    phone = phone,
    email = email,
    address = address,
    source = source,
    notes = notes,
    status = status,
    clientId = clientId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

fun CachedLeadEntity.toLead(): Lead = Lead(
    id = id,
    userId = userId,
    name = name,
    phone = phone,
    email = email,
    address = address,
    source = source,
    notes = notes,
    status = status,
    clientId = clientId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
