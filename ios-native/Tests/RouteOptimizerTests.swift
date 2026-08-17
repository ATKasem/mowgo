import XCTest
@testable import MowGo

final class RouteOptimizerTests: XCTestCase {
    func testHaversineReturnsKnownDistance() {
        let distance = RouteOptimizer.haversineKm(lat1: 35.4676, lon1: -97.5164,
                                                  lat2: 36.1540, lon2: -95.9928)
        XCTAssertEqual(distance, 157.2, accuracy: 1.0)
    }

    func testNearestNeighborStartsClosestToAnchor() {
        let near = UUID(), middle = UUID(), far = UUID()
        let entries = [
            (id: far, lat: Optional(35.7), lng: Optional(-97.5)),
            (id: near, lat: Optional(35.51), lng: Optional(-97.5)),
            (id: middle, lat: Optional(35.6), lng: Optional(-97.5))
        ]

        let result = RouteOptimizer.nearestNeighborTour(entries: entries, anchor: (lat: 35.5, lng: -97.5))

        XCTAssertEqual(result.map(\.id), [near, middle, far])
    }

    func testOptimizeKeepsUnmappedJobsInTheirOriginalSlots() {
        let far = UUID(), unmapped = UUID(), near = UUID()
        let entries = [
            (id: far, lat: Optional(35.7), lng: Optional(-97.5)),
            (id: unmapped, lat: Optional<Double>.none, lng: Optional<Double>.none),
            (id: near, lat: Optional(35.51), lng: Optional(-97.5))
        ]

        let result = RouteOptimizer.optimizeRoute(entries: entries, anchor: (lat: 35.5, lng: -97.5))

        XCTAssertEqual(result, [near, unmapped, far])
    }

    func testOptimizeReturnsOriginalOrderWithFewerThanTwoMappedJobs() {
        let first = UUID(), second = UUID(), third = UUID()
        let entries = [
            (id: first, lat: Optional<Double>.none, lng: Optional<Double>.none),
            (id: second, lat: Optional(35.5), lng: Optional(-97.5)),
            (id: third, lat: Optional<Double>.none, lng: Optional<Double>.none)
        ]

        XCTAssertEqual(RouteOptimizer.optimizeRoute(entries: entries, anchor: nil),
                       [first, second, third])
    }
}

final class NavigationRouteBuilderTests: XCTestCase {
    private let stops = [
        RouteStop(name: "First", address: "1 Main St", latitude: 35.5, longitude: -97.5),
        RouteStop(name: "Second", address: "2 Main St", latitude: 35.6, longitude: -97.6),
        RouteStop(name: "Third", address: "3 Main St", latitude: 35.7, longitude: -97.7)
    ]

    func testGoogleRouteContainsOriginWaypointAndDestination() {
        let url = NavigationRouteBuilder.multiStopURL(
            app: .googleMaps, stops: stops, anchor: (lat: 35.4, lng: -97.4)
        )
        let components = URLComponents(url: try! XCTUnwrap(url), resolvingAgainstBaseURL: false)
        let values = Dictionary(uniqueKeysWithValues: (components?.queryItems ?? []).map { ($0.name, $0.value) })
        XCTAssertEqual(values["origin"]!, "35.4,-97.4")
        XCTAssertEqual(values["waypoints"]!, "35.5,-97.5|35.6,-97.6")
        XCTAssertEqual(values["destination"]!, "35.7,-97.7")
    }

    func testAppleRouteUsesRepeatedWaypoints() {
        let url = NavigationRouteBuilder.multiStopURL(app: .appleMaps, stops: stops, anchor: nil)
        let items = URLComponents(url: try! XCTUnwrap(url), resolvingAgainstBaseURL: false)?.queryItems ?? []
        XCTAssertEqual(items.filter { $0.name == "waypoint" }.count, 2)
        XCTAssertEqual(items.first { $0.name == "destination" }?.value, "35.7,-97.7")
    }

    func testWazeDoesNotOfferMultiStopURL() {
        XCTAssertNil(NavigationRouteBuilder.multiStopURL(app: .waze, stops: stops, anchor: nil))
    }
}
