//
//  SupabaseService.swift
//  MowFlow
//
//  REST API wrapper for Supabase PostgREST.
//  The anon key IS public — it's the same key shipped in every web client.
//  Never put the service_role key in client code.
//
//  Config is read from Info.plist (set via build settings / xcconfig).
//

import Foundation

final class SupabaseService {
    static let shared = SupabaseService()

    private let baseURL: String
    private let anonKey: String

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    // MARK: - Auth

    private(set) var token: String?
    private var refreshToken: String?
    private var tokenExpiry: Date?

    var isAuthenticated: Bool {
        guard let token, let expiry = tokenExpiry else { return false }
        return !token.isEmpty && Date() < expiry
    }

    // MARK: - Init (reads from Info.plist)

    private init() {
        let info = Bundle.main.infoDictionary
        self.baseURL = (info?["SupabaseURL"] as? String) ?? ""
        self.anonKey = (info?["SupabaseAnonKey"] as? String) ?? ""
    }

    // MARK: - Config check (for preview/testing)

    /// Returns true if config is valid and not using placeholder values.
    var isConfigured: Bool {
        return !baseURL.contains("YOUR_") && !anonKey.contains("YOUR_") &&
               !baseURL.isEmpty && !anonKey.isEmpty
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws -> String {
        let body: [String: Any] = ["email": email, "password": password]
        let data = try await request("POST", "/auth/v1/token?grant_type=password", body: body)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let accessToken = json?["access_token"] as? String else {
            throw AuthError.invalidCredentials
        }
        token = accessToken
        refreshToken = json?["refresh_token"] as? String
        // Parse expires_in (seconds from now)
        if let expiresIn = json?["expires_in"] as? Double {
            tokenExpiry = Date().addingTimeInterval(expiresIn - 300) // 5 min buffer
        }
        saveSession()
        return accessToken
    }

    func signUp(email: String, password: String) async throws {
        let body: [String: Any] = ["email": email, "password": password]
        _ = try await request("POST", "/auth/v1/signup", body: body)
    }

    func signOut() {
        token = nil
        refreshToken = nil
        tokenExpiry = nil
        clearSession()
    }

    func getCurrentUserId() async throws -> UUID? {
        // Try refresh if token is expired
        if !isAuthenticated, let _ = refreshToken {
            try? await refreshAccessToken()
        }
        guard token != nil else { return nil }
        let data = try await request("GET", "/auth/v1/user")
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let idStr = json?["id"] as? String, let id = UUID(uuidString: idStr) else {
            return nil
        }
        return id
    }

    // MARK: - Token persistence

    private func saveSession() {
        let defaults = UserDefaults.standard
        defaults.set(token, forKey: "sb_token")
        defaults.set(refreshToken, forKey: "sb_refresh_token")
        defaults.set(tokenExpiry, forKey: "sb_token_expiry")
    }

    func restoreSession() -> Bool {
        let defaults = UserDefaults.standard
        guard let t = defaults.string(forKey: "sb_token"), !t.isEmpty else { return false }
        token = t
        refreshToken = defaults.string(forKey: "sb_refresh_token")
        tokenExpiry = defaults.object(forKey: "sb_token_expiry") as? Date
        return isAuthenticated
    }

    private func clearSession() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: "sb_token")
        defaults.removeObject(forKey: "sb_refresh_token")
        defaults.removeObject(forKey: "sb_token_expiry")
    }

    private func refreshAccessToken() async throws {
        guard let rt = refreshToken else { return }
        let body: [String: Any] = ["refresh_token": rt]
        let data = try await request("POST", "/auth/v1/token?grant_type=refresh_token", body: body)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        if let accessToken = json?["access_token"] as? String {
            token = accessToken
            refreshToken = json?["refresh_token"] as? String
            if let expiresIn = json?["expires_in"] as? Double {
                tokenExpiry = Date().addingTimeInterval(expiresIn - 300)
            }
            saveSession()
        }
    }

    // MARK: - CRUD (filtered by user_id)

    func fetch<T: Decodable>(_ table: String, query: [String: String] = [:]) async throws -> [T] {
        var q = query
        if let uid = try? await getCurrentUserId(), table != "profiles" {
            q["user_id"] = "eq.\(uid.uuidString)"
        }
        var path = "/rest/v1/\(table)?select=*"
        for (k, v) in q { path += "&\(k)=\(v.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? v)" }
        let data = try await request("GET", path)
        return try decoder.decode([T].self, from: data)
    }

    func fetchJobs() async throws -> [Job] {
        guard let uid = try? await getCurrentUserId() else { return [] }
        let path = "/rest/v1/jobs?select=*,clients!left(*)&user_id=eq.\(uid.uuidString)&order=scheduled_date.asc"
        let data = try await request("GET", path)
        return try decoder.decode([Job].self, from: data)
    }

    func fetchInvoices() async throws -> [Invoice] {
        guard let uid = try? await getCurrentUserId() else { return [] }
        let path = "/rest/v1/invoices?select=*,clients!left(name)&user_id=eq.\(uid.uuidString)&order=created_at.desc"
        let data = try await request("GET", path)
        return try decoder.decode([Invoice].self, from: data)
    }

    func fetchProfile() async throws -> UserProfile? {
        guard let uid = try? await getCurrentUserId() else { return nil }
        let path = "/rest/v1/profiles?select=*&id=eq.\(uid.uuidString)"
        let data = try await request("GET", path)
        let profiles = try decoder.decode([UserProfile].self, from: data)
        return profiles.first
    }

    func insert<T: Encodable>(_ table: String, _ item: T) async throws -> T where T: Decodable {
        let data = try await request("POST", "/rest/v1/\(table)",
            body: try JSONSerialization.jsonObject(with: encoder.encode(item)),
            prefer: "return=representation")
        let items = try decoder.decode([T].self, from: data)
        guard let first = items.first else { throw SupabaseError.noRows }
        return first
    }

    func update<T: Encodable>(_ table: String, id: UUID, _ item: T) async throws {
        _ = try await request("PATCH", "/rest/v1/\(table)?id=eq.\(id.uuidString)",
            body: try JSONSerialization.jsonObject(with: encoder.encode(item)))
    }

    func delete(_ table: String, id: UUID) async throws {
        _ = try await request("DELETE", "/rest/v1/\(table)?id=eq.\(id.uuidString)")
    }

    // MARK: - Edge Functions

    func requestFunction(_ name: String, body: [String: Any]) async throws -> Data {
        let path = "/functions/v1/\(name)"
        return try await request("POST", path, body: body)
    }

    // MARK: - HTTP

    private func request(
        _ method: String,
        _ path: String,
        body: Any? = nil,
        prefer: String? = nil,
        isRetry: Bool = false
    ) async throws -> Data {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw SupabaseError.network
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.timeoutInterval = 30

        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let p = prefer { req.setValue(p, forHTTPHeaderField: "Prefer") }

        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError.network
        }
        guard (200...299).contains(http.statusCode) else {
            // Auto-refresh on 401, but only retry once
            if http.statusCode == 401, !isRetry, refreshToken != nil {
                try? await refreshAccessToken()
                return try await request(method, path, body: body, prefer: prefer, isRetry: true)
            }
            throw SupabaseError.httpStatus(http.statusCode)
        }
        return data
    }
}

// MARK: - Errors

enum AuthError: LocalizedError {
    case invalidCredentials
    case signUpFailed
    case sessionExpired
    var errorDescription: String? {
        switch self {
        case .invalidCredentials: "Invalid email or password."
        case .signUpFailed: "Could not create account. Please try again."
        case .sessionExpired: "Session expired. Please sign in again."
        }
    }
}

enum SupabaseError: LocalizedError {
    case network, noRows, httpStatus(Int), decodingFailed
    var errorDescription: String? {
        switch self {
        case .network: "Network error. Check your connection."
        case .noRows: "No data returned."
        case .httpStatus(let code): "Server error (\(code))."
        case .decodingFailed: "Could not parse server response."
        }
    }
}
