package com.mowgo.app.lib

import android.content.Context
import android.location.Address
import android.location.Geocoder
import android.os.Build
import java.util.Locale
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/**
 * Street-address geocoding for route optimization, using the platform
 * Geocoder (free, no API key) — the Android twin of iOS's CLGeocoder.
 * Returns null on any failure so the optimizer works around unmapped stops.
 */
class AddressGeocoder(private val context: Context) {

    suspend fun geocode(address: String): Coordinate? {
        val query = address.trim()
        if (query.isEmpty() || !Geocoder.isPresent()) return null
        val geocoder = Geocoder(context, Locale.getDefault())
        return try {
            val match = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                suspendCancellableCoroutine<Address?> { continuation ->
                    geocoder.getFromLocationName(query, 1, object : Geocoder.GeocodeListener {
                        override fun onGeocode(addresses: MutableList<Address>) {
                            if (continuation.isActive) continuation.resume(addresses.firstOrNull())
                        }

                        override fun onError(errorMessage: String?) {
                            if (continuation.isActive) continuation.resume(null)
                        }
                    })
                }
            } else {
                withContext(Dispatchers.IO) {
                    @Suppress("DEPRECATION")
                    geocoder.getFromLocationName(query, 1)?.firstOrNull()
                }
            }
            match?.takeIf { it.hasLatitude() && it.hasLongitude() }?.let { Coordinate(it.latitude, it.longitude) }
        } catch (e: Exception) {
            null
        }
    }
}
