import Foundation

struct WeatherForecast: Sendable {
    let todayPrecipitationProbability: Int?
    let tomorrowPrecipitationProbability: Int?
    let todayTemperatureMax: Double?
    let tomorrowTemperatureMax: Double?
}

struct WeatherService: Sendable {
    private struct Response: Decodable {
        struct Daily: Decodable {
            let precipitationProbabilityMax: [Int?]
            let temperature2mMax: [Double?]

            private enum CodingKeys: String, CodingKey {
                case precipitationProbabilityMax = "precipitation_probability_max"
                case temperature2mMax = "temperature_2m_max"
            }
        }
        let daily: Daily
    }

    func forecast(latitude: Double?, longitude: Double?) async -> WeatherForecast? {
        guard let latitude, let longitude else { return nil }
        var components = URLComponents(string: "https://api.open-meteo.com/v1/forecast")
        components?.queryItems = [
            URLQueryItem(name: "latitude", value: String(latitude)),
            URLQueryItem(name: "longitude", value: String(longitude)),
            URLQueryItem(name: "daily", value: "precipitation_probability_max,temperature_2m_max"),
            URLQueryItem(name: "timezone", value: "auto")
        ]
        guard let url = components?.url else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return nil }
            let decoded = try JSONDecoder().decode(Response.self, from: data)
            return WeatherForecast(
                todayPrecipitationProbability: decoded.daily.precipitationProbabilityMax[safe: 0].flatMap { $0 },
                tomorrowPrecipitationProbability: decoded.daily.precipitationProbabilityMax[safe: 1].flatMap { $0 },
                todayTemperatureMax: decoded.daily.temperature2mMax[safe: 0].flatMap { $0 },
                tomorrowTemperatureMax: decoded.daily.temperature2mMax[safe: 1].flatMap { $0 }
            )
        } catch {
            return nil
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
