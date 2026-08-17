import Foundation

enum RouteOptimizer {
    typealias Entry = (id: UUID, lat: Double?, lng: Double?)
    typealias Coordinate = (lat: Double, lng: Double)

    static func haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double) -> Double {
        let earthRadiusKm = 6_371.0
        let toRadians = { (degrees: Double) in degrees * .pi / 180 }
        let deltaLatitude = toRadians(lat2 - lat1)
        let deltaLongitude = toRadians(lon2 - lon1)
        let value = pow(sin(deltaLatitude / 2), 2)
            + cos(toRadians(lat1)) * cos(toRadians(lat2)) * pow(sin(deltaLongitude / 2), 2)
        return 2 * earthRadiusKm * asin(sqrt(value))
    }

    static func nearestNeighborTour(entries: [Entry], anchor: Coordinate?) -> [Entry] {
        var remaining = entries.filter { $0.lat != nil && $0.lng != nil }
        var tour: [Entry] = []
        var current = anchor

        while !remaining.isEmpty {
            let bestIndex: Int
            if let current {
                bestIndex = remaining.indices.min { lhs, rhs in
                    distance(from: current, to: remaining[lhs]) < distance(from: current, to: remaining[rhs])
                } ?? remaining.startIndex
            } else {
                bestIndex = remaining.startIndex
            }
            let next = remaining.remove(at: bestIndex)
            tour.append(next)
            current = coordinate(for: next)
        }
        return tour
    }

    static func twoOpt(tour: [Entry], anchor: Coordinate?) -> [Entry] {
        guard tour.count > 1 else { return tour }
        var best = tour
        var improved = true
        while improved {
            improved = false
            for start in 0..<(best.count - 1) {
                for end in (start + 1)..<best.count {
                    var candidate = best
                    candidate.replaceSubrange(start...end, with: best[start...end].reversed())
                    if totalDistance(candidate, anchor: anchor) + 1e-12 < totalDistance(best, anchor: anchor) {
                        best = candidate
                        improved = true
                    }
                }
            }
        }
        return best
    }

    static func optimizeRoute(entries: [Entry], anchor: Coordinate?) -> [UUID] {
        guard entries.count > 2 else { return entries.map(\.id) }
        let mappedIndices = entries.indices.filter { entries[$0].lat != nil && entries[$0].lng != nil }
        guard mappedIndices.count >= 2 else { return entries.map(\.id) }

        let mapped = mappedIndices.map { entries[$0] }
        let nearest = nearestNeighborTour(entries: mapped, anchor: anchor)
        let optimized = mapped.count <= 30 ? twoOpt(tour: nearest, anchor: anchor) : nearest
        var optimizedIterator = optimized.makeIterator()

        return entries.map { entry in
            guard entry.lat != nil, entry.lng != nil else { return entry.id }
            return optimizedIterator.next()?.id ?? entry.id
        }
    }

    private static func coordinate(for entry: Entry) -> Coordinate? {
        guard let lat = entry.lat, let lng = entry.lng else { return nil }
        return (lat, lng)
    }

    private static func distance(from coordinate: Coordinate, to entry: Entry) -> Double {
        guard let target = coordinate(for: entry) else { return .infinity }
        return haversineKm(lat1: coordinate.lat, lon1: coordinate.lng,
                           lat2: target.lat, lon2: target.lng)
    }

    private static func totalDistance(_ tour: [Entry], anchor: Coordinate?) -> Double {
        guard let first = tour.first, let firstCoordinate = coordinate(for: first) else { return 0 }
        var total = anchor.map {
            haversineKm(lat1: $0.lat, lon1: $0.lng, lat2: firstCoordinate.lat, lon2: firstCoordinate.lng)
        } ?? 0
        for index in 1..<tour.count {
            guard let previous = coordinate(for: tour[index - 1]),
                  let current = coordinate(for: tour[index]) else { continue }
            total += haversineKm(lat1: previous.lat, lon1: previous.lng,
                                 lat2: current.lat, lon2: current.lng)
        }
        return total
    }
}
