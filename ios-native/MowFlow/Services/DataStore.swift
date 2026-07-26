//
//  DataStore.swift
//  MowFlow
//
//  Central data store — loads from Supabase, falls back to demo data.
//  All mutations go through SupabaseService and update published arrays.
//

import SwiftUI

@MainActor
final class DataStore: ObservableObject {
    @Published var jobs: [Job] = []
    @Published var clients: [Client] = []
    @Published var invoices: [Invoice] = []
    @Published var isLoading = true
    @Published var error: String?

    private let sb = SupabaseService.shared

    init() { Task { await loadAll() } }

    // MARK: - Load

    private var loadTask: Task<Void, Never>?

    func loadAll() async {
        // Cancel any in-flight load and wait for it to finish
        loadTask?.cancel()
        _ = await loadTask?.value

        isLoading = true
        error = nil

        guard await sb.isConfigured else {
            loadDemo()
            isLoading = false
            return
        }

        loadTask = Task {
            do {
                async let j = sb.fetchJobs()
                async let c: [Client] = sb.fetch("clients", query: ["order": "name.asc"])
                async let i = sb.fetchInvoices()
                (jobs, clients, invoices) = try await (j, c, i)
            } catch is CancellationError {
                return // Silently cancelled — the new loadTask will replace us
            } catch {
                self.error = error.localizedDescription
                loadDemo()
            }
            isLoading = false
        }
        await loadTask?.value
    }

    // MARK: - Jobs

    func createJob(_ job: Job) async throws {
        guard await sb.isConfigured else {
            jobs.append(job)
            return
        }
        do {
            let created: Job = try await sb.insert("jobs", job)
            jobs.append(created)
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    func updateJob(_ job: Job) async throws {
        guard await sb.isConfigured else {
            if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
                jobs[idx] = job
            }
            return
        }
        try await sb.update("jobs", id: job.id, job)
        if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
            jobs[idx] = job
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
        var updated = job
        updated.status = job.status == .done ? .scheduled : .done
        try await updateJob(updated)
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

        for var job in pending {
            job.scheduledDate = tomorrow
            do {
                try await updateJob(job)
                updatedJobs.append(job)
            } catch {
                // Rollback: move already-updated jobs back to original date
                for var rollback in updatedJobs {
                    rollback.scheduledDate = date
                    try? await updateJob(rollback)
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
            let created: Client = try await sb.insert("clients", client)
            clients.append(created)
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
        var updated = invoice
        updated.status = .paid
        updated.paidAt = ISO8601DateFormatter().string(from: Date())
        guard await sb.isConfigured else {
            if let idx = invoices.firstIndex(where: { $0.id == invoice.id }) {
                invoices[idx] = updated
            }
            return
        }
        do {
            try await sb.update("invoices", id: invoice.id, updated)
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
        guard let d = f.date(from: date) else { return date }
        guard let next = Calendar.current.date(byAdding: .day, value: 1, to: d) else { return date }
        return f.string(from: next)
    }

    private func loadDemo() {
        let d = DemoData()
        jobs = d.jobs
        clients = d.clients
        invoices = d.invoices
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
