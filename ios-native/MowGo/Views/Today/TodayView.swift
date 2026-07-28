//
//  TodayView.swift
//  MowGo
//
//  Combined dashboard + today's jobs: greeting, stats, calendar,
//  date navigation, rain delay, crew filter, and quick actions.
//

import SwiftUI

struct TodayView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @Binding var selectedTab: Int
    @State private var showingRainConfirm = false
    @State private var showingAddJob = false
    @State private var showingAddClient = false
    @State private var selectedDate = Date()
    @State private var operationError: String?
    @State private var selectedCrewFilter: UUID? = nil

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    static func todayString() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }()

    private var dateString: String { Self.dateFmt.string(from: selectedDate) }

    private var todayJobs: [Job] {
        store.jobs.filter { job in
            guard job.scheduledDate == dateString else { return false }
            if let filterId = selectedCrewFilter {
                return job.assignedTo == filterId
            }
            return true
        }
    }

    private var scheduledCount: Int {
        todayJobs.filter { $0.status == .scheduled }.count
    }

    // MARK: - HomeView-derived stats

    private var totalClients: Int { store.clients.count }
    private var unpaidCount: Int { store.invoices.filter { $0.status == .unpaid }.count }
    private var weeklyRevenue: Decimal {
        let cal = Calendar.current
        return store.invoices
            .filter { $0.status == .paid }
            .compactMap { inv -> Decimal? in
                guard let paid = inv.paidAt else { return nil }
                let f = ISO8601DateFormatter()
                guard let d = f.date(from: paid) else { return nil }
                return cal.isDate(d, equalTo: Date(), toGranularity: .weekOfYear)
                    ? Decimal(inv.amountCents) : nil
            }
            .reduce(0, +)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(MowGoTheme.deepGreen)
                } else {
                    ScrollView {
                        VStack(spacing: 16) {
                            // Greeting
                            greetingSection

                            // Dashboard stats grid
                            statsGrid

                            // Date navigation
                            dateHeader

                            // Daily stats bar
                            statsBar

                            // Crew filter
                            crewFilterBar

                            // Weekly calendar
                            weeklyCalendar

                            // Error
                            if let err = operationError {
                                Text(err).font(.caption).foregroundColor(.red)
                                    .padding(.horizontal, 8)
                            }

                            // Rain delay
                            rainDelayButton

                            // Today's jobs
                            if todayJobs.isEmpty {
                                emptyState
                            } else {
                                LazyVStack(spacing: 8) {
                                    ForEach(todayJobs) { job in
                                        JobCardView(job: job, teamMembers: store.teamMembers,
                                            onToggle: {
                                                Task {
                                                    do {
                                                        operationError = nil
                                                        try await store.toggleJobStatus(job)
                                                    } catch {
                                                        operationError = error.localizedDescription
                                                    }
                                                }
                                            },
                                            onSkip: {
                                                Task {
                                                    do {
                                                        operationError = nil
                                                        try await store.skipJob(job)
                                                    } catch {
                                                        operationError = error.localizedDescription
                                                    }
                                                }
                                            }
                                        )
                                    }
                                }
                                .padding(.horizontal, 16)
                            }

                            // Quick actions
                            quickActions
                        }
                        .padding(.horizontal, 16)
                    }
                    .refreshable {
                        await store.loadAll()
                    }
                }
            }
            .navigationTitle("Today")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        showingAddJob = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(MowGoTheme.deepGreen)
                    }
                    .accessibilityLabel("Add job")
                }
            }
            .alert("Move \\(scheduledCount) jobs to tomorrow?", isPresented: $showingRainConfirm) {
                Button("Yes, rain delay", role: .destructive) {
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                    Task {
                        do {
                            operationError = nil
                            try await store.rainDelay(for: dateString)
                        } catch {
                            operationError = error.localizedDescription
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("All scheduled jobs for today will be rescheduled.")
            }
            .sheet(isPresented: $showingAddJob) {
                NewJobFormView(date: dateString, teamMembers: store.teamMembers)
            }
            .sheet(isPresented: $showingAddClient) {
                NewClientFormView()
            }
            .onAppear {
                if auth.user?.tier == "crew" {
                    Task { await store.loadTeamMembers() }
                }
            }
        }
    }

    // MARK: - Greeting

    private var greetingSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.subheadline).foregroundColor(theme.textMuted)
            Text("Good \(greeting) 👋")
                .font(.title2.weight(.bold)).foregroundColor(theme.textPrimary)
                .dynamicTypeSize(...DynamicTypeSize.accessibility3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 0..<12: return "morning"
        case 12..<17: return "afternoon"
        default: return "evening"
        }
    }

    // MARK: - Stats Grid (from HomeView)

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(title: "Scheduled", value: "\(scheduledCount)", icon: "list.clipboard", color: "f59e0b")
            StatCard(title: "Clients", value: "\(totalClients)", icon: "person.2", color: "3b82f6")
            StatCard(title: "Unpaid", value: "\(unpaidCount)", icon: "doc.text", color: "ef4444")
            StatCard(
                title: "This Week",
                value: (weeklyRevenue / 100).formatted(.currency(code: "USD")),
                icon: "dollarsign.circle",
                color: "16a34a"
            )
        }
    }

    // MARK: - Date Header

    private var dateHeader: some View {
        VStack(spacing: 4) {
            Text(selectedDate.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.title3.weight(.semibold)).foregroundColor(theme.textPrimary)
                .dynamicTypeSize(...DynamicTypeSize.accessibility2)
            HStack(spacing: 16) {
                Button { shiftDate(-1) } label: {
                    Image(systemName: "chevron.left").foregroundColor(theme.textMuted)
                }
                .accessibilityLabel("Previous day")
                Button("Today") { selectedDate = Date() }
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 12).padding(.vertical, 4)
                    .background(isToday ? MowGoTheme.deepGreen : theme.surfaceElevated)
                    .foregroundColor(isToday ? MowGoTheme.onAccent : theme.textPrimary).cornerRadius(8)
                Button { shiftDate(1) } label: {
                    Image(systemName: "chevron.right").foregroundColor(theme.textMuted)
                }
                .accessibilityLabel("Next day")
            }
        }
        .padding(.vertical, 12)
    }

    // MARK: - Stats Bar

    private var statsBar: some View {
        HStack(spacing: 12) {
            StatChip(label: "Scheduled", count: todayJobs.filter { $0.status == .scheduled }.count, color: "f59e0b")
            StatChip(label: "Done", count: todayJobs.filter { $0.status == .done }.count, color: "16a34a")
            StatChip(label: "Revenue", count: nil, amount: todayJobs.filter { $0.status == .done }.compactMap { $0.clientRate }.reduce(0, +), color: "3b82f6")
        }
    }

    // MARK: - Crew Filter

    private var crewFilterBar: some View {
        let canManageCrew = auth.user?.tier == "crew"
        return Group {
            if canManageCrew && store.teamMembers.count >= 2 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        CrewFilterChip(
                            label: "All",
                            isSelected: selectedCrewFilter == nil,
                            color: MowGoTheme.success
                        ) {
                            selectedCrewFilter = nil
                        }
                        ForEach(Array(store.teamMembers.enumerated()), id: \.element.id) { index, member in
                            CrewFilterChip(
                                label: member.businessName?.components(separatedBy: " ").first ?? "Unknown",
                                isSelected: selectedCrewFilter == member.id,
                                color: crewChipColors[index % crewChipColors.count]
                            ) {
                                selectedCrewFilter = member.id
                            }
                        }
                    }
                }
                .padding(.bottom, 4)
            }
        }
    }

    private let crewChipColors = [
        MowGoTheme.success,
        MowGoTheme.info,
        MowGoTheme.warning,
        MowGoTheme.danger,
        MowGoTheme.brandGreen
    ]

    // MARK: - Weekly Calendar

    private var weeklyCalendar: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("This Week").font(.headline).foregroundColor(theme.textPrimary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(weekDays, id: \.self) { day in
                        VStack(spacing: 4) {
                            Text(day.label).font(.caption2).foregroundColor(theme.textMuted)
                            Text("\(day.day)").font(.callout.weight(.semibold))
                                .foregroundColor(day.isToday ? MowGoTheme.onAccent : theme.textSecondary)
                            Circle()
                                .fill(day.hasJobs ? MowGoTheme.deepGreen : Color.clear)
                                .frame(width: 6, height: 6)
                                .accessibilityHidden(!day.hasJobs)
                        }
                        .frame(width: 44).padding(.vertical, 8)
                        .background(day.isToday ? MowGoTheme.deepGreen.opacity(0.2) : theme.surface)
                        .cornerRadius(10)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("\(day.label) \(day.day), \(day.jobCount) job\(day.jobCount == 1 ? "" : "s")")
                    }
                }
            }
        }
        .padding(16).background(theme.surface).cornerRadius(16)
    }

    // MARK: - Rain Delay

    private var rainDelayButton: some View {
        Button { showingRainConfirm = true } label: {
            HStack {
                Image(systemName: "cloud.rain.fill")
                Text("Rain Delay").fontWeight(.medium)
            }
            .frame(maxWidth: .infinity).padding(12)
            .background(MowGoTheme.rainBlue).foregroundColor(MowGoTheme.onAccent).cornerRadius(12)
        }
        .disabled(scheduledCount == 0).opacity(scheduledCount == 0 ? 0.5 : 1)
    }

    // MARK: - Quick Actions

    private var quickActions: some View {
        VStack(spacing: 8) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                showingAddJob = true
            } label: {
                QuickActionRow(icon: "plus.circle", label: "New Job", color: "16a34a")
            }
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                showingAddClient = true
            } label: {
                QuickActionRow(icon: "person.badge.plus", label: "Add Client", color: "3b82f6")
            }
            Button {
                selectedTab = 2
            } label: {
                QuickActionRow(icon: "doc.badge.plus", label: "View Invoices", color: "f59e0b")
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "leaf").font(.system(size: 40)).foregroundColor(theme.surfaceElevated)
            Text("No jobs scheduled").font(.headline).foregroundColor(theme.textPrimary)
            Text("Tap + to add your first job").font(.subheadline).foregroundColor(theme.textMuted)
        }
        .padding(.top, 60)
    }

    // MARK: - Helpers

    private var isToday: Bool { Calendar.current.isDateInToday(selectedDate) }

    private func shiftDate(_ days: Int) {
        if let d = Calendar.current.date(byAdding: .day, value: days, to: selectedDate) {
            selectedDate = d
        }
    }

    // WeekDay model and data (from HomeView)
    private struct WeekDay: Hashable {
        let label: String; let day: Int; let isToday: Bool; let hasJobs: Bool; let jobCount: Int
    }

    private var weekDays: [WeekDay] {
        let cal = Calendar.current; let now = Date()
        let fmt = TodayView.dayFormatter
        return (-3...3).compactMap { offset in
            guard let d = cal.date(byAdding: .day, value: offset, to: now) else { return nil }
            let dateStr = fmt.string(from: d)
            let count = store.jobs.filter { $0.scheduledDate == dateStr }.count
            return WeekDay(
                label: d.formatted(.dateTime.weekday(.abbreviated)),
                day: cal.component(.day, from: d),
                isToday: offset == 0,
                hasJobs: count > 0,
                jobCount: count
            )
        }
    }
}

private extension TodayView {
    static let dayFormatter: DateFormatter = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f }()
}

// MARK: - Crew Filter Chip

struct CrewFilterChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let label: String
    let isSelected: Bool
    let color: Color
    let action: () -> Void

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundColor(isSelected ? MowGoTheme.onAccent : theme.textMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? color : theme.surfaceElevated)
                .cornerRadius(16)
        }
        .buttonStyle(.plain)
    }
}
