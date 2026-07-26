//
//  DataStore.swift
//  MowFlow
//
//  Central data store — loads from Supabase, falls back to demo data.
//  All mutations go through SupabaseService and update published arrays.
//

import SwiftUI

private struct ClientInsert: Encodable {
    let id: UUID
    let userId: UUID
    let name: String
    let address: String?
    let phone: String?
    let email: String?
    let rate: Double
    let cleaningNotes: String?
    let keyCode: String?
    let alarmCode: String?
    let petInstructions: String?
}

private struct JobInsert: Encodable {
    let id: UUID
    let userId: UUID
    let clientId: UUID
    let assignedTo: UUID?
    let title: String
    let scheduledDate: String
    let scheduledTime: String?
    let durationMinutes: Int?
    let status: Job.JobStatus
    let notes: String?
    let photoUrl: String?
    let routeOrder: Int?
    let isRecurring: Bool?
    let recurrenceRule: String?
}

private struct JobStatusPatch: Encodable {
    let status: Job.JobStatus
}

private struct JobSchedulePatch: Encodable {
    let scheduledDate: String
}

private struct InvoicePaidPatch: Encodable {
    let status: Invoice.InvoiceStatus
    let paidAt: String
}

@MainActor
final class DataStore: ObservableObject {
    @Published var jobs: [Job] = []
    @Published var clients: [Client] = []
    @Published var invoices: [Invoice] = []
    @Published var isLoading = false
    @Published var error: String?

    private let sb = SupabaseService.shared

    // MARK: - Load

    private var loadTask: Task<Void, Never>?
    private var loadGeneration = 0

    func loadAll() async {
        loadGeneration += 1
        let generation = loadGeneration

        // Cancel any in-flight load and wait for it to finish
        loadTask?.cancel()
        _ = await loadTask?.value
        guard !Task.isCancelled, generation == loadGeneration else { return }

        isLoading = true
        error = nil

        let isConfigured = await sb.isConfigured
        guard !Task.isCancelled, generation == loadGeneration else { return }
        guard isConfigured else {
            loadDemo()
            isLoading = false
            return
        }
        guard await sb.ensureAuthenticated() else {
            guard generation == loadGeneration else { return }
            clear()
            return
        }
        guard !Task.isCancelled, generation == loadGeneration else { return }

        loadTask = Task {
            do {
                async let j = sb.fetchJobs()
                async let c: [Client] = sb.fetch("clients", query: ["order": "name.asc"])
                async let i = sb.fetchInvoices()
                let loaded = try await (j, c, i)
                guard !Task.isCancelled, generation == loadGeneration else { return }
                (jobs, clients, invoices) = loaded
            } catch is CancellationError {
                return // Silently cancelled — the new loadTask will replace us
            } catch {
                guard !Task.isCancelled, generation == loadGeneration else { return }
                self.error = error.localizedDescription
                loadDemo()
            }
            if generation == loadGeneration {
                isLoading = false
            }
        }
        await loadTask?.value
    }

    func clear() {
        loadGeneration += 1
        loadTask?.cancel()
        loadTask = nil
        jobs = []
        clients = []
        invoices = []
        isLoading = false
        error = nil
    }

    // MARK: - Jobs

