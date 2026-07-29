//
//  DataStore.swift
//  MowGo
//
//  Central data store — loads from Supabase with local SwiftData caching.
//  All mutations go through SupabaseService and update published arrays.
//

import SwiftUI
import SwiftData

private struct ClientInsert: Encodable {
    let id: UUID
    let userId: UUID
    let name: String
    let address: String?
    let phone: String?
    let email: String?
    let rate: Decimal
    let cleaningNotes: String?
    let keyCode: String?
    let alarmCode: String?
    let petInstructions: String?
}

private struct ClientUpdate: Encodable {
    let name: String
    let address: String?
    let phone: String?
    let email: String?
    let rate: Decimal
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

private struct JobAssignedPatch: Encodable {
    let assignedTo: UUID?  // nil = unassign
}

private struct JobRoutePatch: Encodable {
    let routeOrder: Int?
}

private struct RecurringJobInsert: Encodable {
    let id: UUID
    let userId: UUID
    let clientId: UUID
    let title: String
    let scheduledTime: String?
    let durationMinutes: Int?
    let assignedTo: UUID?
    let notes: String?
    let frequency: String
    let daysOfWeek: [Int]
    let isActive: Bool
    let startDate: String
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
    @Published var teamMembers: [UserProfile] = []
    @Published var recurringJobs: [RecurringJob] = []
    @Published var isLoading = false
    @Published var error: String?

    private let sb = SupabaseService.shared
    let persistence: Persistence?

    init(modelContainer: ModelContainer) {
        self.persistence = Persistence(modelContainer: modelContainer)
    }

    // MARK: - Load

    private var loadTask: Task<Void, Never>?
    private var loadGeneration = 0
    private var pollingTask: Task<Void, Never>?

