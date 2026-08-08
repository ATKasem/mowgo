package com.mowgo.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request

@Serializable
private data class WeatherResponse(val current: WeatherCurrent? = null, val daily: WeatherDaily? = null)

@Serializable
private data class WeatherCurrent(
    @SerialName("temperature_2m") val temperature: Double? = null,
    @SerialName("wind_speed_10m") val windSpeed: Double? = null,
)

@Serializable
private data class WeatherDaily(
    val time: List<String> = emptyList(),
    @SerialName("precipitation_probability_max") val precipitation: List<Int?> = emptyList(),
    @SerialName("temperature_2m_max") val temperatures: List<Double?> = emptyList(),
    @SerialName("precipitation_sum") val precipitationSum: List<Double?> = emptyList(),
    @SerialName("soil_temperature_0cm") val soilTemperature: List<Double?> = emptyList(),
)

enum class SprayStatus { GOOD, HOLD }

data class SprayRule(val maxTempF: Double, val maxWindMph: Double)

data class WeatherForecast(
    val date: String,
    val precipitationProbability: Int,
    val maxTemperature: Double?,
    val currentTempF: Double? = null,
    val windMph: Double? = null,
    val soilTempF: Double? = null,
    val rain7dInches: Double? = null,
) {
    /** GOOD when current temp/wind are both within the spray window; HOLD otherwise; null when inputs are missing. */
    fun sprayStatus(): SprayStatus? {
        val temp = currentTempF ?: return null
        val wind = windMph ?: return null
        return if (temp <= SPRAY_RULE.maxTempF && wind <= SPRAY_RULE.maxWindMph) SprayStatus.GOOD else SprayStatus.HOLD
    }

    companion object {
        val SPRAY_RULE = SprayRule(maxTempF = 85.0, maxWindMph = 10.0)
    }
}

class WeatherRepository(private val client: OkHttpClient = OkHttpClient()) {
    suspend fun forecast(latitude: Double?, longitude: Double?): List<WeatherForecast>? {
        if (latitude == null || longitude == null || !SupabaseClientProvider.isConfigured) return null
        return withContext(Dispatchers.IO) {
            try {
                val url = "https://api.open-meteo.com/v1/forecast".toHttpUrl().newBuilder()
                    .addQueryParameter("latitude", latitude.toString())
                    .addQueryParameter("longitude", longitude.toString())
                    .addQueryParameter("current", "temperature_2m,wind_speed_10m")
                    .addQueryParameter("daily", "precipitation_probability_max,temperature_2m_max,precipitation_sum,soil_temperature_0cm")
                    .addQueryParameter("past_days", "7")
                    .addQueryParameter("forecast_days", "2")
                    .addQueryParameter("timezone", "auto")
                    .addQueryParameter("temperature_unit", "fahrenheit")
                    .addQueryParameter("wind_speed_unit", "mph")
                    .addQueryParameter("precipitation_unit", "inch")
                    .build()
                client.newCall(Request.Builder().url(url).build()).execute().use { response ->
                    if (!response.isSuccessful) return@withContext null
                    val body = Json { ignoreUnknownKeys = true }
                        .decodeFromString<WeatherResponse>(response.body?.string().orEmpty())
                    val daily = body.daily ?: return@withContext null
                    // Daily array spans past_days=7 + forecast_days=2 (today + tomorrow).
                    // Today sits at index (size - 2) in the API's own timeline (timezone=auto) —
                    // deriving from response length (not the device clock) avoids an
                    // off-by-one when device and business are in different timezones.
                    val todayIndex = daily.time.size - 2
                    val soilTempF = if (todayIndex >= 0) daily.soilTemperature.getOrNull(todayIndex) else null
                    val rain7dInches = if (todayIndex >= 0) {
                        daily.precipitationSum.take(todayIndex + 1).filterNotNull().sum()
                    } else null
                    val todayDate = daily.time.getOrNull(todayIndex)
                    val tomorrowDate = daily.time.getOrNull(todayIndex + 1)
                    daily.time.mapIndexedNotNull { index, date ->
                        daily.precipitation.getOrNull(index)?.let {
                            WeatherForecast(
                                date = date,
                                precipitationProbability = it,
                                maxTemperature = daily.temperatures.getOrNull(index),
                                currentTempF = body.current?.temperature,
                                windMph = body.current?.windSpeed,
                                soilTempF = soilTempF,
                                rain7dInches = rain7dInches,
                            )
                        }
                    }.filter { it.date == todayDate || it.date == tomorrowDate }
                }
            } catch (_: Exception) { null }
        }
    }
}
