//
//  Models.swift
//  MowFlow
//
//  Matches Supabase schema (001_initial_schema.sql).
//  All field names use snake_case to decode directly from PostgREST.
//

import Foundation

// MARK: - Job

struct Job: Codable, Identifiable, Equatable {
    let id: UUID
    var userId: UUID?
    var clientId: UUID?
    var assignedTo: UUID?
    var title: String
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
        var rate: Double?
        var cleaningNotes: String?
        var keyCode: String?
        var alarmCode: String?
        var petInstructions: String?
    }

    // Computed helpers (mirrors web app's data.js mapping)
    var clientName: String? { clients?.name }
    var address: String? { clients?.address }
    var clientRate: Double? { clients?.rate }
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
    var rate: Double
    var cleaningNotes: String?
    var keyCode: String?
    var alarmCode: String?
    var petInstructions: String?
    var createdAt: String?
}

// MARK: - Invoice

struct Invoice: Codable, Identifiable, Equatable {
    let id: UUID
    var userId: UUID?
    var clientId: UUID?
    var jobId: UUID?
    var amount: Double
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

struct UserProfile: Codable {
    var id: UUID?
    var businessName: String?
    var phone: String?
    var tier: String?
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