    func createJob(_ job: Job) async throws {
        guard let clientId = job.clientId else {
            throw DataStoreError.clientRequired
        }
        guard await sb.isConfigured else {
            jobs.append(job)
            return
        }
        do {
            guard let userId = try await sb.getCurrentUserId() else {
                throw DataStoreError.authenticationRequired
            }
            let created: Job = try await sb.insert("jobs", JobInsert(
                id: job.id,
                userId: userId,
                clientId: clientId,
                assignedTo: job.assignedTo,
                title: job.title,
                scheduledDate: job.scheduledDate,
                scheduledTime: job.scheduledTime,
                durationMinutes: job.durationMinutes,
                status: job.status,
                notes: job.notes,
                photoUrl: job.photoUrl,
                routeOrder: job.routeOrder,
                isRecurring: job.isRecurring,
                recurrenceRule: job.recurrenceRule
            )) 
            if !jobs.contains(where: { $0.id == created.id }) {
                jobs.append(created)
            }
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    private func updateJobStatus(_ job: Job, status: Job.JobStatus) async throws {
        var updated = job
        updated.status = status
        guard await sb.isConfigured else {
            if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
                jobs[idx] = updated
            }
            return
        }
        try await sb.update("jobs", id: job.id, JobStatusPatch(status: status))
        if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
            jobs[idx] = updated
        }
    }

