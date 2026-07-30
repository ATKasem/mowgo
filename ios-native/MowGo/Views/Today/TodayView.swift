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
    @State private var routeMode = false
    @State private var notificationMessage: String?
    @State private var showNotificationBanner = false
    @State private var calendarMode: CalendarMode = .week

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    private static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }()

    private static let isoFormatter: ISO8601DateFormatter = ISO8601DateFormatter()

    private var dateString: String { Self.dateFmt.string(from: selectedDate) }

    private var todayJobs: [Job] {
        var filtered = store.jobs.filter { job in
            guard job.scheduledDate == dateString else { return false }
            if let filterId = selectedCrewFilter {
                return job.assignedTo == filterId
            }
            return true
        }
        if routeMode {
            filtered.sort { a, b in
                let orderA = a.routeOrder ?? Int.max
                let orderB = b.routeOrder ?? Int.max
                return orderA < orderB
            }
        }
        return filtered
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
                guard let d = Self.isoFormatter.date(from: paid) else { return nil }
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

                            // Week/month calendar
                            calendarGrid

                            // 2×2 stats grid
                            statsGrid

                            // Crew filter
                            crewFilterBar

                            // Control bar — date nav + rain delay
                            controlBar

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
                                            onToggle: {
                                                Task {
                                                    do {
                                                        operationError = nil
                                                        let wasDone = job.status == .inProgress
                                                        try await store.toggleJobStatus(job)
                                                        if wasDone {
                                                            showBanner("Job marked done — client notified ✅")
                                                        }
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
                                                        showBanner("Job skipped — client notified ✅")
                                                    } catch {
                                                        operationError = error.localizedDescription
                                                    }
                                                }
                                            },
                                            showDate: !isToday
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

                // Toast banner
                if showNotificationBanner, let msg = notificationMessage {
                    VStack {
                        Spacer()
                        Text(msg)
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(MowGoTheme.deepGreen)
                            .cornerRadius(12)
                            .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
                            .padding(.bottom, 16)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                            .animation(.easeInOut(duration: 0.3), value: showNotificationBanner)
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
                    .accessibilityLabel("New Job")
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
                // Auto-generate jobs from recurring templates for today
                Task { await store.generateJobsFromRecurring() }
            }
        }
    }

    // MARK: - Header (compact)

    private var headerRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Good \(greeting) 👋")
                    .font(.subheadline)
                    .foregroundColor(theme.textMuted)
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
        .fixedSize(horizontal: false, vertical: true)
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

    // MARK: - Calendar

    private enum CalendarMode: String, CaseIterable {
        case week = "Week"
        case month = "Month"
    }

    private struct DayCell: Identifiable {
        let id = UUID()
        let date: Date
        let day: Int
        let isCurrentMonth: Bool
        let isToday: Bool
        let isSelected: Bool
        let hasJob: Bool
    }

    private var weekDays: [DayCell] {
        let cal = Calendar.current
        guard let weekStart = cal.dateInterval(of: .weekOfYear, for: selectedDate)?.start else {
            return []
        }

        return (0..<7).compactMap { offset in
            guard let date = cal.date(byAdding: .day, value: offset, to: weekStart) else {
                return nil
            }
            return makeDayCell(date: date)
        }
    }

    private var monthDays: [DayCell] {
        let cal = Calendar.current
        guard let monthStart = cal.date(from: cal.dateComponents([.year, .month], from: selectedDate)) else { return [] }
        let weekday = (cal.component(.weekday, from: monthStart) - cal.firstWeekday + 7) % 7
        let daysInMonth = cal.range(of: .day, in: .month, for: selectedDate)?.count ?? 30

        var cells: [DayCell] = []
        // Leading blanks
        for _ in 0..<weekday {
            cells.append(DayCell(date: Date(), day: 0, isCurrentMonth: false, isToday: false, isSelected: false, hasJob: false))
        }
        // Month days
        for day in 1...daysInMonth {
            guard let date = cal.date(bySetting: .day, value: day, of: monthStart) else { continue }
            cells.append(makeDayCell(date: date))
        }
        return cells
    }

    private var displayedDays: [DayCell] {
        calendarMode == .week ? weekDays : monthDays
    }

    private var weekdaySymbols: [String] {
        let cal = Calendar.current
        let symbols = cal.veryShortWeekdaySymbols
        let startIndex = cal.firstWeekday - 1
        return Array(symbols[startIndex...]) + Array(symbols[..<startIndex])
    }

    private func makeDayCell(date: Date) -> DayCell {
        let cal = Calendar.current
        return DayCell(
            date: date,
            day: cal.component(.day, from: date),
            isCurrentMonth: true,
            isToday: cal.isDateInToday(date),
            isSelected: cal.isDate(date, inSameDayAs: selectedDate),
            hasJob: store.jobs.contains { $0.scheduledDate == Self.dateFmt.string(from: date) }
        )
    }

    private var calendarGrid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 7)
        let monthFmt = DateFormatter(); monthFmt.dateFormat = "MMMM yyyy"
        return VStack(spacing: 6) {
            HStack {
                Text(monthFmt.string(from: selectedDate))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(theme.textPrimary)
                Spacer()
                Picker("Calendar view", selection: $calendarMode) {
                    ForEach(CalendarMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 150)
                .accessibilityLabel("Calendar view")
            }
            // Day headers
            HStack(spacing: 0) {
                ForEach(weekdaySymbols, id: \.self) { d in
                    Text(d).font(.caption2).foregroundColor(theme.textMuted)
                        .frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(displayedDays) { cell in
                    dayCell(cell)
                }
            }
            .animation(.easeInOut(duration: 0.15), value: calendarMode)
        }
        .padding(.vertical, 4)
    }

    private func dayCell(_ cell: DayCell) -> some View {
        Button {
            if cell.isCurrentMonth {
                withAnimation(.easeInOut(duration: 0.15)) { selectedDate = cell.date }
            }
        } label: {
            VStack(spacing: 2) {
                Text(cell.isCurrentMonth ? String(cell.day) : "")
                    .font(.caption2.weight(cell.isToday ? .bold : .regular))
                    .foregroundColor(cell.isSelected ? MowGoTheme.onAccent : cell.isToday ? MowGoTheme.deepGreen : theme.textSecondary)
                    .frame(width: 28, height: 28)
                    .background(cell.isSelected ? MowGoTheme.deepGreen : Color.clear)
                    .cornerRadius(14)
                Circle()
                    .fill(cell.hasJob ? MowGoTheme.deepGreen : Color.clear)
                    .frame(width: 3, height: 3)
            }
        }
        .buttonStyle(.plain)
        .disabled(!cell.isCurrentMonth)
        .accessibilityLabel(
            cell.isCurrentMonth
                ? cell.date.formatted(.dateTime.weekday(.wide).month(.wide).day())
                : "Empty calendar day"
        )
        .accessibilityValue(cell.hasJob ? "Has scheduled jobs" : "No scheduled jobs")
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

    private var controlBar: some View {
        HStack(spacing: 8) {
            // Date nav
            Button { shiftDate(-1) } label: {
                Image(systemName: "chevron.left")
                    .font(.caption2)
                    .foregroundColor(theme.textMuted)
            }

            Button { selectedDate = Date() } label: {
                Text("Today")
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(isToday ? MowGoTheme.deepGreen : theme.surfaceElevated)
                    .foregroundColor(isToday ? MowGoTheme.onAccent : theme.textPrimary)
                    .cornerRadius(12)
            }

            Button { shiftDate(1) } label: {
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundColor(theme.textMuted)
            }

            // Route sort button
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                routeMode.toggle()
                if routeMode {
                    showBanner("Drag jobs to reorder your driving route")
                    if todayJobs.contains(where: { $0.routeOrder == nil }) {
                        reorderJobsByRoute()
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.triangle.branch")
                        .font(.caption2)
                    Text("Route")
                        .font(.caption.weight(.medium))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(routeMode ? MowGoTheme.deepGreen : theme.surfaceElevated)
                .foregroundColor(routeMode ? MowGoTheme.onAccent : theme.textPrimary)
                .cornerRadius(16)
            }
            .disabled(todayJobs.count < 2)
            .opacity(todayJobs.count < 2 ? 0.5 : 1)

            Spacer()

            // Rain delay (today only)
            if isToday {
                Button { showingRainConfirm = true } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "cloud.rain.fill")
                            .font(.caption2)
                        Text("Rain Delay")
                            .font(.caption.weight(.medium))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(MowGoTheme.rainBlue)
                    .foregroundColor(MowGoTheme.onAccent)
                    .cornerRadius(16)
                }
                .disabled(scheduledCount == 0)
                .opacity(scheduledCount == 0 ? 0.5 : 1)
            }
        }
        .padding(.vertical, 4)
    }

    private var controlBar_OLD: some View {
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

    private func showBanner(_ message: String) {
        notificationMessage = message
        withAnimation { showNotificationBanner = true }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(3))
            withAnimation { showNotificationBanner = false }
        }
    }

    /// Assign routeOrder to today's jobs by sorting addresses alphabetically.
    /// This is a simple proxy for proximity — crew members pick the order,
    /// and alphabetizing by street gives a reasonable geographic grouping.
    private func reorderJobsByRoute() {
        let jobsToOrder = todayJobs.filter { $0.scheduledDate == dateString }
        guard !jobsToOrder.isEmpty else { return }

        // Sort by client address alphabetically (street-first grouping)
        let sorted = jobsToOrder.sorted { a, b in
            (a.address ?? "") < (b.address ?? "")
        }

        // Persist route orders to the store
        for (index, job) in sorted.enumerated() {
            Task {
                try? await store.updateRouteOrder(job, order: index)
            }
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
