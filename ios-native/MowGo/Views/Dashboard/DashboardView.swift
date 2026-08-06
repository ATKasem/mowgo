//
//  DashboardView.swift
//  MowGo
//
//  Owner dashboard with stat cards, quick actions, team progress, and today preview.
//  Crew see limited view.
//

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @Binding var selectedTab: Int
    @State private var showAddJob = false
    @State private var showAddClient = false
    @State private var showInviteCrew = false
    @State private var inviteEmail = ""
    @State private var inviteError: String?
    @State private var isInviting = false
    @State private var crewRemovalError: String?
    @State private var memberToRemove: UserProfile?
    @State private var showRemoveConfirm = false
    @State private var animateCards = false

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = Calendar(identifier: .gregorian); return f
    }()

    private static let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter(); f.numberStyle = .currency; f.currencySymbol = "$"; return f
    }()

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMMM d"; return f
    }()

    private let ownerRole = "owner"

    // MARK: - Stats

    private var today: String {
        Self.dateFormatter.string(from: Date())
    }

    private func localDate(_ offsetDays: Int) -> String {
        guard let d = Calendar.current.date(byAdding: .day, value: offsetDays, to: Date()) else {
            return today
        }
        return Self.dateFormatter.string(from: d)
    }

    private var todayJobs: [Job] {
        store.jobs.filter { $0.scheduledDate == today }
    }

    private var todayDone: [Job] {
        todayJobs.filter { $0.status == .done }
    }

    private var todayRevenue: Decimal {
        todayDone.reduce(0) { $0 + ($1.clientRate ?? 0) }
    }

    private var outstanding: Decimal {
        store.invoices
            .filter { $0.status == .unpaid }
            .reduce(0) { $0 + $1.amount }
    }

    private var weeklyJobs: [Job] {
        let weekAgo = localDate(-6)
        return store.jobs.filter { $0.scheduledDate >= weekAgo && $0.scheduledDate <= today }
    }

    private var weeklyDone: [Job] {
        weeklyJobs.filter { $0.status == .done }
    }

    private var weeklyRevenue: Decimal {
        weeklyDone.reduce(0) { $0 + ($1.clientRate ?? 0) }
    }

    private var activeClients: Int {
        let thirtyDaysAgo = localDate(-29)
        let ids = Set(store.jobs
            .filter { $0.clientId != nil && $0.scheduledDate >= thirtyDaysAgo && $0.scheduledDate <= today }
            .compactMap { $0.clientId })
        return ids.count
    }

    private var recurringClients: Int {
        let ids = Set(store.jobs
            .filter { $0.clientId != nil && $0.recurrenceRule != nil && $0.recurrenceRule != "none" && $0.scheduledDate >= today }
            .compactMap { $0.clientId })
        return ids.count
    }

    private var isOwner: Bool {
        auth.user?.role == ownerRole
    }

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                headerSection
                statCardsSection
                if isOwner { quickActionsSection }
                todayPreviewSection
                if isOwner && !teamProgressRows.isEmpty { teamProgressSection }
                if isOwner { crewRosterSection }
            }
            .padding(16)
        }
        .background(theme.background)
        .sheet(isPresented: $showAddJob) {
            NewJobFormView(date: today, teamMembers: store.teamMembers)
                .environmentObject(store)
                .environmentObject(auth)
        }
        .sheet(isPresented: $showAddClient) {
            NewClientFormView()
                .environmentObject(store)
                .environmentObject(auth)
        }
        .onAppear {
            if isOwner {
                Task { await store.loadTeamMembers() }
            }
            withAnimation(.easeOut(duration: 0.4).delay(0.3)) { animateCards = true }
        }
        .sheet(isPresented: $showInviteCrew) {
            inviteCrewSheet
        }
        .alert("Remove Crew Member", isPresented: $showRemoveConfirm) {
            Button("Remove", role: .destructive) {
                guard let member = memberToRemove else { return }
                // Trust boundary: RLS must also enforce owner-only deletion server-side.
                Task {
                    do {
                        try await store.removeTeamMember(member)
                    } catch {
                        crewRemovalError = error.localizedDescription
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("\(memberToRemove?.businessName ?? NSLocalizedString("This member", comment: "Crew removal confirmation fallback when member has no name")) will be removed from your team. Their jobs will be unassigned.")
        }
        .alert("Could Not Remove Crew Member", isPresented: Binding(
            get: { crewRemovalError != nil },
            set: { if !$0 { crewRemovalError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(crewRemovalError ?? NSLocalizedString("An unknown error occurred.", comment: "Crew member removal failure fallback message"))
        }
    }

    // MARK: - Sections

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Dashboard")
                    .font(.title2.weight(.bold))
                    .foregroundColor(theme.textPrimary)
                Text(dateDisplay)
                    .font(.caption)
                    .foregroundColor(theme.textMuted)
            }
            Spacer()
        }
    }

    private var dateDisplay: String {
        Self.displayFormatter.string(from: Date())
    }

    private var statCardsSection: some View {
        let columns = [GridItem(.adaptive(minimum: 150))]
        return Group {
            if isOwner {
                LazyVGrid(columns: columns, spacing: 12) {
                    DashboardCard(
                        icon: "dollarsign.circle.fill", color: .green,
                        value: formatCurrency(todayRevenue), label: "Revenue Today",
                        sub: todayJobs.isEmpty ? "No jobs today" : "\(todayDone.count)/\(todayJobs.count) jobs done"
                    ).onTapGesture { selectedTab = 1 }
                    DashboardCard(
                        icon: "doc.text.fill", color: .orange,
                        value: formatCurrency(outstanding), label: "Outstanding",
                        sub: "Unpaid invoices"
                    ).onTapGesture { selectedTab = 3 }
                    DashboardCard(
                        icon: "checkmark.circle.fill", color: .purple,
                        value: "\(weeklyJobs.count)", label: "Jobs This Week",
                        sub: "\(formatCurrency(weeklyRevenue)) revenue"
                    ).onTapGesture { selectedTab = 1 }
                    DashboardCard(
                        icon: "person.2.fill", color: .blue,
                        value: "\(activeClients)", label: "Active Clients",
                        sub: "\(recurringClients) recurring"
                    ).onTapGesture { selectedTab = 2 }
                }
                .scaleEffect(animateCards ? 1 : 0.95)
                .opacity(animateCards ? 1 : 0)
            } else {
                LazyVGrid(columns: columns, spacing: 12) {
                    DashboardCard(
                        icon: "checkmark.circle.fill", color: .green,
                        value: "\(weeklyJobs.count)", label: "Jobs This Week",
                        sub: "\(weeklyDone.count) done"
                    ).onTapGesture { selectedTab = 1 }
                    DashboardCard(
                        icon: "person.2.fill", color: .blue,
                        value: "\(activeClients)", label: "Active Clients",
                        sub: nil
                    ).onTapGesture { selectedTab = 2 }
                }
            }
        }
    }

    private var quickActionsSection: some View {
        HStack(spacing: 12) {
            Button { showAddJob = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(MowGoTheme.deepGreen)
                    Text("Add Job")
                        .foregroundColor(theme.textPrimary)
                }
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: .black.opacity(0.06), radius: 6, y: 2)
            }
            Button { showAddClient = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "person.badge.plus")
                        .foregroundColor(MowGoTheme.info)
                    Text("Add Client")
                        .foregroundColor(theme.textPrimary)
                }
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: .black.opacity(0.06), radius: 6, y: 2)
            }
        }
    }

    private var todayPreviewSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Today")
                    .font(.headline)
                    .foregroundColor(theme.textPrimary)
                Spacer()
                if !todayJobs.isEmpty {
                    Button("See all") { selectedTab = 1 }
                        .font(.caption)
                        .foregroundColor(MowGoTheme.deepGreen)
                }
            }

            if todayJobs.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 32))
                        .foregroundColor(theme.surfaceElevated)
                    Text("No jobs scheduled for today")
                        .font(.subheadline)
                        .foregroundColor(theme.textMuted)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 20)
            } else {
                ForEach(todayJobs.sorted { a, b in
                    (a.routeOrder ?? Int.max) < (b.routeOrder ?? Int.max)
                }.prefix(3)) { job in
                    todayJobRow(job)
                }
            }
        }
        .padding(16)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Team Progress

    private var teamProgressRows: [(label: String, done: Int, inProgress: Int, total: Int, color: Color)] {
        var rows: [(String, Int, Int, Int, Color)] = []
        for member in store.teamMembers {
            let jobs = todayJobs.filter { $0.assignedTo == member.id }
            guard !jobs.isEmpty else { continue }
            let done = jobs.filter { $0.status == .done }.count
            let ip = jobs.filter { $0.status == .inProgress }.count
            rows.append((member.businessName ?? "Crew", done, ip, jobs.count, MowGoTheme.deepGreen))
        }
        let unassigned = todayJobs.filter { $0.assignedTo == nil }
        if !unassigned.isEmpty {
            let done = unassigned.filter { $0.status == .done }.count
            let ip = unassigned.filter { $0.status == .inProgress }.count
            rows.append(("Unassigned", done, ip, unassigned.count, .gray))
        }
        return rows
    }

    private var teamProgressSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Team")
                .font(.headline)
                .foregroundColor(theme.textPrimary)

            ForEach(teamProgressRows.indices, id: \.self) { i in
                teamProgressRow(teamProgressRows[i])
            }
        }
        .padding(16)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func teamProgressRow(_ row: (label: String, done: Int, inProgress: Int, total: Int, color: Color)) -> some View {
        let completed = row.done + row.inProgress
        let pct = row.total > 0 ? Double(completed) / Double(row.total) : 0

        return VStack(spacing: 6) {
            HStack {
                Circle()
                    .fill(row.color)
                    .frame(width: 8, height: 8)
                Text(row.label)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(theme.textPrimary)
                Spacer()
                Text("\(completed)/\(row.total)")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(theme.textSecondary)
                if row.done > 0 {
                    Text("✓ Done")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(MowGoTheme.success)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(MowGoTheme.success.opacity(0.12))
                        .clipShape(Capsule())
                }
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(theme.surfaceElevated)
                        .frame(height: 6)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(row.color)
                        .frame(width: geo.size.width * pct, height: 6)
                }
            }
            .frame(height: 6)
        }
    }

    // MARK: - Crew Roster

    private var crewRosterSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Crew")
                    .font(.headline)
                    .foregroundColor(theme.textPrimary)
                Spacer()
                Button { showInviteCrew = true } label: {
                    Label("Invite", systemImage: "person.badge.plus")
                        .font(.caption.weight(.semibold))
                }
                .foregroundColor(MowGoTheme.deepGreen)
            }

            if store.teamMembers.isEmpty {
                Text("No crew members yet")
                    .font(.subheadline)
                    .foregroundColor(theme.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            } else {
                ForEach(store.teamMembers) { member in
                    crewMemberRow(member)
                }
            }
        }
        .padding(16)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func crewMemberRow(_ member: UserProfile) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(member.role == "owner" ? MowGoTheme.deepGreen : MowGoTheme.info)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(member.businessName ?? "Crew Member")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(theme.textPrimary)
                Text(member.role == "owner" ? "Owner" : "Crew")
                    .font(.caption)
                    .foregroundColor(theme.textMuted)
            }

            Spacer()

            if member.role == "crew" {
                Button {
                    memberToRemove = member
                    showRemoveConfirm = true
                } label: {
                    Image(systemName: "trash")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Invite Sheet

    private var inviteCrewSheet: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Invite a crew member to join your team.")
                    .font(.subheadline)
                    .foregroundColor(theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 20)

                TextField("Email address", text: $inviteEmail)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .padding(12)
                    .background(theme.surfaceElevated)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal, 16)

                if let error = inviteError {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                }

                Button {
                    Task {
                        guard !isInviting else { return }
                        isInviting = true
                        inviteError = nil
                        do {
                            try await store.inviteTeamMember(email: inviteEmail)
                            inviteEmail = ""
                            showInviteCrew = false
                        } catch {
                            inviteError = error.localizedDescription
                        }
                        isInviting = false
                    }
                } label: {
                    HStack {
                        if isInviting {
                            ProgressView().tint(.white)
                        }
                        Text("Send Invite")
                    }
                    .font(.headline.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(inviteEmail.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray : MowGoTheme.deepGreen)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(inviteEmail.trimmingCharacters(in: .whitespaces).isEmpty || isInviting)
                .padding(.horizontal, 16)

                Spacer()
            }
            .background(theme.background)
            .navigationTitle("Invite Crew")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showInviteCrew = false }
                }
            }
            .onDisappear {
                inviteEmail = ""
                inviteError = nil
            }
        }
    }

    // MARK: - Today Job Row

    private func todayJobRow(_ job: Job) -> some View {
        let name = job.clientName ?? job.title
        let initial = String(name.prefix(1)).uppercased()
        let statusColor: Color = job.status == .done ? MowGoTheme.success : job.status == .inProgress ? Color.cyan : MowGoTheme.warning

        return HStack(spacing: 10) {
            Circle()
                .fill(theme.surfaceElevated)
                .frame(width: 36, height: 36)
                .overlay(
                    Text(initial.isEmpty ? "?" : initial)
                        .font(.headline.weight(.semibold))
                        .foregroundColor(MowGoTheme.deepGreen)
                )
                .overlay(
                    Circle()
                        .stroke(statusColor, lineWidth: 2)
                )

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(job.clientName ?? job.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(theme.textPrimary)
                    // Tag badges
                    if let tags = clientTags(for: job), !tags.isEmpty {
                        ForEach(Array(Set(tags.prefix(2))), id: \.self) { tag in
                            Text(tagLabel(tag))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(tagColor(tag))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(tagColor(tag).opacity(0.12))
                                .clipShape(Capsule())
                        }
                    }
                }
                if let time = job.scheduledTime {
                    Text(time)
                        .font(.caption)
                        .foregroundColor(theme.textMuted)
                }
            }

            Spacer()

            Text(job.status.label)
                .font(.caption2.weight(.medium))
                .foregroundColor(job.status == .done ? .green : job.status == .inProgress ? .cyan : .orange)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    job.status == .done ? Color.green.opacity(0.12) :
                    job.status == .inProgress ? Color.cyan.opacity(0.12) :
                    Color.orange.opacity(0.12)
                )
                .clipShape(Capsule())
        }
        .padding(.vertical, 4)
    }

    private func clientTags(for job: Job) -> [String]? {
        guard let clientId = job.clientId else { return nil }
        return store.clients.first(where: { $0.id == clientId })?.tags
    }

    private func tagLabel(_ tag: String) -> String {
        switch tag {
        case "do-not-service": "DNS"
        case "late-payer": "Late"
        case "vip": "VIP"
        case "needs-quote": "Quote"
        default: tag
        }
    }

    private func tagColor(_ tag: String) -> Color {
        switch tag {
        case "do-not-service": .red
        case "late-payer": .orange
        case "vip": .orange
        case "needs-quote": .purple
        default: .gray
        }
    }

    // MARK: - Helpers

    private func formatCurrency(_ amount: Decimal) -> String {
        return Self.currencyFormatter.string(from: amount as NSDecimalNumber) ?? "$0"
    }
}

// MARK: - Dashboard Card

private struct DashboardCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let icon: String
    let color: Color
    let value: String
    let label: LocalizedStringKey
    let sub: LocalizedStringKey?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
                .frame(width: 40, height: 40)
                .background(color.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 12))

            Text(value)
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(theme.textPrimary)

            Text(label)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(theme.textSecondary)

            if let sub = sub {
                Text(sub)
                    .font(.caption)
                    .foregroundColor(theme.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(theme.surface)
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 4)
                .fill(color)
                .frame(width: 4)
                .padding(.leading, 1)
                .padding(.vertical, 10)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }
}
