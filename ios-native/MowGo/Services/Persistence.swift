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
    func saveJobs(_ jobs: [Job], currentUserId: UUID) {
        do {
            let descriptor = FetchDescriptor<JobCache>(
                predicate: #Predicate { $0.userId == currentUserId }
            )
            let existing = try context.fetch(descriptor)
            for item in existing { context.delete(item) }
            for job in jobs {
                context.insert(JobCache(job: job, userId: currentUserId))
            }
            try context.save()
        } catch {
            #if DEBUG
            print("[Persistence] failed to save jobs: \(error)")
            #endif
        }
    }

    /// Replace all cached clients with the provided list.
    func saveClients(_ clients: [Client], currentUserId: UUID) {
        do {
            let descriptor = FetchDescriptor<ClientCache>(
                predicate: #Predicate { $0.userId == currentUserId }
            )
            let existing = try context.fetch(descriptor)
            for item in existing { context.delete(item) }
            for client in clients {
                context.insert(ClientCache(client: client, userId: currentUserId))
            }
            try context.save()
        } catch {
            #if DEBUG
            print("[Persistence] failed to save clients: \(error)")
            #endif
        }
    }

    /// Replace all cached invoices with the provided list.
    func saveInvoices(_ invoices: [Invoice], currentUserId: UUID) {
        do {
            let descriptor = FetchDescriptor<InvoiceCache>(
                predicate: #Predicate { $0.userId == currentUserId }
            )
            let existing = try context.fetch(descriptor)
            for item in existing { context.delete(item) }
            for invoice in invoices {
                context.insert(InvoiceCache(invoice: invoice, userId: currentUserId))
            }
            try context.save()
        } catch {
            #if DEBUG
            print("[Persistence] failed to save invoices: \(error)")
            #endif
        }
    }

    // MARK: - Load

    /// Read cached jobs from SwiftData, reconstructing via stored JSON.
    func loadJobs(currentUserId: UUID) -> [Job] {
        let descriptor = FetchDescriptor<JobCache>(
            predicate: #Predicate { $0.userId == currentUserId },
            sortBy: [SortDescriptor(\.routeOrder)]
        )
        let cached: [JobCache]
        do { cached = try context.fetch(descriptor) } catch {
            #if DEBUG
            print("[Persistence] failed to load jobs: \(error)")
            #endif
            return []
        }
        return cached.compactMap { $0.toJob() }
    }

    /// Read cached clients from SwiftData.
    func loadClients(currentUserId: UUID) -> [Client] {
        let descriptor = FetchDescriptor<ClientCache>(
            predicate: #Predicate { $0.userId == currentUserId },
            sortBy: [SortDescriptor(\.name)]
        )
        let cached: [ClientCache]
        do { cached = try context.fetch(descriptor) } catch {
            #if DEBUG
            print("[Persistence] failed to load clients: \(error)")
            #endif
            return []
        }
        return cached.compactMap { $0.toClient() }
    }

    /// Read cached invoices from SwiftData.
    func loadInvoices(currentUserId: UUID) -> [Invoice] {
        let descriptor = FetchDescriptor<InvoiceCache>(
            predicate: #Predicate { $0.userId == currentUserId },
            sortBy: [SortDescriptor(\.createdAt)]
        )
        let cached: [InvoiceCache]
        do { cached = try context.fetch(descriptor) } catch {
            #if DEBUG
            print("[Persistence] failed to load invoices: \(error)")
            #endif
            return []
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
    func enqueueMutation(operation: String, entityId: UUID, payload: Data, userId: UUID) throws {
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
        do {
            try context.save()
        } catch {
            context.delete(mutation)
            throw error
        }
    }

    /// Load all pending mutations in FIFO order (oldest first), scoped to current user.
    func loadPendingMutations(currentUserId: UUID) -> [PendingMutation] {
        let descriptor = FetchDescriptor<PendingMutation>(
            predicate: #Predicate { $0.userId == currentUserId },
            sortBy: [SortDescriptor(\.sequence)]
        )
        do {
            return try context.fetch(descriptor)
        } catch {
            #if DEBUG
            print("[Persistence] failed to load mutations: \(error)")
            #endif
            return []
        }
    }

    /// Remove a successfully replayed mutation from the queue.
    func removeMutation(_ mutation: PendingMutation) {
        context.delete(mutation)
        do { try context.save() } catch {
            #if DEBUG
            print("[Persistence] failed to remove mutation: \(error)")
            #endif
        }
    }

    /// Remove queued mutations for one entity and operation. Returns whether
    /// at least one matching mutation was removed.
    @discardableResult
    func removePendingMutations(
        operation: String,
        entityId: UUID,
        currentUserId: UUID,
        payloadMatches: ((Data) -> Bool)? = nil
    ) -> Bool {
        let targetOperation = operation
        let targetEntityId = entityId
        let targetUserId = currentUserId
        let descriptor = FetchDescriptor<PendingMutation>(
            predicate: #Predicate {
                $0.operation == targetOperation &&
                    $0.entityId == targetEntityId &&
                    $0.userId == targetUserId
            }
        )
        do {
            let fetched = try context.fetch(descriptor)
            let mutations = fetched.filter { mutation in
                payloadMatches?(mutation.payload) ?? true
            }
            for mutation in mutations { context.delete(mutation) }
            if !mutations.isEmpty { try context.save() }
            return !mutations.isEmpty
        } catch {
            #if DEBUG
            print("[Persistence] failed to remove pending mutations: \(error)")
            #endif
            return false
        }
    }

    /// Clear all pending mutations (e.g. on sign-out).
    func clearAllMutations(currentUserId: UUID) {
        do {
            let descriptor = FetchDescriptor<PendingMutation>(
                predicate: #Predicate { $0.userId == currentUserId }
            )
            let mutations = try context.fetch(descriptor)
            for item in mutations { context.delete(item) }
            try context.save()
        } catch {
            #if DEBUG
            print("[Persistence] failed to clear mutations: \(error)")
            #endif
        }
    }

    // MARK: - Helpers

    /// Returns true if any cached data exists (used to decide whether to
    /// show cached data immediately before a network round-trip).
    func hasCachedData(currentUserId: UUID) -> Bool {
        let jobs = FetchDescriptor<JobCache>(predicate: #Predicate { $0.userId == currentUserId })
        let clients = FetchDescriptor<ClientCache>(predicate: #Predicate { $0.userId == currentUserId })
        let invoices = FetchDescriptor<InvoiceCache>(predicate: #Predicate { $0.userId == currentUserId })
        let jobCount = (try? context.fetch(jobs).count) ?? 0
        let clientCount = (try? context.fetch(clients).count) ?? 0
        let invoiceCount = (try? context.fetch(invoices).count) ?? 0
        return jobCount > 0 || clientCount > 0 || invoiceCount > 0
    }

    /// Clear all cached data (e.g. on sign-out).
    func clearAll(currentUserId: UUID) {
        do {
            let descriptor = FetchDescriptor<JobCache>(predicate: #Predicate { $0.userId == currentUserId })
            let jobs = try context.fetch(descriptor)
            for item in jobs { context.delete(item) }
        } catch {
            #if DEBUG
            print("[Persistence] failed to clear jobs: \(error)")
            #endif
        }
        do {
            let descriptor = FetchDescriptor<ClientCache>(predicate: #Predicate { $0.userId == currentUserId })
            let clients = try context.fetch(descriptor)
            for item in clients { context.delete(item) }
        } catch {
            #if DEBUG
            print("[Persistence] failed to clear clients: \(error)")
            #endif
        }
        do {
            let descriptor = FetchDescriptor<InvoiceCache>(predicate: #Predicate { $0.userId == currentUserId })
            let invoices = try context.fetch(descriptor)
            for item in invoices { context.delete(item) }
        } catch {
            #if DEBUG
            print("[Persistence] failed to clear invoices: \(error)")
            #endif
        }
        do { try context.save() } catch {
            #if DEBUG
            print("[Persistence] failed to save after clear: \(error)")
            #endif
        }
        clearAllMutations(currentUserId: currentUserId)
    }
}
