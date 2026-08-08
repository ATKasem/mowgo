import Foundation

struct WeatherForecast: Sendable {
    let todayPrecipitationProbability: Int?
    let tomorrowPrecipitationProbability: Int?
    let todayTemperatureMax: Double?
    let tomorrowTemperatureMax: Double?
    let currentTempF: Double?
    let windMph: Double?
    let soilTempF: Double?
    let rain7dInches: Double?

    enum SprayStatus: Sendable {
        case good
        case hold
    }

    /// Label-guidance heuristic for spray conditions — always follow the product label.
    static let sprayRule = (maxTempF: 85.0, maxWindMph: 10.0)

    /// GOOD/HOLD spray-window heuristic from current temp + wind; nil when either input is missing.
    func sprayStatus() -> SprayStatus? {
        guard let currentTempF, let windMph else { return nil }
        return currentTempF <= Self.sprayRule.maxTempF && windMph <= Self.sprayRule.maxWindMph ? .good : .hold
    }
}

struct WeatherService: Sendable {
    /// Days of history requested alongside the forecast; today's index in the
    /// daily arrays is always `pastDays` (0..<pastDays are the prior days).
    private static let pastDays = 7

    private struct Response: Decodable {
        struct Current: Decodable {
            let temperature2m: Double?
            let windSpeed10m: Double?

            private enum CodingKeys: String, CodingKey {
                case temperature2m = "temperature_2m"
                case windSpeed10m = "wind_speed_10m"
            }
        }

        struct Daily: Decodable {
            let precipitationProbabilityMax: [Int?]?
            let temperature2mMax: [Double?]?
            let precipitationSum: [Double?]?
            let soilTemperature0cm: [Double?]?

            private enum CodingKeys: String, CodingKey {
                case precipitationProbabilityMax = "precipitation_probability_max"
                case temperature2mMax = "temperature_2m_max"
                case precipitationSum = "precipitation_sum"
                case soilTemperature0cm = "soil_temperature_0cm"
            }
        }

        let current: Current?
        let daily: Daily?
    }

    func forecast(latitude: Double?, longitude: Double?) async -> WeatherForecast? {
        guard let latitude, let longitude else { return nil }
        var components = URLComponents(string: "https://api.open-meteo.com/v1/forecast")
        components?.queryItems = [
            URLQueryItem(name: "latitude", value: String(latitude)),
            URLQueryItem(name: "longitude", value: String(longitude)),
            URLQueryItem(name: "current", value: "temperature_2m,wind_speed_10m"),
            URLQueryItem(name: "daily", value: "precipitation_probability_max,temperature_2m_max,precipitation_sum,soil_temperature_0cm"),
            URLQueryItem(name: "past_days", value: String(Self.pastDays)),
            URLQueryItem(name: "forecast_days", value: "2"),
            URLQueryItem(name: "timezone", value: "auto"),
            URLQueryItem(name: "temperature_unit", value: "fahrenheit"),
            URLQueryItem(name: "wind_speed_unit", value: "mph"),
            URLQueryItem(name: "precipitation_unit", value: "inch")
        ]
        guard let url = components?.url else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return nil }
            let decoded = try JSONDecoder().decode(Response.self, from: data)
            guard let daily = decoded.daily else { return nil }

            let todayIndex = Self.pastDays
            let tomorrowIndex = Self.pastDays + 1

            // 7-day trailing rain total (past days + today), matching the web client.
            let rain7dInches: Double? = {
                guard let sums = daily.precipitationSum else { return nil }
                let trailing = sums.prefix(Self.pastDays + 1).compactMap { $0 }
                guard !trailing.isEmpty else { return nil }
                return trailing.reduce(0, +)
            }()

            return WeatherForecast(
                todayPrecipitationProbability: daily.precipitationProbabilityMax?[safe: todayIndex].flatMap { $0 },
                tomorrowPrecipitationProbability: daily.precipitationProbabilityMax?[safe: tomorrowIndex].flatMap { $0 },
                todayTemperatureMax: daily.temperature2mMax?[safe: todayIndex].flatMap { $0 },
                tomorrowTemperatureMax: daily.temperature2mMax?[safe: tomorrowIndex].flatMap { $0 },
                currentTempF: decoded.current?.temperature2m,
                windMph: decoded.current?.windSpeed10m,
                soilTempF: daily.soilTemperature0cm?[safe: todayIndex].flatMap { $0 },
                rain7dInches: rain7dInches
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
