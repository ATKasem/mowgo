//
//  Models.swift
//  MowGo
//
//  Matches Supabase schema (001_initial_schema.sql).
//  All field names use snake_case to decode directly from PostgREST.
//

import Foundation
import SwiftData

// MARK: - Recurring Job Template

/// A recurring job template stores the pattern for auto-generating Job instances.
/// Stored in the `recurring_jobs` Supabase table.
struct RecurringJob: Codable, Identifiable, Equatable {
    let id: UUID
    var userId: UUID?
    var clientId: UUID
    var title: String
    var scheduledTime: String?       // "09:00"
    var durationMinutes: Int?
    var assignedTo: UUID?
    var notes: String?
    var frequency: Frequency
    /// Weekday indices: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    var daysOfWeek: [Int]
    var isActive: Bool
    /// ISO date when the pattern started (UTC): "2026-07-01"
    var startDate: String
    var createdAt: String?

    enum Frequency: String, Codable, CaseIterable {
        case weekly, biweekly, monthly

        var label: String {
            switch self {
            case .weekly:   "Every week"
            case .biweekly: "Every 2 weeks"
            case .monthly:  "Monthly"
            }
        }
    }

    // MARK: - Pattern Matching

    private static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(secondsFromGMT: 0); return f
    }()

    /// Returns true if `targetDate` should receive a job from this template.
    func matchesDate(_ targetDate: Date) -> Bool {
        guard let utcStart = Self.dateFmt.date(from: startDate) else { return false }
        let cal = Calendar.current
        // Normalize the UTC-parsed start date into the local calendar so weekday
        // and interval math agree with targetDate's calendar.
        let startComponents = cal.dateComponents([.year, .month, .day], from: utcStart)
        guard let startDate = cal.date(from: startComponents) else { return false }
        guard targetDate >= startDate else { return false }

        let calendarWeekday = cal.component(.weekday, from: targetDate) // 1=Sun, 2=Mon…7=Sat
        let dayOfWeek = calendarWeekday - 1 // → 0=Sun(excl), 1=Mon, …, 6=Sat

        // Must match one of the selected days
        guard daysOfWeek.contains(dayOfWeek) else { return false }

        switch frequency {
        case .weekly:
            return true

        case .biweekly:
            guard let weeks = cal.dateComponents([.weekOfYear], from: startDate, to: targetDate).weekOfYear else {
                return false
            }
            return weeks % 2 == 0

        case .monthly:
            // Generate on the Nth occurrence of this weekday in the month,
            // where N is derived from the start date's occurrence in its month.
            let startCalendarWeekday = cal.component(.weekday, from: startDate)
            guard calendarWeekday == startCalendarWeekday else { return false }
            let todayNth = Self.nthWeekday(calendarWeekday, upTo: targetDate, cal: cal)
            let startNth = Self.nthWeekday(startCalendarWeekday, upTo: startDate, cal: cal)
            return todayNth == startNth
        }
    }

    /// Count which occurrence of `weekday` (1=Sun…7=Sat) `date` is in its month (1-based).
    private static func nthWeekday(_ weekday: Int, upTo date: Date, cal: Calendar) -> Int {
        guard let monthStart = cal.date(from: cal.dateComponents([.year, .month], from: date)) else {
            return 0
        }
        var count = 0
        var d = monthStart
        while d <= date {
            if cal.component(.weekday, from: d) == weekday {
                count += 1
            }
            d = cal.date(byAdding: .day, value: 1, to: d) ?? d
        }
        return count
    }
}

// MARK: - Job

struct Job: Codable, Identifiable, Equatable {
    let id: UUID
    var userId: UUID?
    var clientId: UUID?
    var assignedTo: UUID?
    var title: String
    // MARK: UTC contract
    // All date strings MUST be ISO-8601 date-only in UTC (e.g. "2026-07-25").
    // Comparisons are lexicographic and assume UTC. Never store local-date
    // strings — the server (Postgres `date` type) always returns UTC.
    var scheduledDate: String        // "2026-07-25"
    var scheduledTime: String?       // "09:00"
    var durationMinutes: Int?
    var status: JobStatus
    var notes: String?
    var photoUrl: String?
    var routeOrder: Int?
    var isRecurring: Bool?
    var recurrenceRule: String?
    var createdAt: String?
    // Joined from clients table (not stored on jobs)
    var clients: ClientRef?

