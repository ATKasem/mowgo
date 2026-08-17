import Foundation

enum PreferredNavigationApp: String, CaseIterable, Identifiable {
    case appleMaps = "apple"
    case googleMaps = "google"
    case waze

    var id: String { rawValue }
    var label: String {
        switch self {
        case .appleMaps: "Apple Maps"
        case .googleMaps: "Google Maps"
        case .waze: "Waze"
        }
    }
}

struct RouteStop: Identifiable {
    let id = UUID()
    let name: String
    let address: String
    let latitude: Double
    let longitude: Double
}

enum NavigationRouteBuilder {
    static func multiStopURL(
        app: PreferredNavigationApp,
        stops: [RouteStop],
        anchor: (lat: Double, lng: Double)?
    ) -> URL? {
        guard let destination = stops.last else { return nil }
        switch app {
        case .waze:
            return nil
        case .googleMaps:
            let capped = Array(stops.prefix(10))
            guard let last = capped.last else { return nil }
            var items = [
                URLQueryItem(name: "api", value: "1"),
                URLQueryItem(name: "travelmode", value: "driving")
            ]
            if let anchor { items.append(URLQueryItem(name: "origin", value: coordinate(anchor.lat, anchor.lng))) }
            items.append(URLQueryItem(name: "destination", value: coordinate(last.latitude, last.longitude)))
            let waypoints = capped.dropLast().map { coordinate($0.latitude, $0.longitude) }.joined(separator: "|")
            if !waypoints.isEmpty { items.append(URLQueryItem(name: "waypoints", value: waypoints)) }
            var components = URLComponents(string: "https://www.google.com/maps/dir/")
            components?.queryItems = items
            return components?.url
        case .appleMaps:
            var items: [URLQueryItem] = []
            if let anchor { items.append(URLQueryItem(name: "source", value: coordinate(anchor.lat, anchor.lng))) }
            items.append(URLQueryItem(name: "destination", value: coordinate(destination.latitude, destination.longitude)))
            items.append(contentsOf: stops.dropLast().map {
                URLQueryItem(name: "waypoint", value: coordinate($0.latitude, $0.longitude))
            })
            items.append(URLQueryItem(name: "mode", value: "driving"))
            var components = URLComponents(string: "https://maps.apple.com/directions")
            components?.queryItems = items
            return components?.url
        }
    }

    static func singleStopURL(app: PreferredNavigationApp, stop: RouteStop) -> URL? {
        let coordinateValue = coordinate(stop.latitude, stop.longitude)
        switch app {
        case .appleMaps:
            var components = URLComponents(string: "https://maps.apple.com/")
            components?.queryItems = [URLQueryItem(name: "daddr", value: coordinateValue),
                                      URLQueryItem(name: "dirflg", value: "d")]
            return components?.url
        case .googleMaps:
            var components = URLComponents(string: "https://www.google.com/maps/dir/")
            components?.queryItems = [URLQueryItem(name: "api", value: "1"),
                                      URLQueryItem(name: "destination", value: coordinateValue),
                                      URLQueryItem(name: "travelmode", value: "driving")]
            return components?.url
        case .waze:
            var components = URLComponents(string: "https://waze.com/ul")
            components?.queryItems = [URLQueryItem(name: "ll", value: coordinateValue),
                                      URLQueryItem(name: "navigate", value: "yes")]
            return components?.url
        }
    }

    private static func coordinate(_ latitude: Double, _ longitude: Double) -> String {
        "\(latitude),\(longitude)"
    }
}
