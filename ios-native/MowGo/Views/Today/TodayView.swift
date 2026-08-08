//
//  TodayView.swift
//  MowGo
//
//  Single-screen dashboard: compact header, slim calendar strip,
//  2×2 stats, rain delay pill, and jobs visible above the fold.
//

import SwiftUI
import UniformTypeIdentifiers

struct TodayView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @Binding var selectedTab: Int
    @State private var showingRainConfirm = false
    @State private var showingRainHistory = false
    @State private var showingActionSheet = false
    @State private var showingAddJob = false
    @State private var showingAddClient = false
    @State private var selectedDate = Date()
    @State private var operationError: String?
    @State private var selectedCrewFilter: UUID? = nil
    @State private var routeMode = false
    @State private var routeOrderIds: [UUID] = []
    @State private var draggingJobId: UUID?
    @State private var notificationMessage: LocalizedStringKey?
    @State private var showNotificationBanner = false
    @State private var calendarMode: CalendarMode = .week
    @State private var isOperating = false
    @State private var bannerDismissTask: Task<Void, Never>?
    @State private var undoEntry: RainDelayEntry?
    @State private var weatherForecast: WeatherForecast?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    private static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }()

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

    /// Route mode's live drag order. Falls back to `todayJobs` order for any
    /// job not yet tracked locally (e.g. one added while route mode is on).
    private var routeOrderedJobs: [Job] {
        guard routeMode else { return todayJobs }
        let known = Set(routeOrderIds)
        let ordered = routeOrderIds.compactMap { id in todayJobs.first(where: { $0.id == id }) }
        let extras = todayJobs.filter { !known.contains($0.id) }
        return ordered + extras
    }

    private var scheduledCount: Int {
        todayJobs.filter { $0.status == .scheduled }.count
    }

    private var completedCount: Int {
        todayJobs.filter { $0.status == .done }.count
    }

    private var todayRevenue: Decimal {
        todayJobs
            .filter { $0.status == .done }
            .map { job in store.clients.first(where: { $0.id == job.clientId })?.rate ?? 0 }
            .reduce(0, +)
    }

    // MARK: - Stats

    private var totalClients: Int { store.clients.count }

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

                            if !auth.isDemoMode {
                                dayConditionsCard
                            }

                            if let rainNotice {
                                Button { showingRainConfirm = true } label: {
                                    Text("🌧️ Rain \(rainNotice.percent)% \(rainNotice.day) — Rain delay?")
                                        .font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(12).background(MowGoTheme.rainBlue.opacity(0.18)).cornerRadius(12)
                                }
                                .buttonStyle(.plain)
                            }

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
                                    ForEach(routeOrderedJobs) { job in
                                        if routeMode {
                                            jobCard(job)
                                                .onDrag {
                                                    draggingJobId = job.id
                                                    return NSItemProvider(object: job.id.uuidString as NSString)
                                                }
                                                .onDrop(of: [.text], delegate: RouteDropDelegate(
                                                    item: job,
                                                    routeOrderIds: $routeOrderIds,
                                                    draggingJobId: $draggingJobId,
                                                    onReorder: persistRouteOrder
                                                ))
                                        } else {
                                            jobCard(job)
                                        }
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
                        HStack(spacing: 12) {
                            Text(msg).font(.subheadline.weight(.medium)).foregroundColor(.white)
                            if undoEntry != nil {
                                Button("Undo") { undoLatestRainDelay() }
                                    .font(.subheadline.weight(.bold)).foregroundColor(.white)
                            }
                        }
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(MowGoTheme.deepGreen).cornerRadius(12)
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
                    selectedTab = 3
                }
                Button("Cancel", role: .cancel) {}
            }
            .sheet(isPresented: $showingRainConfirm) {
                RainDelaySheet(date: dateString, affectedCount: scheduledCount) { entry in
                    undoEntry = entry
                    showBanner("Rain delay applied to \(entry.jobCount) job\(entry.jobCount == 1 ? "" : "s")")
                }
                .environmentObject(store)
            }
            .sheet(isPresented: $showingRainHistory) {
                RainDelayHistoryView().environmentObject(store)
            }
            .sheet(isPresented: $showingAddJob) {
                NewJobFormView(date: dateString, teamMembers: store.teamMembers)
            }
            .sheet(isPresented: $showingAddClient) {
                NewClientFormView()
            }
            .onAppear {
                if auth.user?.tier == "crew" || auth.user?.tier == "premium" {
                    Task { await store.loadTeamMembers() }
                }
            }
            .task {
                guard !auth.isDemoMode else { return }
                weatherForecast = await WeatherService().forecast(
                    latitude: auth.user?.latitude,
                    longitude: auth.user?.longitude
                )
            }
        }
    }

    // MARK: - Header (compact)

    private var headerRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(greeting)
                    .font(.subheadline)
                    .foregroundColor(theme.textMuted)
            }
            Spacer()
        }
    }

    /// Returns the full phrase (not just the time-of-day word) so Spanish can
    /// use correct grammar/gender agreement instead of a %@ substitution.
    private var greeting: LocalizedStringKey {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 0..<12: return "Good morning 👋"
        case 12..<17: return "Good afternoon 👋"
        default: return "Good evening 👋"
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
            StatCard(title: "Done", value: "\(completedCount)", icon: "checkmark.circle", color: "10b981")
            StatCard(
                title: "Revenue",
                value: todayRevenue.formatted(.currency(code: "USD")),
                icon: "dollarsign.circle",
                color: "16a34a"
            )
        }
    }

    // MARK: - Calendar

    private enum CalendarMode: String, CaseIterable {
        case week = "Week"
        case month = "Month"

        var label: LocalizedStringKey {
            switch self {
            case .week: return "Week"
            case .month: return "Month"
            }
        }
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
                        Text(mode.label).tag(mode)
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
        let canManageCrew = auth.user?.tier == "crew" || auth.user?.tier == "premium"
        return Group {
            if canManageCrew && store.teamMembers.count >= 2 {
                HStack(spacing: 8) {
                    CrewFilterChip(
                        label: NSLocalizedString("All", comment: "Crew filter: show all crew members' jobs"),
                        isSelected: selectedCrewFilter == nil,
                        color: MowGoTheme.success
                    ) {
                        selectedCrewFilter = nil
                    }
                    ForEach(Array(store.teamMembers.enumerated()), id: \.element.id) { index, member in
                        CrewFilterChip(
                            label: member.businessName?.components(separatedBy: " ").first ?? NSLocalizedString("Unknown", comment: "Crew filter: crew member with no business name set"),
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
                        routeOrderIds = todayJobs.sorted { (a, b) in (a.address ?? "") < (b.address ?? "") }.map(\.id)
                        reorderJobsByRoute()
                    } else {
                        routeOrderIds = todayJobs.map(\.id)
                    }
                } else {
                    routeOrderIds = []
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
                Button { showingRainHistory = true } label: {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.caption).foregroundColor(theme.textPrimary)
                        .padding(6).background(theme.surfaceElevated).clipShape(Circle())
                }
                .accessibilityLabel("Rain delay history")

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

    private func jobCard(_ job: Job) -> some View {
        JobCardView(job: job, teamMembers: store.teamMembers,
            onToggle: {
                guard !isOperating else { return }
                isOperating = true
                defer { isOperating = false }
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
            },
            onSkip: {
                guard !isOperating else { return }
                isOperating = true
                defer { isOperating = false }
                do {
                    operationError = nil
                    try await store.skipJob(job)
                    showBanner("Job skipped — client notified ✅")
                } catch {
                    operationError = error.localizedDescription
                }
            },
            showDate: !isToday
        )
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

    private func showBanner(_ message: LocalizedStringKey) {
        bannerDismissTask?.cancel()
        notificationMessage = message
        withAnimation { showNotificationBanner = true }
        bannerDismissTask = Task<Void, Never> { @MainActor in
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            withAnimation { showNotificationBanner = false }
        }
    }

    // MARK: - Day Conditions Card

    private var hasBusinessLocation: Bool {
        auth.user?.latitude != nil && auth.user?.longitude != nil
    }

    private var dayConditionsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Day Conditions")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(theme.textPrimary)

            if hasBusinessLocation {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    dayConditionMetric(
                        value: weatherForecast?.currentTempF.map { "\(Int($0.rounded()))°" } ?? "—",
                        label: "Weather",
                        subtext: "Wind \(weatherForecast?.windMph.map { "\(Int($0.rounded()))" } ?? "—") mph"
                    )
                    dayConditionMetric(
                        value: weatherForecast?.soilTempF.map { "\(Int($0.rounded()))°" } ?? "—",
                        label: "Soil temp",
                        subtext: weatherForecast?.soilTempF == nil ? "No station within 15 mi" : nil
                    )
                    dayConditionMetric(
                        value: weatherForecast?.rain7dInches.map { String(format: "%.2f\"", $0) } ?? "—",
                        label: "7-day rain",
                        subtext: nil
                    )
                    sprayMetric
                }
            } else {
                Text("Set business location to see conditions")
                    .font(.caption.weight(.medium))
                    .foregroundColor(MowGoTheme.deepGreen)
            }
        }
        .padding(12)
        .background(theme.surface)
        .cornerRadius(12)
    }

    private func dayConditionMetric(value: String, label: LocalizedStringKey, subtext: LocalizedStringKey? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 17, weight: .bold))
                .foregroundColor(theme.textPrimary)
            Text(label)
                .font(.caption2)
                .foregroundColor(theme.textMuted)
            if let subtext {
                Text(subtext)
                    .font(.system(size: 11))
                    .foregroundColor(theme.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sprayMetric: some View {
        let status = weatherForecast?.sprayStatus()
        let label: LocalizedStringKey
        let color: Color
        switch status {
        case .good:
            label = "GOOD"
            color = MowGoTheme.success
        case .hold:
            label = "HOLD OFF"
            color = MowGoTheme.warning
        case nil:
            label = "—"
            color = theme.textPrimary
        }
        return VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 17, weight: .bold))
                .foregroundColor(color)
            Text("Spray")
                .font(.caption2)
                .foregroundColor(theme.textMuted)
            Text("≤\(Int(WeatherForecast.sprayRule.maxTempF))°F · ≤\(Int(WeatherForecast.sprayRule.maxWindMph)) mph")
                .font(.system(size: 11))
                .foregroundColor(theme.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var rainNotice: (percent: Int, day: String)? {
        guard isToday, !auth.isDemoMode, let weatherForecast else { return nil }
        if let percent = weatherForecast.todayPrecipitationProbability, percent >= 60 {
            return (percent, "today")
        }
        if let percent = weatherForecast.tomorrowPrecipitationProbability, percent >= 60 {
            return (percent, "tomorrow")
        }
        return nil
    }

    private func undoLatestRainDelay() {
        guard let entry = undoEntry else { return }
        bannerDismissTask?.cancel()
        Task<Void, Never> {
            do {
                try await store.undoRainDelay(entry)
                undoEntry = nil
                showBanner("Rain delay undone")
            } catch {
                operationError = error.localizedDescription
            }
        }
    }

    /// Assign routeOrder to today's jobs by sorting addresses alphabetically.
    /// This is a simple proxy for proximity — crew members pick the order,
    /// and alphabetizing by street gives a reasonable geographic grouping.
    private func reorderJobsByRoute() {
        guard !isOperating else { return }
        let jobsToOrder = todayJobs.filter { $0.scheduledDate == dateString }
        guard !jobsToOrder.isEmpty else { return }

        // Sort by client address alphabetically (street-first grouping)
        let sorted = jobsToOrder.sorted { a, b in
            (a.address ?? "") < (b.address ?? "")
        }

        // Persist route orders sequentially so indices stay unique and writes stay ordered.
        isOperating = true
        Task {
            do {
                operationError = nil
                for (index, job) in sorted.enumerated() {
                    try await store.updateRouteOrder(job, order: index)
                }
            } catch {
                operationError = error.localizedDescription
            }
            isOperating = false
        }
    }

    /// Persists the current `routeOrderIds` drag order to the server. Called
    /// once a drag gesture ends so mid-drag reordering doesn't spam writes.
    private func persistRouteOrder() {
        guard !isOperating else { return }
        let jobsToPersist = routeOrderIds.compactMap { id in todayJobs.first(where: { $0.id == id }) }
        guard !jobsToPersist.isEmpty else { return }

        isOperating = true
        Task {
            do {
                operationError = nil
                for (index, job) in jobsToPersist.enumerated() where job.routeOrder != index {
                    try await store.updateRouteOrder(job, order: index)
                }
            } catch {
                operationError = error.localizedDescription
            }
            isOperating = false
        }
    }
}

/// Drives live drag reordering for Route mode's job list. `dropEntered`
/// moves the dragged job within `routeOrderIds` as it crosses another card's
/// drop zone; `performDrop` fires once the gesture ends to persist the order.
private struct RouteDropDelegate: DropDelegate {
    let item: Job
    @Binding var routeOrderIds: [UUID]
    @Binding var draggingJobId: UUID?
    let onReorder: () -> Void

    func dropEntered(info: DropInfo) {
        guard let draggingJobId, draggingJobId != item.id,
              let fromIndex = routeOrderIds.firstIndex(of: draggingJobId),
              let toIndex = routeOrderIds.firstIndex(of: item.id) else { return }
        guard routeOrderIds[toIndex] != draggingJobId else { return }
        withAnimation(.default) {
            routeOrderIds.move(
                fromOffsets: IndexSet(integer: fromIndex),
                toOffset: toIndex > fromIndex ? toIndex + 1 : toIndex
            )
        }
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }

    func performDrop(info: DropInfo) -> Bool {
        draggingJobId = nil
        onReorder()
        return true
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
