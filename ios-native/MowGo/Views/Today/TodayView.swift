//
//  TodayView.swift
//  MowGo
//
//  Single-screen dashboard: compact header, slim calendar strip,
//  2×2 stats, rain delay pill, and jobs visible above the fold.
//

import SwiftUI

struct TodayView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @Binding var selectedTab: Int
    @State private var showingRainConfirm = false
    @State private var showingActionSheet = false
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

    // MARK: - Stats

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
                        VStack(spacing: 12) {
                            // Compact header
                            headerRow

                            // Slim date strip
                            dateStrip

                            // 2×2 stats grid
                            statsGrid

                            // Crew filter
                            crewFilterBar

                            // Rain delay pill (today only)
                            rainDelayPill

                            // Error
                            if let err = operationError {
                                Text(err).font(.caption).foregroundColor(.red)
                                    .padding(.horizontal, 4)
                            }

                            // Job list — visible above the fold
                            if todayJobs.isEmpty {
                                emptyState
                            } else {
                                LazyVStack(spacing: 8) {
                                    ForEach(todayJobs) { job in
                                        JobCardView(job: job, teamMembers: store.teamMembers,
                                            showDate: !isToday,
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
                                .padding(.horizontal, 4)
                            }
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
                        showingActionSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.title3.weight(.semibold))
                            .foregroundColor(MowGoTheme.deepGreen)
                    }
                    .accessibilityLabel("Actions")
                }
            }
            .confirmationDialog("Actions", isPresented: $showingActionSheet, titleVisibility: .visible) {
                Button("New Job") {
                    showingAddJob = true
                }
                Button("Add Client") {
                    showingAddClient = true
                }
                Button("View Invoices") {
                    selectedTab = 2
                }
                Button("Cancel", role: .cancel) {}
            }
            .alert("Move \(scheduledCount) jobs to tomorrow?", isPresented: $showingRainConfirm) {
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

    // MARK: - Header (compact)

    private var headerRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                if isToday {
                    Text("Good \(greeting) 👋")
                        .font(.subheadline)
                        .foregroundColor(theme.textMuted)
                }
                Text("Today")
                    .font(.title2.weight(.bold))
                    .foregroundColor(theme.textPrimary)
                    .dynamicTypeSize(...DynamicTypeSize.accessibility3)
            }
            Spacer()
        }
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 0..<12: return "morning"
        case 12..<17: return "afternoon"
        default: return "evening"
        }
    }

    // MARK: - Date Strip (slim)

    private var dateStrip: some View {
        HStack(spacing: 12) {
            Button { shiftDate(-1) } label: {
                Image(systemName: "chevron.left")
                    .font(.caption)
                    .foregroundColor(theme.textMuted)
            }
            .accessibilityLabel("Previous day")

            Text(selectedDate.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                .font(.subheadline.weight(.semibold))
                .foregroundColor(theme.textPrimary)

            Button { shiftDate(1) } label: {
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(theme.textMuted)
            }
            .accessibilityLabel("Next day")

            Spacer()

            Button("Today") { selectedDate = Date() }
                .font(.caption2.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(isToday ? MowGoTheme.deepGreen : theme.surfaceElevated)
                .foregroundColor(isToday ? MowGoTheme.onAccent : theme.textPrimary)
                .cornerRadius(8)
        }
        .frame(height: 24)
    }

    // MARK: - Stats Grid (2×2 compact)

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            StatCard(title: "Scheduled", value: "\(scheduledCount)", icon: "list.clipboard", color: "f59e0b")
            StatCard(title: "Clients", value: "\(totalClients)", icon: "person.2", color: "3b82f6")
            StatCard(title: "Unpaid", value: "\(unpaidCount)", icon: "doc.text", color: "ef4444")
            StatCard(
                title: "Revenue",
                value: (weeklyRevenue / 100).formatted(.currency(code: "USD")),
                icon: "dollarsign.circle",
                color: "16a34a"
            )
        }
    }

    // MARK: - Crew Filter

    private var crewFilterBar: some View {
        let canManageCrew = auth.user?.tier == "crew"
        return Group {
            if canManageCrew && store.teamMembers.count >= 2 {
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

    // MARK: - Rain Delay Pill

    private var rainDelayPill: some View {
        Group {
            if isToday {
                Button { showingRainConfirm = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "cloud.rain.fill")
                            .font(.caption)
                        Text("Rain Delay")
                            .font(.caption.weight(.medium))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(MowGoTheme.rainBlue)
                    .foregroundColor(MowGoTheme.onAccent)
                    .cornerRadius(20)
                }
                .disabled(scheduledCount == 0)
                .opacity(scheduledCount == 0 ? 0.5 : 1)
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "leaf")
                .font(.system(size: 32))
                .foregroundColor(theme.surfaceElevated)
            Text("No jobs scheduled")
                .font(.subheadline.weight(.medium))
                .foregroundColor(theme.textPrimary)
            Text("Tap + to add your first job")
                .font(.caption)
                .foregroundColor(theme.textMuted)
        }
        .padding(.top, 40)
    }

    // MARK: - Helpers

    private var isToday: Bool { Calendar.current.isDateInToday(selectedDate) }

    private func shiftDate(_ days: Int) {
        if let d = Calendar.current.date(byAdding: .day, value: days, to: selectedDate) {
            selectedDate = d
        }
    }
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