    enum JobStatus: String, Codable, CaseIterable {
        case scheduled, inProgress = "in_progress", done, skipped
        var label: String {
            switch self {
            case .scheduled: "Scheduled"
            case .inProgress: "In Progress"
            case .done: "Done"
            case .skipped: "Skipped"
            }
        }
    }

    struct ClientRef: Codable, Equatable {
        let id: UUID
        var name: String?
        var address: String?
        var phone: String?
        var email: String?
        var rate: Decimal?
        var cleaningNotes: String?
        var keyCode: String?
        var alarmCode: String?
        var petInstructions: String?
    }

    // Computed helpers (mirrors web app's data.js mapping)
    var clientName: String? { clients?.name }
    var address: String? { clients?.address }
    var clientRate: Decimal? { clients?.rate }
    var recurrence: String { recurrenceRule ?? "none" }
}

// MARK: - Client

struct Client: Codable, Identifiable, Equatable {
    let id: UUID
    var userId: UUID?
    var name: String
    var address: String?
    var phone: String?
    var email: String?
    var rate: Decimal
    var cleaningNotes: String?
    var keyCode: String?
    var alarmCode: String?
    var petInstructions: String?
    var tags: [String]?
    var createdAt: String?
}

// MARK: - Invoice

struct Invoice: Codable, Identifiable, Equatable {
    let id: UUID
    var userId: UUID?
    var clientId: UUID?
    var jobId: UUID?
    var amount: Decimal
    /// Integer-cents representation used by Stripe.
    var amountCents: Int {
        var cents = amount * 100
        var rounded = Decimal()
        NSDecimalRound(&rounded, &cents, 0, .plain)
        return NSDecimalNumber(decimal: rounded).intValue
    }
    var currencyAmount: Decimal { amount }
    var status: InvoiceStatus
    var stripeInvoiceId: String?
    var stripePaymentIntentId: String?
    var sentAt: String?
    var paidAt: String?
    var createdAt: String?
    // Joined from clients
    var clients: ClientRef?

    enum InvoiceStatus: String, Codable {
        case unpaid, paid
        var label: String { self == .paid ? "Paid" : "Unpaid" }
    }

    struct ClientRef: Codable, Equatable {
        let name: String?
    }

    var clientName: String? { clients?.name }
}

// MARK: - User Profile

struct UserProfile: Codable, Identifiable {
    var id: UUID?
    var businessName: String?
    var phone: String?
    var email: String?
    var tier: String?
    var role: String?
    var businessId: UUID?
    var stripeCustomerId: String?
    var createdAt: String?

    var tierLabel: String {
        switch tier {
        case "free": "Free"
        case "solo": "Solo"
        case "crew": "Crew"
        default: tier ?? "Free"
        }
    }
}

// MARK: - Team Dashboard Row

struct TeamDashboardRow: Identifiable {
    let id: UUID
    let name: String
    let role: String
    let total: Int
    let done: Int
    let inProgress: Int
}

// MARK: - SwiftData Cache Models

@Model
final class JobCache {
    @Attribute(.unique) var id: UUID
    var userId: UUID
    var clientId: UUID?
    var title: String
    var scheduledDate: String
    var scheduledTime: String?
    var durationMinutes: Int?
    var status: String          // stores rawValue (e.g. "scheduled", "in_progress")
    var notes: String?
    var photoUrl: String?
    var routeOrder: Int?
    var clientName: String?
    var clientAddress: String?
    var jsonData: Data          // full JSON backup for faithful reconstruction
    var cachedAt: Date

    init(job: Job, userId: UUID) {
        self.id = job.id
        self.userId = userId
        self.clientId = job.clientId
        self.title = job.title
        self.scheduledDate = job.scheduledDate
        self.scheduledTime = job.scheduledTime
        self.durationMinutes = job.durationMinutes
        self.status = job.status.rawValue
        self.notes = job.notes
        self.photoUrl = job.photoUrl
        self.routeOrder = job.routeOrder
        self.clientName = job.clients?.name
        self.clientAddress = job.clients?.address
        self.cachedAt = Date()

        // Store full JSON so we can reconstruct the Job exactly
        if let data = try? JSONEncoder().encode(job) {
            self.jsonData = data
        } else {
            self.jsonData = Data()
        }
    }

