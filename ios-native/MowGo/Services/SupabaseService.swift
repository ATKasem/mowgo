//
//  SupabaseService.swift
//  MowGo
//
//  REST API wrapper for Supabase PostgREST.
//  The anon key IS public — it's the same key shipped in every web client.
//  Never put the service_role key in client code.
//
//  Config is read from Info.plist (set via build settings / xcconfig).
//

import Foundation
import Security

actor SupabaseService {
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

    func ensureAuthenticated() async -> Bool {
        if isAuthenticated { return true }
        guard refreshToken?.isEmpty == false else { return false }
        do {
            try await refreshAccessToken()
            return isAuthenticated
        } catch {
            if isPermanentRefreshFailure(error) {
                await signOut()
            }
            return false
        }
    }

    // MARK: - Init (reads from Info.plist with bundled fallbacks)
    //  Xcode with GENERATE_INFOPLIST_FILE strips the INFOPLIST_KEY_ prefix,
    //  so INFOPLIST_KEY_SUPABASE_URL → Info.plist key "SUPABASE_URL".
    //  We check both formats for backward compatibility.
    private init() {
        let info = Bundle.main.infoDictionary
        let configuredBaseURL = (info?["SUPABASE_URL"] as? String)
                             ?? (info?["SupabaseURL"] as? String)
                             ?? ""
        let configuredAnonKey = (info?["SUPABASE_ANON_KEY"] as? String)
                             ?? (info?["SupabaseAnonKey"] as? String)
                             ?? ""

        self.baseURL = configuredBaseURL
        self.anonKey = configuredAnonKey
    }

    // MARK: - Config check (for preview/testing)

    /// Returns true if config is valid and not using placeholder values.
    var isConfigured: Bool {
        return !baseURL.contains("YOUR_") && !anonKey.contains("YOUR_") &&
               !baseURL.isEmpty && !anonKey.isEmpty
    }

    /// Auto-recovering connectivity flag. Reads return true if the last
    /// request succeeded or if 30+ seconds have passed since the last
    /// failure (allowing retry). Always access with `await` from outside
    /// the actor; internal request() method calls markOnline/markOffline directly.
    private var _isOnline = true
    private var _lastNetworkFailure: Date?
    var isOnline: Bool {
        if !_isOnline, let lastFail = _lastNetworkFailure {
            if Date().timeIntervalSince(lastFail) > 30 {
                _isOnline = true
                _lastNetworkFailure = nil
            }
        }
        return _isOnline
    }

    func markOffline() {
        _isOnline = false
        _lastNetworkFailure = Date()
    }

    func markOnline() {
        _isOnline = true
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws -> String {
        let body: [String: Any] = ["email": email, "password": password]
        let data = try await request(
            "POST",
            "/auth/v1/token?grant_type=password",
            body: body,
            allowsTokenRefresh: false
        )
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
        guard saveSession() else {
            await signOut()
            throw AuthError.sessionPersistenceFailed
        }
        return accessToken
    }

    func signUp(email: String, password: String) async throws {
        let body: [String: Any] = ["email": email, "password": password]
        _ = try await request(
            "POST",
            "/auth/v1/signup",
            body: body,
            allowsTokenRefresh: false
        )
    }

    func signOut() async {
        refreshTask?.cancel()
        refreshTask = nil
        _cachedUserId = nil
        token = nil
        refreshToken = nil
        tokenExpiry = nil
        clearSession()
    }

    func resetPassword(email: String) async throws {
        let body: [String: Any] = ["email": email]
        _ = try await request("POST", "/auth/v1/recover", body: body, allowsTokenRefresh: false)
    }

    // Cache the user ID to avoid repeated network calls on every fetch.
    // getCurrentUserId() was called 3x per loadAll() (jobs, clients, invoices).
    private var _cachedUserId: UUID?

    func getCurrentUserId() async throws -> UUID? {
        if let cached = _cachedUserId { return cached }
        // Try refresh if token is expired
        if !isAuthenticated, let _ = refreshToken {
            try await refreshAccessToken()
        }
        guard token != nil else { return nil }
        let data = try await request("GET", "/auth/v1/user")
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let idStr = json?["id"] as? String, let id = UUID(uuidString: idStr) else {
            return nil
        }
        _cachedUserId = id
        return id
    }

    // MARK: - Token persistence

    // MARK: - Keychain Helpers

    @discardableResult
    private func saveToKeychain(key: String, value: String) -> Bool {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.mowgo.auth",
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary) // Remove any existing item
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.mowgo.auth",
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        return SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess
    }

    private func loadFromKeychain(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.mowgo.auth",
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func deleteFromKeychain(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.mowgo.auth",
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Session persistence (Keychain-backed)

    private func saveSession() -> Bool {
        guard let token, saveToKeychain(key: "sb_token", value: token) else { return false }
        if let refreshToken, !saveToKeychain(key: "sb_refresh_token", value: refreshToken) { return false }
        if let exp = tokenExpiry {
            let ts = String(exp.timeIntervalSince1970)
            if !saveToKeychain(key: "sb_token_expiry", value: ts) { return false }
        }
        return true
    }

    func restoreSession() async -> Bool {
        // Try Keychain first, then migrate each missing session field from UserDefaults.
        var t = loadFromKeychain(key: "sb_token")
        if t?.isEmpty != false {
            t = UserDefaults.standard.string(forKey: "sb_token")
        }
        guard let t, !t.isEmpty else {
            await signOut()
            return false
        }

        // Migrate each field independently. A crash between fields must not cause
        // a later launch to delete plaintext values whose Keychain copy is missing.
        if loadFromKeychain(key: "sb_token")?.isEmpty != false {
            if saveToKeychain(key: "sb_token", value: t) {
                UserDefaults.standard.removeObject(forKey: "sb_token")
            }
        } else {
            // A previous launch may have completed the Keychain write but crashed
            // before deleting the plaintext legacy value.
            UserDefaults.standard.removeObject(forKey: "sb_token")
        }
        if loadFromKeychain(key: "sb_refresh_token")?.isEmpty != false {
            if let refresh = UserDefaults.standard.string(forKey: "sb_refresh_token"),
               saveToKeychain(key: "sb_refresh_token", value: refresh) {
                UserDefaults.standard.removeObject(forKey: "sb_refresh_token")
            }
        } else {
            UserDefaults.standard.removeObject(forKey: "sb_refresh_token")
        }
        if loadFromKeychain(key: "sb_token_expiry")?.isEmpty != false {
            if let expiry = UserDefaults.standard.string(forKey: "sb_token_expiry"),
               saveToKeychain(key: "sb_token_expiry", value: expiry) {
                UserDefaults.standard.removeObject(forKey: "sb_token_expiry")
            }
        } else {
            UserDefaults.standard.removeObject(forKey: "sb_token_expiry")
        }

        token = t
        refreshToken = loadFromKeychain(key: "sb_refresh_token")
        if let ts = loadFromKeychain(key: "sb_token_expiry"),
           let interval = TimeInterval(ts) {
            tokenExpiry = Date(timeIntervalSince1970: interval)
        }
        if isAuthenticated { return true }

        guard refreshToken?.isEmpty == false else {
            await signOut()
            return false
        }
        do {
            try await refreshAccessToken()
            return isAuthenticated
        } catch {
            if isPermanentRefreshFailure(error) {
                await signOut()
            }
            return false
        }
    }

    private func clearSession() {
        deleteFromKeychain(key: "sb_token")
        deleteFromKeychain(key: "sb_refresh_token")
        deleteFromKeychain(key: "sb_token_expiry")
    }

    // If a refresh is already in flight, new callers await the existing
    // task instead of silently getting no token update.
    private var refreshTask: Task<Void, Error>?

    private func refreshAccessToken() async throws {
        guard let rt = refreshToken else { return }
        // If a refresh is already in flight, wait for it to complete
        if let existing = refreshTask {
            do {
                try await existing.value
            } catch {
                if isPermanentRefreshFailure(error) {
                    await signOut()
                }
                throw error
            }
            // After the in-flight refresh, check if we now have a valid token
            guard !isAuthenticated else { return }
        }
        refreshTask = Task<Void, Error> {
            defer { refreshTask = nil }
            let body: [String: Any] = ["refresh_token": rt]
            let data = try await request(
                "POST",
                "/auth/v1/token?grant_type=refresh_token",
                body: body,
                allowsTokenRefresh: false
            )
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            if let accessToken = json?["access_token"] as? String {
                try Task.checkCancellation()
                token = accessToken
                refreshToken = json?["refresh_token"] as? String
                if let expiresIn = json?["expires_in"] as? Double {
                    tokenExpiry = Date().addingTimeInterval(expiresIn - 300)
                }
                guard saveSession() else {
                    throw AuthError.sessionPersistenceFailed
                }
            } else {
                await signOut()
                throw AuthError.sessionExpired
            }
        }
        do {
            try await refreshTask?.value
        } catch {
            if isPermanentRefreshFailure(error) {
                await signOut()
            }
            throw error
        }
    }

    private func isPermanentRefreshFailure(_ error: Error) -> Bool {
        if let supabaseError = error as? SupabaseError,
           case .httpStatus(let statusCode, _) = supabaseError {
            return statusCode == 401 || statusCode == 403
        }
        return error is AuthError
    }

    // MARK: - Photo Upload

    /// Uploads a job photo. Returns the storage PATH (signed URLs expire —
    /// callers resolve a fresh signed URL via `signedPhotoURL(for:)` at render).
    func uploadJobPhoto(jobId: UUID, imageData: Data) async throws -> String {
        guard let uid = try await getCurrentUserId() else {
            throw SupabaseError.network
        }
        let path = "\(uid.uuidString)/\(jobId.uuidString)/\(UUID().uuidString).jpg"

        guard let url = URL(string: "\(baseURL)/storage/v1/object/job-photo/\(path)") else {
            throw SupabaseError.network
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        req.setValue("true", forHTTPHeaderField: "x-upsert")
        req.httpBody = imageData

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode) else {
            let detail = Self.extractErrorMessage(from: data)
            throw SupabaseError.httpStatus(
                (response as? HTTPURLResponse)?.statusCode ?? 0,
                detail: detail
            )
        }

        return path
    }

    /// Resolve a stored photo path to a fresh 1-hour signed URL.
    /// Absolute URLs pass through ONLY if the host matches this project's
    /// Supabase storage domain (legacy rows); anything else → nil.
    func signedPhotoURL(for pathOrURL: String?) async -> String? {
        guard let pathOrURL, !pathOrURL.isEmpty else { return nil }
        if pathOrURL.hasPrefix("demo://") { return pathOrURL }
        if pathOrURL.hasPrefix("http") {
            // Host allowlist: only the project's own Supabase host is trusted
            // (crew can write photo_url via row-level RLS; an arbitrary host
            // would make owner/crew devices GET attacker URLs — IP leak).
            guard let url = URL(string: pathOrURL),
                  let base = URL(string: baseURL),
                  url.host == base.host else {
                return nil
            }
            return pathOrURL
        }
        // Path-traversal defense-in-depth: only accept plain storage paths
        // (bucket keys are UUID-segmented). Reject any traversal/absolute
        // attempts — Supabase storage RLS already gates reads, this is a
        // belt-and-braces guard before the URL is built.
        if pathOrURL.hasPrefix("/") || pathOrURL.contains("..") || pathOrURL.contains("\\") {
            return nil
        }
        guard let signURL = URL(string: "\(baseURL)/storage/v1/object/sign/job-photo/\(pathOrURL)"),
              let token else {
            return nil
        }
        var signRequest = URLRequest(url: signURL)
        signRequest.httpMethod = "POST"
        signRequest.setValue(anonKey, forHTTPHeaderField: "apikey")
        signRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        signRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        signRequest.httpBody = try? JSONEncoder().encode(["expiresIn": 3600])
        guard let (signedData, signedResponse) = try? await URLSession.shared.data(for: signRequest),
              let signedHTTP = signedResponse as? HTTPURLResponse,
              (200...299).contains(signedHTTP.statusCode) else {
            return nil
        }
        struct SignedURLResponse: Decodable { let signedURL: String }
        guard let signedPath = try? JSONDecoder().decode(SignedURLResponse.self, from: signedData).signedURL else {
            return nil
        }
        return signedPath.hasPrefix("http") ? signedPath : "\(baseURL)/storage/v1\(signedPath)"
    }

    // MARK: - CRUD (filtered by user_id)

    func fetch<T: Decodable>(_ table: String, query: [String: String] = [:]) async throws -> [T] {
        var q = query
        guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }
        if table != "profiles" {
            q["user_id"] = "eq.\(uid.uuidString)"
        }
        var path = "/rest/v1/\(table)?select=*"
        for (k, v) in q { path += "&\(k)=\(v.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? v)" }
        let data = try await request("GET", path)
        return try decoder.decode([T].self, from: data)
    }

    func fetchJobs() async throws -> [Job] {
        guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }
        let profile = try? await fetchProfile()
        let filter = profile?.role == "crew"
            ? "assigned_to=eq.\(uid.uuidString)"
            : "user_id=eq.\(uid.uuidString)"
        let path = "/rest/v1/jobs?select=*,clients!left(*)&\(filter)&order=scheduled_date.asc"
        let data = try await request("GET", path)
        return try decoder.decode([Job].self, from: data)
    }

    func fetchInvoices() async throws -> [Invoice] {
        guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }
        let path = "/rest/v1/invoices?select=*,clients!left(name)&user_id=eq.\(uid.uuidString)&order=created_at.desc"
        let data = try await request("GET", path)
        return try decoder.decode([Invoice].self, from: data)
    }

    func fetchProfile() async throws -> UserProfile? {
        guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }
        let path = "/rest/v1/profiles?select=*&id=eq.\(uid.uuidString)"
        let data = try await request("GET", path)
        let profiles = try decoder.decode([UserProfile].self, from: data)
        return profiles.first
    }

    func fetchExportJobs() async throws -> [Job] {
        guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }
        let profile = try await fetchProfile()
        let filter = profile?.role == "crew"
            ? "assigned_to=eq.\(uid.uuidString)"
            : "user_id=eq.\(uid.uuidString)"
        let path = "/rest/v1/jobs?select=*,clients!left(*)&\(filter)&order=scheduled_date.asc"
        let data = try await request("GET", path)
        return try decoder.decode([Job].self, from: data)
    }

    /// On-demand fetch of one client's gate/alarm codes. Kept out of the
    /// general clients list and its offline cache — codes are only pulled
    /// when the client detail view actually needs them.
    func fetchClientCode(clientId: UUID) async throws -> (keyCode: String?, alarmCode: String?) {
        guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }
        let profile = try await fetchProfile()
        let ownerId = profile?.role == "crew" ? profile?.businessId : uid
        guard let ownerId else { return (nil, nil) }
        struct Row: Decodable { let keyCode: String?; let alarmCode: String? }
        let path = "/rest/v1/clients?select=key_code,alarm_code&id=eq.\(clientId.uuidString)&user_id=eq.\(ownerId.uuidString)"
        let data = try await request("GET", path)
        let rows = try decoder.decode([Row].self, from: data)
        guard let row = rows.first else { return (nil, nil) }
        return (row.keyCode, row.alarmCode)
    }

    func fetchExportClients() async throws -> [Client] {
        guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }
        let profile = try await fetchProfile()
        let ownerId = profile?.role == "crew" ? profile?.businessId : uid
        guard let ownerId else { return [] }
        let path = "/rest/v1/clients?select=*&user_id=eq.\(ownerId.uuidString)&order=name.asc"
        let data = try await request("GET", path)
        return try decoder.decode([Client].self, from: data)
    }

    func fetchExportInvoices() async throws -> [Invoice] {
        guard let uid = try await getCurrentUserId() else { throw SupabaseError.network }
        let profile = try await fetchProfile()
        if profile?.role == "crew" { return [] }
        let path = "/rest/v1/invoices?select=*,clients!left(name)&user_id=eq.\(uid.uuidString)&order=created_at.desc"
        let data = try await request("GET", path)
        return try decoder.decode([Invoice].self, from: data)
    }

    func insert<Payload: Encodable, Result: Decodable>(
        _ table: String,
        _ item: Payload
    ) async throws -> Result {
        let data = try await request("POST", "/rest/v1/\(table)",
            body: try JSONSerialization.jsonObject(with: encoder.encode(item)),
            prefer: "return=representation")
        let items = try decoder.decode([Result].self, from: data)
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

    // MARK: - Push Notifications

    /// Update the device token on the user's profile row.
    func updateDeviceToken(userId: UUID, token: String?) async throws {
        struct DeviceTokenPatch: Encodable {
            let deviceToken: String?
        }
        try await update("profiles", id: userId, DeviceTokenPatch(deviceToken: token))
    }

    // MARK: - Edge Functions

    func requestFunction(_ name: String, body: [String: Any]) async throws -> Data {
        let path = "/functions/v1/\(name)"
        return try await request("POST", path, body: body)
    }

    /// Call a PostgREST RPC function. Scalar JSON returns (e.g. a UUID string)
    /// decode directly; a JSON `null` return yields nil.
    func rpc<Params: Encodable, Result: Decodable>(
        _ function: String,
        params: Params,
        _ resultType: Result.Type
    ) async throws -> Result? {
        let path = "/rest/v1/rpc/\(function)"
        let data = try await request("POST", path, body: try JSONSerialization.jsonObject(with: encoder.encode(params)))
        guard !data.isEmpty, data != Data("null".utf8) else { return nil }
        return try decoder.decode(Result.self, from: data)
    }

    // MARK: - HTTP

    private func request(
        _ method: String,
        _ path: String,
        body: Any? = nil,
        prefer: String? = nil,
        allowsTokenRefresh: Bool = true
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

        let data: Data
        let http: HTTPURLResponse
        do {
            let (d, r) = try await URLSession.shared.data(for: req)
            data = d
            guard let h = r as? HTTPURLResponse else {
                markOffline()
                throw SupabaseError.network
            }
            http = h
        } catch let error as SupabaseError {
            throw error
        } catch let error as CancellationError {
            throw error
        } catch {
            markOffline()
            throw SupabaseError.network
        }
        markOnline()  // server reached — reset offline state regardless of status code
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401, allowsTokenRefresh, refreshToken != nil {
                try await refreshAccessToken()
                return try await request(
                    method,
                    path,
                    body: body,
                    prefer: prefer,
                    allowsTokenRefresh: false
                )
            }
            let detail = Self.extractErrorMessage(from: data)
            throw SupabaseError.httpStatus(http.statusCode, detail: detail)
        }
        return data
    }

    /// Extracts a human-readable error from a Supabase/edge-function JSON response body.
    /// Checks "error", then "message" (both formats are used across the codebase).
    private nonisolated static func extractErrorMessage(from data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let error = json["error"] as? String { return error }
        if let message = json["message"] as? String { return message }
        return nil
    }
}

// MARK: - Errors

enum AuthError: LocalizedError {
    case invalidCredentials
    case signUpFailed
    case sessionExpired
    case sessionPersistenceFailed
    var errorDescription: String? {
        switch self {
        case .invalidCredentials: "Invalid email or password."
        case .signUpFailed: "Could not create account. Please try again."
        case .sessionExpired: "Session expired. Please sign in again."
        case .sessionPersistenceFailed: "Could not securely save your session. Please try again."
        }
    }
}

enum SupabaseError: LocalizedError {
    case network, noRows, httpStatus(Int, detail: String?), decodingFailed
    var errorDescription: String? {
        switch self {
        case .network: "Network error. Check your connection."
        case .noRows: "No data returned."
        case .httpStatus(let code, let detail):
            if let detail { "Server error (\(code)): \(detail)" }
            else { "Server error (\(code))." }
        case .decodingFailed: "Could not parse server response."
        }
    }
}
