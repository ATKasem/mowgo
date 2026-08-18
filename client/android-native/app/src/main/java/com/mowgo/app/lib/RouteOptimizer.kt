package com.mowgo.app.lib

import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.round
import kotlin.math.sin
import kotlin.math.sqrt

data class Entry(val id: String, val lat: Double?, val lng: Double?)

data class Coordinate(val lat: Double, val lng: Double)

data class DaySuggestion(val dayIndex: Int, val dayName: String, val avgDistanceKm: Double)

object RouteOptimizer {
    private val dayNames = listOf(
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    )

    fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val earthRadiusKm = 6_371.0
        val toRadians = { degrees: Double -> degrees * PI / 180 }
        val latitudeDelta = toRadians(lat2 - lat1)
        val longitudeDelta = toRadians(lon2 - lon1)
        val value = sin(latitudeDelta / 2).pow(2) +
            cos(toRadians(lat1)) * cos(toRadians(lat2)) * sin(longitudeDelta / 2).pow(2)

        return 2 * earthRadiusKm * asin(sqrt(value))
    }

    fun nearestNeighborTour(entries: List<Entry>, anchor: Coordinate?): List<Entry> {
        val remaining = entries.filter { it.coordinate != null }.toMutableList()
        val tour = mutableListOf<Entry>()
        var current = anchor

        while (remaining.isNotEmpty()) {
            val closestIndex = if (current == null) {
                0
            } else {
                remaining.indices.minBy { index -> distance(current, remaining[index]) }
            }
            val next = remaining.removeAt(closestIndex)
            tour.add(next)
            current = next.coordinate
        }

        return tour
    }

    fun twoOpt(tour: List<Entry>, anchor: Coordinate?): List<Entry> {
        if (tour.size < 2) return tour

        var best = tour.toList()
        var improved = true
        while (improved) {
            improved = false
            for (start in 0 until best.lastIndex) {
                for (end in (start + 1)..best.lastIndex) {
                    val candidate = best.toMutableList().apply {
                        subList(start, end + 1).reverse()
                    }
                    if (totalDistance(candidate, anchor) + 1e-12 < totalDistance(best, anchor)) {
                        best = candidate
                        improved = true
                    }
                }
            }
        }

        return best
    }

    fun optimizeRoute(entries: List<Entry>, anchor: Coordinate?): List<String> {
        if (entries.size <= 2) return entries.map(Entry::id)

        val addressable = entries.filter { it.coordinate != null }
        if (addressable.size < 2) return entries.map(Entry::id)

        val nearest = nearestNeighborTour(addressable, anchor)
        val optimized = if (addressable.size <= 30) twoOpt(nearest, anchor) else nearest
        val optimizedIterator = optimized.iterator()

        return entries.map { entry ->
            if (entry.coordinate == null) entry.id else optimizedIterator.next().id
        }
    }

    fun suggestDay(
        jobsByDay: Map<Int, List<Coordinate>>,
        newClient: Coordinate,
    ): DaySuggestion? {
        var bestDay: Int? = null
        var bestAverage = Double.POSITIVE_INFINITY

        for ((dayIndex, jobs) in jobsByDay) {
            if (jobs.isEmpty()) continue

            val average = jobs.sumOf { job ->
                haversineKm(newClient.lat, newClient.lng, job.lat, job.lng)
            } / jobs.size
            if (average < bestAverage) {
                bestAverage = average
                bestDay = dayIndex
            }
        }

        val dayIndex = bestDay ?: return null
        return DaySuggestion(
            dayIndex = dayIndex,
            dayName = dayNames[dayIndex],
            avgDistanceKm = round(bestAverage * 10) / 10,
        )
    }

    private val Entry.coordinate: Coordinate?
        get() = if (lat != null && lng != null) Coordinate(lat, lng) else null

    private fun distance(from: Coordinate, to: Entry): Double {
        val target = to.coordinate ?: return Double.POSITIVE_INFINITY
        return haversineKm(from.lat, from.lng, target.lat, target.lng)
    }

    private fun totalDistance(tour: List<Entry>, anchor: Coordinate?): Double {
        val first = tour.firstOrNull()?.coordinate ?: return 0.0
        var total = anchor?.let { haversineKm(it.lat, it.lng, first.lat, first.lng) } ?: 0.0

        for (index in 1 until tour.size) {
            val previous = tour[index - 1].coordinate ?: continue
            val current = tour[index].coordinate ?: continue
            total += haversineKm(previous.lat, previous.lng, current.lat, current.lng)
        }

        return total
    }
}