    /// Reconstruct the original Job from the cached JSON.
    func toJob() -> Job? {
        guard !jsonData.isEmpty else { return nil }
        return try? JSONDecoder().decode(Job.self, from: jsonData)
    }
}

@Model
final class ClientCache {
    @Attribute(.unique) var id: UUID
    var userId: UUID
    var name: String
    var address: String?
    var phone: String?
    var email: String?
    var rate: Double
    var cleaningNotes: String?
    var keyCode: String?
    var alarmCode: String?
    var petInstructions: String?
    var jsonData: Data
    var cachedAt: Date

    init(client: Client, userId: UUID) {
        self.id = client.id
        self.userId = userId
        self.name = client.name
        self.address = client.address
        self.phone = client.phone
        self.email = client.email
        self.rate = NSDecimalNumber(decimal: client.rate).doubleValue
        self.cleaningNotes = client.cleaningNotes
        self.keyCode = client.keyCode
        self.alarmCode = client.alarmCode
        self.petInstructions = client.petInstructions
        self.cachedAt = Date()

        if let data = try? JSONEncoder().encode(client) {
            self.jsonData = data
        } else {
            self.jsonData = Data()
        }
    }

    func toClient() -> Client? {
        guard !jsonData.isEmpty else { return nil }
        return try? JSONDecoder().decode(Client.self, from: jsonData)
    }
}

// MARK: - Offline Mutation Queue

/// A mutation made while offline that needs to be replayed against the server
/// when connectivity is restored. Operations are replayed in FIFO order.
@Model
final class PendingMutation {
    @Attribute(.unique) var id: UUID
    var operation: String       // "job:create", "job:status", "job:delete", etc.
    var entityId: UUID          // id of the affected entity
    var payload: Data           // JSON-encoded mutation payload
    // UserDefaults provides local FIFO ordering only; values are not globally unique
    // across devices or independent app installations.
    var sequence: Int
    var userId: UUID            // the authenticated user who created this mutation
    var createdAt: Date

    init(id: UUID = UUID(), operation: String, entityId: UUID, payload: Data, sequence: Int, userId: UUID, createdAt: Date = Date()) {
        self.id = id
        self.operation = operation
        self.entityId = entityId
        self.payload = payload
        self.sequence = sequence
        self.userId = userId
        self.createdAt = createdAt
    }
}

@Model
final class InvoiceCache {
    @Attribute(.unique) var id: UUID
    var userId: UUID
    var clientId: UUID?
    var jobId: UUID?
    var amount: Double
    var status: String          // "unpaid" or "paid"
    var stripeInvoiceId: String?
    var stripePaymentIntentId: String?
    var sentAt: String?
    var paidAt: String?
    var createdAt: String?
    var jsonData: Data
    var cachedAt: Date

    init(invoice: Invoice, userId: UUID) {
        self.id = invoice.id
        self.userId = userId
        self.clientId = invoice.clientId
        self.jobId = invoice.jobId
        self.amount = NSDecimalNumber(decimal: invoice.amount).doubleValue
        self.status = invoice.status.rawValue
        self.stripeInvoiceId = invoice.stripeInvoiceId
        self.stripePaymentIntentId = invoice.stripePaymentIntentId
        self.sentAt = invoice.sentAt
        self.paidAt = invoice.paidAt
        self.createdAt = invoice.createdAt
        self.cachedAt = Date()

        if let data = try? JSONEncoder().encode(invoice) {
            self.jsonData = data
        } else {
            self.jsonData = Data()
        }
    }

    func toInvoice() -> Invoice? {
        guard !jsonData.isEmpty else { return nil }
        return try? JSONDecoder().decode(Invoice.self, from: jsonData)
    }
}

// MARK: - Invite Response

struct InviteResponse: Codable {
    let invited: String
    let flow: String
    let profile: InviteProfile
}

struct InviteProfile: Codable {
    let id: String
    let businessName: String?
    let tier: String?
    let role: String?
    let businessId: String?
}
