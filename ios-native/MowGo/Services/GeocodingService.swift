import CoreLocation

/// Street-address geocoding for route optimization.
///
/// Uses Apple's on-device geocoder (free, no API key). Open-Meteo — used for
/// the business-location weather lookup — only matches place names, so it
/// returned nothing for street addresses like "123 Oak St, Austin, TX" and
/// Optimize could never place real clients on the map.
struct GeocodingService {
    func geocodeAddress(_ address: String) async -> (lat: Double, lng: Double)? {
        let trimmed = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        do {
            // A fresh geocoder per request: CLGeocoder handles one request at a time.
            let placemarks = try await CLGeocoder().geocodeAddressString(trimmed)
            guard let coordinate = placemarks.first?.location?.coordinate,
                  CLLocationCoordinate2DIsValid(coordinate) else { return nil }
            return (coordinate.latitude, coordinate.longitude)
        } catch {
            return nil
        }
    }
}
