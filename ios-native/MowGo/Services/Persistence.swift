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
        // Delete existing cached jobs
        let fetchDescriptor = FetchDescriptor<JobCache>()
        do { try context.delete(matching: fetchDescriptor) } catch { print("[Persistence] failed to delete cached jobs: \(error)") }
        // Insert new ones
        for job in jobs {
            context.insert(JobCache(job: job))
        }
        do { try context.save() } catch { print("[Persistence] failed to save jobs: \(error)") }
    }

    /// Replace all cached clients with the provided list.
    func saveClients(_ clients: [Client]) {
        let fetchDescriptor = FetchDescriptor<ClientCache>()
        do { try context.delete(matching: fetchDescriptor) } catch { print("[Persistence] failed to delete cached clients: \(error)") }
        for client in clients {
            context.insert(ClientCache(client: client))
        }
        do { try context.save() } catch { print("[Persistence] failed to save clients: \(error)") }
    }

    /// Replace all cached invoices with the provided list.
    func saveInvoices(_ invoices: [Invoice]) {
        let fetchDescriptor = FetchDescriptor<InvoiceCache>()
        do { try context.delete(matching: fetchDescriptor) } catch { print("[Persistence] failed to delete cached invoices: \(error)") }
        for invoice in invoices {
            context.insert(InvoiceCache(invoice: invoice))
        }
        do { try context.save() } catch { print("[Persistence] failed to save invoices: \(error)") }
    }

    // MARK: - Load

    /// Read cached jobs from SwiftData, reconstructing via stored JSON.
    func loadJobs() -> [Job] {
        let descriptor = FetchDescriptor<JobCache>(sortBy: [SortDescriptor(\.routeOrder)])
        let cached: [JobCache]
        do { cached = try context.fetch(descriptor) } catch { print("[Persistence] failed to load jobs: \(error)"); return [] }
        return cached.compactMap { $0.toJob() }
    }

    /// Read cached clients from SwiftData.
    func loadClients() -> [Client] {
        let descriptor = FetchDescriptor<ClientCache>(sortBy: [SortDescriptor(\.name)])
        let cached: [ClientCache]
        do { cached = try context.fetch(descriptor) } catch { print("[Persistence] failed to load clients: \(error)"); return [] }
        return cached.compactMap { $0.toClient() }
    }

    /// Read cached invoices from SwiftData.
    func loadInvoices() -> [Invoice] {
        let descriptor = FetchDescriptor<InvoiceCache>(sortBy: [SortDescriptor(\.createdAt)])
        let cached: [InvoiceCache]
        do { cached = try context.fetch(descriptor) } catch { print("[Persistence] failed to load invoices: \(error)"); return [] }
        return cached.compactMap { $0.toInvoice() }
    }

    // MARK: - Helpers

    /// Returns true if any cached data exists (used to decide whether to
    /// show cached data immediately before a network round-trip).
    func hasCachedData() -> Bool {
        let jobCount: Int
        do { jobCount = try context.fetchCount(FetchDescriptor<JobCache>()) } catch { print("[Persistence] failed to count jobs: \(error)"); jobCount = 0 }
        let clientCount: Int
        do { clientCount = try context.fetchCount(FetchDescriptor<ClientCache>()) } catch { print("[Persistence] failed to count clients: \(error)"); clientCount = 0 }
        let invoiceCount: Int
        do { invoiceCount = try context.fetchCount(FetchDescriptor<InvoiceCache>()) } catch { print("[Persistence] failed to count invoices: \(error)"); invoiceCount = 0 }
        return jobCount > 0 || clientCount > 0 || invoiceCount > 0
    }

    /// Clear all cached data (e.g. on sign-out).
    func clearAll() {
        do { try context.delete(matching: FetchDescriptor<JobCache>()) } catch { print("[Persistence] failed to clear jobs: \(error)") }
        do { try context.delete(matching: FetchDescriptor<ClientCache>()) } catch { print("[Persistence] failed to clear clients: \(error)") }
        do { try context.delete(matching: FetchDescriptor<InvoiceCache>()) } catch { print("[Persistence] failed to clear invoices: \(error)") }
        do { try context.save() } catch { print("[Persistence] failed to save after clear: \(error)") }
    }
}
