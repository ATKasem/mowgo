package com.mowgo.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.mowgo.app.data.model.Job

/** Local cache of the Supabase `jobs` table, keyed by job id. */
@Entity(tableName = "cached_jobs")
data class CachedJobEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "user_id")
    val userId: String,

    @ColumnInfo(name = "client_id")
    val clientId: String,

    @ColumnInfo(name = "title")
    val title: String,

    @ColumnInfo(name = "scheduled_date")
    val scheduledDate: String,

    @ColumnInfo(name = "scheduled_time")
    val scheduledTime: String?,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "assigned_to")
    val assignedTo: String?,

    @ColumnInfo(name = "route_order")
    val routeOrder: Int?,

    @ColumnInfo(name = "duration_minutes")
    val durationMinutes: Int?,

    @ColumnInfo(name = "notes")
    val notes: String?,

    @ColumnInfo(name = "recurrence_rule")
    val recurrenceRule: String?,

    @ColumnInfo(name = "photo_url")
    val photoUrl: String?,
)

fun Job.toCachedEntity(): CachedJobEntity = CachedJobEntity(
    id = id,
    userId = userId,
    clientId = clientId,
    title = title,
    scheduledDate = scheduledDate,
    scheduledTime = scheduledTime,
    status = status,
    assignedTo = assignedTo,
    routeOrder = routeOrder,
    durationMinutes = durationMinutes,
    notes = notes,
    recurrenceRule = recurrenceRule,
    photoUrl = photoUrl,
)

fun CachedJobEntity.toJob(): Job = Job(
    id = id,
    userId = userId,
    clientId = clientId,
    title = title,
    scheduledDate = scheduledDate,
    scheduledTime = scheduledTime,
    status = status,
    assignedTo = assignedTo,
    routeOrder = routeOrder,
    durationMinutes = durationMinutes,
    notes = notes,
    recurrenceRule = recurrenceRule,
    photoUrl = photoUrl,
)
