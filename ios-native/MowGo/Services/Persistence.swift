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

    init() throws {
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        self.modelContainer = try ModelContainer(
            for: JobCache.self, ClientCache.self, InvoiceCache.self,
            configurations: config
        )
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
        try? context.delete(matching: fetchDescriptor)
        // Insert new ones
        for job in jobs {
            context.insert(JobCache(job: job))
        }
        try? context.save()
    }

    /// Replace all cached clients with the provided list.
    func saveClients(_ clients: [Client]) {
        let fetchDescriptor = FetchDescriptor<ClientCache>()
        try? context.delete(matching: fetchDescriptor)
        for client in clients {
            context.insert(ClientCache(client: client))
        }
        try? context.save()
    }

    /// Replace all cached invoices with the provided list.
    func saveInvoices(_ invoices: [Invoice]) {
        let fetchDescriptor = FetchDescriptor<InvoiceCache>()
        try? context.delete(matching: fetchDescriptor)
        for invoice in invoices {
            context.insert(InvoiceCache(invoice: invoice))
        }
        try? context.save()
    }

    // MARK: - Load

    /// Read cached jobs from SwiftData, reconstructing via stored JSON.
    func loadJobs() -> [Job] {
        let descriptor = FetchDescriptor<JobCache>(sortBy: [SortDescriptor(\.routeOrder)])
        guard let cached = try? context.fetch(descriptor) else { return [] }
        return cached.compactMap { $0.toJob() }
    }

    /// Read cached clients from SwiftData.
    func loadClients() -> [Client] {
        let descriptor = FetchDescriptor<ClientCache>(sortBy: [SortDescriptor(\.name)])
        guard let cached = try? context.fetch(descriptor) else { return [] }
        return cached.compactMap { $0.toClient() }
    }

    /// Read cached invoices from SwiftData.
    func loadInvoices() -> [Invoice] {
        let descriptor = FetchDescriptor<InvoiceCache>(sortBy: [SortDescriptor(\.createdAt)])
        guard let cached = try? context.fetch(descriptor) else { return [] }
        return cached.compactMap { $0.toInvoice() }
    }

    // MARK: - Helpers

    /// Returns true if any cached data exists (used to decide whether to
    /// show cached data immediately before a network round-trip).
    func hasCachedData() -> Bool {
        let jobCount = (try? context.fetchCount(FetchDescriptor<JobCache>())) ?? 0
        let clientCount = (try? context.fetchCount(FetchDescriptor<ClientCache>())) ?? 0
        let invoiceCount = (try? context.fetchCount(FetchDescriptor<InvoiceCache>())) ?? 0
        return jobCount > 0 || clientCount > 0 || invoiceCount > 0
    }

    /// Clear all cached data (e.g. on sign-out).
    func clearAll() {
        try? context.delete(matching: FetchDescriptor<JobCache>())
        try? context.delete(matching: FetchDescriptor<ClientCache>())
        try? context.delete(matching: FetchDescriptor<InvoiceCache>())
        try? context.save()
    }
}
