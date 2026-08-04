package com.mowgo.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class RainDelayEntry(
    val date: String,
    val targetDate: String,
    val jobIds: List<String>,
    val jobCount: Int,
    val createdAt: String,
    val originalDates: Map<String, String>,
)

data class RainDelayUndoResult(
    val restoredCount: Int,
    val skippedCount: Int,
    val remainingEntry: RainDelayEntry?,
)
