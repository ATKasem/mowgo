//
//  Persistence.swift
//  MowGo
//
//  SwiftData persistence layer — local-first caching for offline support.
//  Stores serialized JSON backups so Jobs/Client/Invoice can be reconstructed
//  identically to what the server returns.
//

import Foundation
import SwiftData

@MainActor
final class Persistence {
    private let modelContainer: ModelContainer

    init(modelContainer: ModelContainer) {
        self.modelContainer = modelContainer
    }

    /// Convenience accessor for the model context.
    private var context: ModelContext {
        modelContainer.mainContext
    }

    // MARK: - Save

    /// Replace all cached jobs with the provided list.
    func saveJobs(_ jobs: [Job]) {
        do {
            let existing = try context.fetch(FetchDescriptor<JobCache>())
            for item in existing { context.delete(item) }
        } catch {
            print("[Persistence] failed to clear cached jobs: \(error)")
        }
        for job in jobs {
            context.insert(JobCache(job: job))
        }
        do { try context.save() } catch {
            print("[Persistence] failed to save jobs: \(error)")
        }
    }

    /// Replace all cached clients with the provided list.
    func saveClients(_ clients: [Client]) {
        do {
            let existing = try context.fetch(FetchDescriptor<ClientCache>())
            for item in existing { context.delete(item) }
        } catch {
            print("[Persistence] failed to clear cached clients: \(error)")
        }
        for client in clients {
            context.insert(ClientCache(client: client))
        }
        do { try context.save() } catch {
            print("[Persistence] failed to save clients: \(error)")
        }
    }

    /// Replace all cached invoices with the provided list.
    func saveInvoices(_ invoices: [Invoice]) {
        do {
            let existing = try context.fetch(FetchDescriptor<InvoiceCache>())
            for item in existing { context.delete(item) }
        } catch {
            print("[Persistence] failed to clear cached invoices: \(error)")
        }
        for invoice in invoices {
            context.insert(InvoiceCache(invoice: invoice))
        }
        do { try context.save() } catch {
            print("[Persistence] failed to save invoices: \(error)")
        }
    }

    // MARK: - Load

    /// Read cached jobs from SwiftData, reconstructing via stored JSON.
    func loadJobs() -> [Job] {
        let descriptor = FetchDescriptor<JobCache>(sortBy: [SortDescriptor(\.routeOrder)])
        let cached: [JobCache]
        do { cached = try context.fetch(descriptor) } catch {
            print("[Persistence] failed to load jobs: \(error)"); return []
        }
        return cached.compactMap { $0.toJob() }
    }

    /// Read cached clients from SwiftData.
    func loadClients() -> [Client] {
        let descriptor = FetchDescriptor<ClientCache>(sortBy: [SortDescriptor(\.name)])
        let cached: [ClientCache]
        do { cached = try context.fetch(descriptor) } catch {
            print("[Persistence] failed to load clients: \(error)"); return []
        }
        return cached.compactMap { $0.toClient() }
    }

    /// Read cached invoices from SwiftData.
    func loadInvoices() -> [Invoice] {
        let descriptor = FetchDescriptor<InvoiceCache>(sortBy: [SortDescriptor(\.createdAt)])
        let cached: [InvoiceCache]
        do { cached = try context.fetch(descriptor) } catch {
            print("[Persistence] failed to load invoices: \(error)"); return []
        }
        return cached.compactMap { $0.toInvoice() }
    }

    // MARK: - Mutation Queue (Offline → Sync)

    /// Monotonically increasing sequence for deterministic FIFO ordering.
    /// Persisted to UserDefaults so ordering survives app restarts even
    /// when pending mutations from a previous session are still queued.
    private var nextSequence: Int {
        get { UserDefaults.standard.integer(forKey: "mowgo.mutation.seq") }
        set { UserDefaults.standard.set(newValue, forKey: "mowgo.mutation.seq") }
    }

    /// Enqueue a mutation made while offline for later replay.
    func enqueueMutation(operation: String, entityId: UUID, payload: Data, userId: UUID?) {
        let seq = nextSequence
        nextSequence += 1
        let mutation = PendingMutation(
            operation: operation,
            entityId: entityId,
            payload: payload,
            sequence: seq,
            userId: userId
        )
        context.insert(mutation)
        do { try context.save() } catch {
            print("[Persistence] failed to enqueue mutation: \(error)")
        }
    }

    /// Load all pending mutations in FIFO order (oldest first).
    func loadPendingMutations() -> [PendingMutation] {
        let descriptor = FetchDescriptor<PendingMutation>(
            sortBy: [SortDescriptor(\.sequence)]
        )
        do {
            return try context.fetch(descriptor)
        } catch {
            print("[Persistence] failed to load mutations: \(error)")
            return []
        }
    }

    /// Remove a successfully replayed mutation from the queue.
    func removeMutation(_ mutation: PendingMutation) {
        context.delete(mutation)
        do { try context.save() } catch {
            print("[Persistence] failed to remove mutation: \(error)")
        }
    }

    /// Clear all pending mutations (e.g. on sign-out).
    func clearAllMutations() {
        do {
            let mutations = try context.fetch(FetchDescriptor<PendingMutation>())
            for item in mutations { context.delete(item) }
            try context.save()
        } catch {
            print("[Persistence] failed to clear mutations: \(error)")
        }
    }

    // MARK: - Helpers

    /// Returns true if any cached data exists (used to decide whether to
    /// show cached data immediately before a network round-trip).
    func hasCachedData() -> Bool {
        let jobCount = (try? context.fetch(FetchDescriptor<JobCache>()).count) ?? 0
        let clientCount = (try? context.fetch(FetchDescriptor<ClientCache>()).count) ?? 0
        let invoiceCount = (try? context.fetch(FetchDescriptor<InvoiceCache>()).count) ?? 0
        return jobCount > 0 || clientCount > 0 || invoiceCount > 0
    }

    /// Clear all cached data (e.g. on sign-out).
    func clearAll() {
        do {
            let jobs = try context.fetch(FetchDescriptor<JobCache>())
            for item in jobs { context.delete(item) }
        } catch {
            print("[Persistence] failed to clear jobs: \(error)")
        }
        do {
            let clients = try context.fetch(FetchDescriptor<ClientCache>())
            for item in clients { context.delete(item) }
        } catch {
            print("[Persistence] failed to clear clients: \(error)")
        }
        do {
            let invoices = try context.fetch(FetchDescriptor<InvoiceCache>())
            for item in invoices { context.delete(item) }
        } catch {
            print("[Persistence] failed to clear invoices: \(error)")
        }
        do { try context.save() } catch {
            print("[Persistence] failed to save after clear: \(error)")
        }
        clearAllMutations()
    }
}
