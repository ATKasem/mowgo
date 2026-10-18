package com.mowgo.app.lib

import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

/**
 * Formats a Postgres `time` value for display in the user's locale ("8:00 AM").
 * The DB returns "08:00:00" even though the app writes "08:00", so both are
 * accepted; anything unparseable is shown as-is rather than hidden.
 */
object ScheduledTimeFormat {
    private val parsers = listOf("HH:mm:ss", "HH:mm").map { DateTimeFormatter.ofPattern(it, Locale.US) }

    fun display(raw: String): String {
        val time = parsers.firstNotNullOfOrNull { parser -> runCatching { LocalTime.parse(raw, parser) }.getOrNull() }
            ?: return raw
        return time.format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(Locale.getDefault()))
    }
}
