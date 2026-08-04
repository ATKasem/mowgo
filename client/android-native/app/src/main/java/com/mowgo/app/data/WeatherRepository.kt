package com.mowgo.app.data

import java.time.LocalDate
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
private data class WeatherResponse(val daily: WeatherDaily? = null)

@Serializable
private data class WeatherDaily(
    val time: List<String> = emptyList(),
    @SerialName("precipitation_probability_max") val precipitation: List<Int?> = emptyList(),
    @SerialName("temperature_2m_max") val temperatures: List<Double?> = emptyList(),
)

data class WeatherForecast(val date: String, val precipitationProbability: Int, val maxTemperature: Double?)

class WeatherRepository(private val client: OkHttpClient = OkHttpClient()) {
    suspend fun forecast(latitude: Double?, longitude: Double?): List<WeatherForecast>? {
        if (latitude == null || longitude == null || !SupabaseClientProvider.isConfigured) return null
        return withContext(Dispatchers.IO) {
            try {
                val url = "https://api.open-meteo.com/v1/forecast".toHttpUrl().newBuilder()
                    .addQueryParameter("latitude", latitude.toString())
                    .addQueryParameter("longitude", longitude.toString())
                    .addQueryParameter("daily", "precipitation_probability_max,temperature_2m_max")
                    .addQueryParameter("timezone", "auto").build()
                client.newCall(Request.Builder().url(url).build()).execute().use { response ->
                    if (!response.isSuccessful) return@withContext null
                    val daily = Json { ignoreUnknownKeys = true }
                        .decodeFromString<WeatherResponse>(response.body?.string().orEmpty()).daily ?: return@withContext null
                    daily.time.mapIndexedNotNull { index, date ->
                        daily.precipitation.getOrNull(index)?.let { WeatherForecast(date, it, daily.temperatures.getOrNull(index)) }
                    }.filter { it.date == LocalDate.now().toString() || it.date == LocalDate.now().plusDays(1).toString() }
                }
            } catch (_: Exception) { null }
        }
    }
}
