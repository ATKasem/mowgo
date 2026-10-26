package com.mowgo.app.lib

import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Supabase `timestamptz` values for display. PostgREST returns them with a
 * numeric offset ("2026-10-24T23:40:12.345678+00:00"); `Instant.parse` only
 * accepts a trailing "Z" on JDK-11-based runtimes (Android 13 and earlier), so
 * callers that fell back to `raw.take(10)` showed the UTC day — tomorrow for
 * evening invoices in the US. Parse the offset form and convert to local time.
 */
object Timestamps {
    fun parseInstant(raw: String): Instant? =
        runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
            ?: runCatching { Instant.parse(raw) }.getOrNull()

    /** The device-local calendar day of [raw], or null when unparseable. */
    fun localDate(raw: String): LocalDate? =
        parseInstant(raw)?.atZone(ZoneId.systemDefault())?.toLocalDate()

    /** [raw]'s local day formatted with [pattern]; unparseable input falls back to its date prefix. */
    fun formatLocalDate(raw: String, pattern: String): String =
        localDate(raw)?.format(DateTimeFormatter.ofPattern(pattern)) ?: raw.take(10)
}
