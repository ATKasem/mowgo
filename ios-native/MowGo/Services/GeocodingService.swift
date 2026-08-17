import Foundation

struct GeocodingService {
    private struct Response: Decodable {
        struct Result: Decodable {
            let latitude: Double
            let longitude: Double
        }
        let results: [Result]?
    }

    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func geocodeAddress(_ address: String) async -> (lat: Double, lng: Double)? {
        let trimmed = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        var components = URLComponents(string: "https://geocoding-api.open-meteo.com/v1/search")
        components?.queryItems = [
            URLQueryItem(name: "name", value: trimmed),
            URLQueryItem(name: "count", value: "1"),
            URLQueryItem(name: "language", value: "en"),
            URLQueryItem(name: "format", value: "json")
        ]
        guard let url = components?.url else { return nil }

        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let result = try JSONDecoder().decode(Response.self, from: data).results?.first else {
                return nil
            }
            return (result.latitude, result.longitude)
        } catch {
            return nil
        }
    }
}
