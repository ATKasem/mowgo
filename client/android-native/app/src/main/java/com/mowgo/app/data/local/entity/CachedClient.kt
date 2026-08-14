package com.mowgo.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.mowgo.app.data.model.Client

/** Local cache of the Supabase `clients` table, keyed by client id. */
@Entity(tableName = "cached_clients")
data class CachedClientEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "user_id")
    val userId: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "address")
    val address: String?,

    @ColumnInfo(name = "phone")
    val phone: String?,

    @ColumnInfo(name = "email")
    val email: String?,

    @ColumnInfo(name = "rate")
    val rate: Double,

    @ColumnInfo(name = "key_code")
    val keyCode: String?,

    @ColumnInfo(name = "pet_instructions")
    val petInstructions: String?,

    @ColumnInfo(name = "alarm_code")
    val alarmCode: String?,

    @ColumnInfo(name = "cleaning_notes")
    val cleaningNotes: String?,

    @ColumnInfo(name = "created_at")
    val createdAt: String?,
)

fun Client.toCachedEntity(): CachedClientEntity = CachedClientEntity(
    id = id,
    userId = userId,
    name = name,
    address = address,
    phone = phone,
    email = email,
    rate = rate,
    keyCode = keyCode,
    petInstructions = petInstructions,
    alarmCode = alarmCode,
    cleaningNotes = cleaningNotes,
    createdAt = createdAt,
)

fun CachedClientEntity.toClient(): Client = Client(
    id = id,
    userId = userId,
    name = name,
    address = address,
    phone = phone,
    email = email,
    rate = rate,
    keyCode = keyCode,
    petInstructions = petInstructions,
    alarmCode = alarmCode,
    cleaningNotes = cleaningNotes,
    createdAt = createdAt,
)
