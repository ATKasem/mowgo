//
//  TodayView.swift
//  MowGo
//
//  Today's jobs with date navigation, rain delay, and haptic feedback.
//

import SwiftUI

struct TodayView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme

    static func todayString() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    @State private var showingRainConfirm = false
    @State private var showingAddJob = false
    @State private var selectedDate = Date()
    @State private var operationError: String?
    @State private var selectedCrewFilter: UUID? = nil

    private var theme: MowGoTheme { MowGoTheme(colorScheme) }

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

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(MowGoTheme.deepGreen)
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            dateHeader
                            statsBar
                            crewFilterBar
                            rainDelayButton

                            if let err = operationError {
                                Text(err).font(.caption).foregroundColor(.red)
                                    .padding(.horizontal, 16).padding(.bottom, 8)
                            }

                            if todayJobs.isEmpty {
                                emptyState
                            } else {
                                LazyVStack(spacing: 8) {
                                    ForEach(todayJobs) { job in
                                        JobCardView(job: job, teamMembers: store.teamMembers) {
                                            Task {
                                                do {
                                                    operationError = nil
                                                    try await store.toggleJobStatus(job)
                                                } catch {
                                                    operationError = error.localizedDescription
                                                }
                                            }
                                        }
                                    }
                                }
                                .padding(.horizontal, 16)
                            }
                        }
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
            .onAppear {
                if auth.user?.tier == "crew" {
                    Task { await store.loadTeamMembers() }
                }
            }
        }
    }

    // MARK: - Subviews

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

    private var statsBar: some View {
        HStack(spacing: 12) {
            StatChip(label: "Scheduled", count: todayJobs.filter { $0.status == .scheduled }.count, color: "f59e0b")
            StatChip(label: "Done", count: todayJobs.filter { $0.status == .done }.count, color: "16a34a")
            StatChip(label: "Revenue", count: nil, amount: todayJobs.filter { $0.status == .done }.compactMap { $0.clientRate }.reduce(0, +), color: "3b82f6")
        }
        .padding(.horizontal, 16).padding(.bottom, 12)
    }

    private var rainDelayButton: some View {
        Button { showingRainConfirm = true } label: {
            HStack {
                Image(systemName: "cloud.rain.fill")
                Text("Rain Delay").fontWeight(.medium)
            }
            .frame(maxWidth: .infinity).padding(12)
            .background(MowGoTheme.rainBlue).foregroundColor(MowGoTheme.onAccent).cornerRadius(12)
        }
        .padding(.horizontal, 16).padding(.bottom, 12)
        .disabled(scheduledCount == 0).opacity(scheduledCount == 0 ? 0.5 : 1)
    }

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
                    .padding(.horizontal, 16)
                }
                .padding(.bottom, 12)
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

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "leaf").font(.system(size: 40)).foregroundColor(theme.surfaceElevated)
            Text("No jobs scheduled").font(.headline).foregroundColor(theme.textPrimary)
            Text("Tap + to add your first job").font(.subheadline).foregroundColor(theme.textInverse)
        }
        .padding(.top, 60)
    }

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

    private var theme: MowGoTheme { MowGoTheme(colorScheme) }

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