    func loadAll() async {
        loadGeneration += 1
        let generation = loadGeneration

        // Cancel any in-flight load and wait for it to finish
        loadTask?.cancel()
        _ = await loadTask?.value
        guard !Task.isCancelled, generation == loadGeneration else { return }

        isLoading = true
        error = nil

        // ---- Cache-first: show cached data instantly ----
        if let persistence, persistence.hasCachedData() {
            self.jobs = persistence.loadJobs()
            self.clients = persistence.loadClients()
            self.invoices = persistence.loadInvoices()
        }

        let isConfigured = await sb.isConfigured
        guard !Task.isCancelled, generation == loadGeneration else { return }
        guard isConfigured else {
            // Supabase not configured — if we have cached data, show it;
            // otherwise surface the error.
            if persistence?.hasCachedData() != true {
                self.error = "Supabase not configured. Please check your settings."
            }
            isLoading = false
            return
        }
        guard await sb.ensureAuthenticated() else {
            guard generation == loadGeneration else { return }
            // If we had data loaded previously, the session expired mid-use.
            // Notify the app so it can show an alert before clearing state.
            let hadData = !jobs.isEmpty || !clients.isEmpty || !invoices.isEmpty
            if hadData {
                await MainActor.run {
                    NotificationCenter.default.post(name: AuthService.sessionExpired, object: nil)
                }
            }
            clear()
            return
        }
        guard !Task.isCancelled, generation == loadGeneration else { return }

        loadTask = Task {
            do {
                async let j = sb.fetchJobs()
                async let c: [Client] = sb.fetch("clients", query: ["order": "name.asc"])
                async let i = sb.fetchInvoices()
                async let r: [RecurringJob] = sb.fetch("recurring_jobs")
                let loaded = try await (j, c, i, r)
                guard !Task.isCancelled, generation == loadGeneration else { return }
                (jobs, clients, invoices, recurringJobs) = loaded
                // Persist to local cache for offline fallback
                persistence?.saveJobs(loaded.0)
                persistence?.saveClients(loaded.1)
                persistence?.saveInvoices(loaded.2)
                // Start real-time polling after successful load
                startPollingIfNeeded(generation: generation)
            } catch is CancellationError {
                return // Silently cancelled — the new loadTask will replace us
            } catch {
                guard !Task.isCancelled, generation == loadGeneration else { return }
                // Offline fallback: if we have cached data, show it with a
                // non-blocking informational message instead of a hard error.
                if let persistence, persistence.hasCachedData() {
                    self.jobs = persistence.loadJobs()
                    self.clients = persistence.loadClients()
                    self.invoices = persistence.loadInvoices()
                    self.error = "Showing cached data — pull to refresh when online"
                } else {
                    self.error = error.localizedDescription
                }
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
        pollingTask?.cancel()
        pollingTask = nil
        jobs = []
        clients = []
        invoices = []
        teamMembers = []
        recurringJobs = []
        isLoading = false
        error = nil
        persistence?.clearAll()
    }

    // MARK: - Jobs

    func createJob(_ job: Job) async throws {
        guard await sb.isConfigured else {
            jobs.append(job)
            return
        }
        do {
            guard let userId = try await sb.getCurrentUserId() else {
                throw DataStoreError.authenticationRequired
            }
            guard let clientId = job.clientId else {
                throw DataStoreError.clientRequired
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
            jobs.append(created)
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

    func updateRouteOrder(_ job: Job, order: Int) async throws {
        var updated = job
        updated.routeOrder = order
        guard await sb.isConfigured else {
            if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
                jobs[idx] = updated
            }
            return
        }
        try await sb.update("jobs", id: job.id, JobRoutePatch(routeOrder: order))
        if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
            jobs[idx] = updated
        }
    }

    func toggleJobStatus(_ job: Job) async throws {
        let nextStatus: Job.JobStatus
        switch job.status {
        case .scheduled: nextStatus = .inProgress
        case .inProgress: nextStatus = .done
        case .done: nextStatus = .scheduled
        case .skipped: nextStatus = .scheduled
        @unknown default: nextStatus = .scheduled
        }
        try await updateJobStatus(job, status: nextStatus)
        // Fire webhook on Done — Zapier handles client email/SMS
        if nextStatus == .done {
            await fireWebhookJobCompleted(job)
        }
        // Send push notification for job completion
        if nextStatus == .done {
            await firePushJobCompleted(job)
        }
    }

    func skipJob(_ job: Job) async throws {
        try await updateJobStatus(job, status: .skipped)
        await fireWebhookJobSkipped(job)
    }
    // MARK: - Webhook Notifications

    private func fireWebhookJobCompleted(_ job: Job) async {
        guard let userId = auth.user?.id else { return }
        await WebhookService.shared.jobCompleted(job, userId: userId)
    }

    private func fireWebhookJobSkipped(_ job: Job) async {
        guard let userId = auth.user?.id else { return }
        await WebhookService.shared.jobSkipped(job, userId: userId)
    }

    // MARK: - Push Notifications

    private func firePushJobCompleted(_ job: Job) async {
        guard let userId = AuthService.shared.user?.id else { return }
        let clientName = job.clients?.name ?? "client"
        await PushNotificationService.shared.sendPush(
            userId: userId,
            title: "Job Completed ✓",
            body: "\(job.title) for \(clientName) marked as done."
        )
    }

    private func firePushRainDelay(_ jobs: [Job], date: String) async {
        guard let userId = AuthService.shared.user?.id else { return }
        let count = jobs.count
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMM d"
        let displayDate = f.string(from: ISO8601DateFormatter().date(from: date + "T00:00:00Z") ?? Date())
        await PushNotificationService.shared.sendPush(
            userId: userId,
            title: "Rain Delay Applied 🌧",
            body: "\(count) job\(count == 1 ? "" : "s") rescheduled to \(displayDate)."
        )
    }

    private var isRainDelaying = false

    func rainDelay(for date: String) async throws {
        guard !isRainDelaying else { return }
        isRainDelaying = true
        defer { isRainDelaying = false }

        let pending = jobs.filter { $0.scheduledDate == date && $0.status == .scheduled }
        guard !pending.isEmpty else { return }
        let tomorrow = nextDay(date)

        // Snapshot original dates for clean rollback
        let originalDates: [UUID: String] = Dictionary(
            uniqueKeysWithValues: pending.map { ($0.id, $0.scheduledDate) }
        )

        // Apply all updates — on ANY failure, re-sync from server instead of
        // manual rollback (which can diverge if local state was already mutated).
        var succeeded: [UUID] = []
        for job in pending {
            do {
                try await updateJobSchedule(job, scheduledDate: tomorrow)
                succeeded.append(job.id)
            } catch {
                // Rollback: re-sync the already-updated jobs to their original dates
                for jobId in succeeded {
                    if let original = originalDates[jobId],
                       let realJob = self.jobs.first(where: { $0.id == jobId }) {
                        try? await updateJobSchedule(realJob, scheduledDate: original)
                    }
                }
                // Re-sync local state from server to prevent divergence
                await loadAll()
                throw error
            }
        }
        // Send push notification after successful rain delay
        await firePushRainDelay(pending, date: tomorrow)
    }

    // MARK: - Recurring Jobs

    func createRecurringJob(_ template: RecurringJob) async throws {
        guard await sb.isConfigured else {
            recurringJobs.append(template)
            return
        }
        do {
            guard let userId = try await sb.getCurrentUserId() else {
                throw DataStoreError.authenticationRequired
            }
            let created: RecurringJob = try await sb.insert("recurring_jobs", RecurringJobInsert(
                id: template.id,
                userId: userId,
                clientId: template.clientId,
                title: template.title,
                scheduledTime: template.scheduledTime,
                durationMinutes: template.durationMinutes,
                assignedTo: template.assignedTo,
                notes: template.notes,
                frequency: template.frequency.rawValue,
                daysOfWeek: template.daysOfWeek,
                isActive: template.isActive,
                startDate: template.startDate
            ))
            recurringJobs.append(created)
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    func deleteRecurringJob(_ template: RecurringJob) async throws {
        guard await sb.isConfigured else {
            recurringJobs.removeAll { $0.id == template.id }
            return
        }
        try await sb.delete("recurring_jobs", id: template.id)
        recurringJobs.removeAll { $0.id == template.id }
    }

    /// Check all active recurring job templates and create Job instances for today
    /// if they match the pattern and no job already exists for that client today.
    func generateJobsFromRecurring() async {
        let todayStr = Self.dateString(from: Date())
        for template in recurringJobs where template.isActive {
            // Skip if a job already exists for this client today
            let alreadyExists = jobs.contains { job in
                job.clientId == template.clientId && job.scheduledDate == todayStr
            }
            guard !alreadyExists else { continue }

            // Check if today matches the recurring pattern
            guard template.matchesDate(Date()) else { continue }

            // Create a job instance from the template
            let job = Job(
                id: UUID(),
                clientId: template.clientId,
                assignedTo: template.assignedTo,
                title: template.title,
                scheduledDate: todayStr,
                scheduledTime: template.scheduledTime,
                durationMinutes: template.durationMinutes,
                status: .scheduled,
                notes: template.notes,
                isRecurring: true,
                recurrenceRule: template.frequency.rawValue
            )
            try? await createJob(job)
        }
    }

    private static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }()
    private static func dateString(from date: Date) -> String {
        dateFmt.string(from: date)
    }

    // MARK: - Clients

    func createClient(_ client: Client) async throws {
        // Free tier limit: max 5 clients. Unknown tier (nil) defaults to
        // allowing — the limit applies on next load when tier is confirmed.
        let freeClientLimit = 5
        let freeTiers: [String?] = ["", "free"]
        let ownerTier = teamMembers.first(where: { $0.role == "owner" })?.tier
        if freeTiers.contains(ownerTier) && clients.count >= freeClientLimit {
            throw DataStoreError.freeTierLimit("Free plan is limited to \(freeClientLimit) clients. Upgrade to Solo or Crew for unlimited.")
        }

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
            clients.append(created)
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    func updateClient(_ client: Client) async throws {
        var updated = client
        if let existing = clients.first(where: { $0.id == client.id }) {
            updated.userId = existing.userId
            updated.createdAt = existing.createdAt
        }

        guard await sb.isConfigured else {
            if let idx = clients.firstIndex(where: { $0.id == client.id }) {
                clients[idx] = updated
            }
            return
        }
        try await sb.update("clients", id: client.id, ClientUpdate(
            name: updated.name,
            address: updated.address,
            phone: updated.phone,
            email: updated.email,
            rate: updated.rate,
            cleaningNotes: updated.cleaningNotes,
            keyCode: updated.keyCode,
            alarmCode: updated.alarmCode,
            petInstructions: updated.petInstructions
        ))
        if let idx = clients.firstIndex(where: { $0.id == client.id }) {
            clients[idx] = updated
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

    // MARK: - Team

    func loadTeamMembers() async {
        guard await sb.isConfigured else {
            // Offline mode: team data not available without network
            return
        }
        do {
            guard let profile = try await sb.fetchProfile() else { return }
            // Owners: their own id is the business_id. Crew: use their business_id.
            let bizId = profile.role == "owner" ? profile.id : profile.businessId
            guard let bizId else { return }
            // Fetch all profiles where id = bizId (owner) OR business_id = bizId (crew)
            let all: [UserProfile] = try await sb.fetch("profiles", query: [
                "or": "(id.eq.\(bizId.uuidString),business_id.eq.\(bizId.uuidString))",
                "order": "business_name.asc"
            ])
            teamMembers = all
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadTeamDashboard(date: String) async -> [TeamDashboardRow] {
        let members = teamMembers
        guard !members.isEmpty else { return [] }

        // Filter jobs for the target date
        let dateJobs = jobs.filter { $0.scheduledDate == date }

        return members.map { member in
            let memberJobs = dateJobs.filter {
                $0.assignedTo == member.id ||
                (member.role == "owner" && $0.assignedTo == nil)
            }
            return TeamDashboardRow(
                id: member.id ?? UUID(),
                name: member.businessName ?? "Unknown",
                role: member.role ?? "crew",
                total: memberJobs.count,
                done: memberJobs.filter { $0.status == .done }.count,
                inProgress: memberJobs.filter { $0.status == .inProgress }.count
            )
        }
    }

    func inviteTeamMember(email: String) async throws {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalizedEmail.isEmpty else { throw DataStoreError.clientRequired }
        guard await sb.isConfigured else {
            // Demo mode: create a fake member
            let newMember = UserProfile(
                id: UUID(),
                businessName: normalizedEmail.split(separator: "@").first.map(String.init) ?? normalizedEmail,
                phone: nil,
                tier: "crew",
                role: "crew",
                businessId: teamMembers.first(where: { $0.role == "owner" })?.id
            )
            teamMembers.append(newMember)
            return
        }
        // Real mode: call edge function or insert via API
        // For now, insert directly into profiles
        struct ProfileInsert: Encodable {
            let id: UUID
            let businessName: String
            let tier: String
            let role: String
            let businessId: UUID?
        }
        guard let currentProfile = try await sb.fetchProfile(),
              let ownerId = currentProfile.role == "owner" ? currentProfile.id : currentProfile.businessId else {
            throw DataStoreError.authenticationRequired
        }
        let newId = UUID()
        let member: UserProfile = try await sb.insert("profiles", ProfileInsert(
            id: newId,
            businessName: normalizedEmail.split(separator: "@").first.map(String.init) ?? normalizedEmail,
            tier: "crew",
            role: "crew",
            businessId: ownerId
        ))
        teamMembers.append(member)
    }

    func removeTeamMember(_ member: UserProfile) async throws {
        guard let memberId = member.id else { return }
        guard await sb.isConfigured else {
            teamMembers.removeAll { $0.id == memberId }
            // Unassign jobs from removed member
            for idx in jobs.indices where jobs[idx].assignedTo == memberId {
                jobs[idx].assignedTo = nil
            }
            return
        }
        try await sb.delete("profiles", id: memberId)
        teamMembers.removeAll { $0.id == memberId }
        // Sync unassigned jobs to server
        for idx in jobs.indices where jobs[idx].assignedTo == memberId {
            var updated = jobs[idx]
            updated.assignedTo = nil
            try? await sb.update("jobs", id: updated.id, JobAssignedPatch(assignedTo: nil))
            jobs[idx] = updated
        }
    }

    // MARK: - Helpers

    private func startPollingIfNeeded(generation: Int) {
        guard generation == loadGeneration else { return }
        pollingTask?.cancel()
        pollingTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                guard !Task.isCancelled, await sb.isAuthenticated else { continue }
                do {
                    let latest = try await sb.fetchJobs()
                    guard !Task.isCancelled, self.loadGeneration == generation else { return }
                    if latest.map(\.id) != self.jobs.map(\.id) || latest != self.jobs {
                        self.jobs = latest
                    }
                } catch {
                    // Silently skip — next tick will retry
                }
            }
        }
    }

    private func nextDay(_ date: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: date) else { return date }
        guard let next = Calendar.current.date(byAdding: .day, value: 1, to: d) else { return date }
        return f.string(from: next)
    }
}

enum DataStoreError: LocalizedError {
    case authenticationRequired
    case clientRequired
    case freeTierLimit(String)

    var errorDescription: String? {
        switch self {
        case .authenticationRequired:
            "Please sign in before saving."
        case .clientRequired:
            "Select a client before saving the job."
        case .freeTierLimit(let message):
            message
        }
    }
}

// MARK: - Demo Data

struct DemoData {
    static let demoOwnerId = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
    static let demoCrewJake = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    static let demoCrewMaria = UUID(uuidString: "00000000-0000-0000-0000-000000000003")!

    let teamMembers: [UserProfile] = [
        UserProfile(id: DemoData.demoOwnerId, businessName: "Green Thumb Lawn Care", phone: "405-555-0100", tier: "crew", role: "owner", businessId: nil),
        UserProfile(id: DemoData.demoCrewJake, businessName: "Jake Torres", phone: "405-555-0201", tier: "crew", role: "crew", businessId: DemoData.demoOwnerId),
        UserProfile(id: DemoData.demoCrewMaria, businessName: "Maria Santos", phone: "405-555-0202", tier: "crew", role: "crew", businessId: DemoData.demoOwnerId),
    ]

    let jobs: [Job] = [
        Job(id: UUID(), assignedTo: DemoData.demoOwnerId, title: "Weekly Mow", scheduledDate: DemoData.today(), scheduledTime: "08:00", status: .done, routeOrder: 0, clients: Job.ClientRef(id: UUID(), name: "Smith Residence", address: "123 Main St", rate: 45)),
        Job(id: UUID(), assignedTo: DemoData.demoCrewJake, title: "Trim + Mow", scheduledDate: DemoData.today(), scheduledTime: "09:30", status: .inProgress, routeOrder: 1, clients: Job.ClientRef(id: UUID(), name: "Johnson Home", address: "456 Oak Ave", rate: 65)),
        Job(id: UUID(), assignedTo: DemoData.demoCrewMaria, title: "Quick Mow", scheduledDate: DemoData.today(), scheduledTime: "11:00", status: .scheduled, routeOrder: 2, clients: Job.ClientRef(id: UUID(), name: "Williams Estate", address: "789 Pine Rd", rate: 80)),
        Job(id: UUID(), title: "Biweekly Service", scheduledDate: DemoData.today(), scheduledTime: "13:00", status: .scheduled, routeOrder: 3, clients: Job.ClientRef(id: UUID(), name: "Brown Property", address: "101 Elm St", rate: 45)),
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