    private func updateJobSchedule(_ job: Job, scheduledDate: String) async throws {
        var updated = job
        updated.scheduledDate = scheduledDate
        guard await sb.isConfigured else {
            if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
                jobs[idx] = updated
            }
            return
        }
        try await sb.update("jobs", id: job.id, JobSchedulePatch(scheduledDate: scheduledDate))
        if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
            jobs[idx] = updated
        }
    }

    func deleteJob(_ job: Job) async throws {
        guard await sb.isConfigured else {
            jobs.removeAll { $0.id == job.id }
            return
        }
        try await sb.delete("jobs", id: job.id)
        jobs.removeAll { $0.id == job.id }
    }

    func toggleJobStatus(_ job: Job) async throws {
        let status: Job.JobStatus = job.status == .done ? .scheduled : .done
        try await updateJobStatus(job, status: status)
    }

    private var isRainDelaying = false

    func rainDelay(for date: String) async throws {
        guard !isRainDelaying else { return }
        isRainDelaying = true
        defer { isRainDelaying = false }

        let pending = jobs.filter { $0.scheduledDate == date && $0.status == .scheduled }
        guard !pending.isEmpty else { return }
        let tomorrow = nextDay(date)

        // Collect all updates first; if any fail, roll back the ones that succeeded
        var updatedJobs: [Job] = []

        for job in pending {
            do {
                try await updateJobSchedule(job, scheduledDate: tomorrow)
                var updated = job
                updated.scheduledDate = tomorrow
                updatedJobs.append(updated)
            } catch {
                // Rollback: move already-updated jobs back to original date
                for rollback in updatedJobs {
                    try? await updateJobSchedule(rollback, scheduledDate: date)
                }
                throw error
            }
        }
    }

    // MARK: - Clients

    func createClient(_ client: Client) async throws {
        guard await sb.isConfigured else {
            clients.append(client)
            return
        }
        do {
            guard let userId = try await sb.getCurrentUserId() else {
                throw DataStoreError.authenticationRequired
            }
            let created: Client = try await sb.insert("clients", ClientInsert(
                id: client.id,
                userId: userId,
                name: client.name,
                address: client.address,
                phone: client.phone,
                email: client.email,
                rate: client.rate,
                cleaningNotes: client.cleaningNotes,
                keyCode: client.keyCode,
                alarmCode: client.alarmCode,
                petInstructions: client.petInstructions
            )) 
            if !clients.contains(where: { $0.id == created.id }) {
                clients.append(created)
            }
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    func updateClient(_ client: Client) async throws {
        guard await sb.isConfigured else {
            if let idx = clients.firstIndex(where: { $0.id == client.id }) {
                clients[idx] = client
            }
            return
        }
        try await sb.update("clients", id: client.id, client)
        if let idx = clients.firstIndex(where: { $0.id == client.id }) {
            clients[idx] = client
        }
    }

    func deleteClient(_ client: Client) async throws {
        guard await sb.isConfigured else {
            clients.removeAll { $0.id == client.id }
            return
        }
        try await sb.delete("clients", id: client.id)
        clients.removeAll { $0.id == client.id }
    }

    // MARK: - Invoices

    func markInvoicePaid(_ invoice: Invoice) async throws {
        let paidAt = ISO8601DateFormatter().string(from: Date())
        var updated = invoice
        updated.status = .paid
        updated.paidAt = paidAt
        guard await sb.isConfigured else {
            if let idx = invoices.firstIndex(where: { $0.id == invoice.id }) {
                invoices[idx] = updated
            }
            return
        }
        do {
            try await sb.update("invoices", id: invoice.id, InvoicePaidPatch(
                status: updated.status,
                paidAt: paidAt
            ))
            if let idx = invoices.firstIndex(where: { $0.id == invoice.id }) {
                invoices[idx] = updated
            }
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    // MARK: - Helpers

    private func nextDay(_ date: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(secondsFromGMT: 0)!
        guard let d = f.date(from: date) else { return date }
        guard let next = f.calendar!.date(byAdding: .day, value: 1, to: d) else { return date }
        return f.string(from: next)
    }

    private func loadDemo() {
        let d = DemoData()
        jobs = d.jobs
        clients = d.clients
        invoices = d.invoices
    }
}

enum DataStoreError: LocalizedError {
    case authenticationRequired
    case clientRequired

    var errorDescription: String? {
        switch self {
        case .authenticationRequired:
            "Please sign in before saving."
        case .clientRequired:
            "Select a client before saving the job."
        }
    }
}

// MARK: - Demo Data

struct DemoData {
    let jobs: [Job] = [
        Job(id: UUID(), title: "Weekly Mow", scheduledDate: DemoData.today(), scheduledTime: "08:00", status: .scheduled, routeOrder: 0, clients: Job.ClientRef(id: UUID(), name: "Smith Residence", address: "123 Main St", rate: 45)),
        Job(id: UUID(), title: "Trim + Mow", scheduledDate: DemoData.today(), scheduledTime: "10:30", status: .scheduled, routeOrder: 1, clients: Job.ClientRef(id: UUID(), name: "Johnson Home", address: "456 Oak Ave", rate: 65)),
        Job(id: UUID(), title: "Leaf Cleanup", scheduledDate: DemoData.today(), scheduledTime: "14:00", status: .done, routeOrder: 2, clients: Job.ClientRef(id: UUID(), name: "Williams Estate", address: "789 Pine Rd", rate: 80)),
        Job(id: UUID(), title: "Weekly Mow", scheduledDate: DemoData.tomorrow(), scheduledTime: "09:00", status: .scheduled, routeOrder: 0, clients: Job.ClientRef(id: UUID(), name: "Brown Property", address: "101 Elm St", rate: 45)),
    ]

    let clients: [Client] = [
        Client(id: UUID(), name: "Smith Residence", address: "123 Main St, Edmond, OK", phone: "405-555-0101", rate: 45, keyCode: "1234", petInstructions: "Friendly lab, back gate"),
        Client(id: UUID(), name: "Johnson Home", address: "456 Oak Ave, OKC, OK", phone: "405-555-0202", rate: 65),
        Client(id: UUID(), name: "Williams Estate", address: "789 Pine Rd, Edmond, OK", rate: 80, petInstructions: "2 dogs, use side gate"),
    ]

    let invoices: [Invoice] = [
        Invoice(id: UUID(), amount: 45, status: .unpaid, createdAt: DemoData.today(), clients: Invoice.ClientRef(name: "Smith Residence")),
        Invoice(id: UUID(), amount: 65, status: .paid, paidAt: DemoData.yesterday(), createdAt: DemoData.yesterday(), clients: Invoice.ClientRef(name: "Johnson Home")),
    ]

    static func today() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }
    static func tomorrow() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = Calendar.current.date(byAdding: .day, value: 1, to: Date()) else { return "" }
        return f.string(from: d)
    }
    static func yesterday() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = Calendar.current.date(byAdding: .day, value: -1, to: Date()) else { return "" }
        return f.string(from: d)
    }
}
