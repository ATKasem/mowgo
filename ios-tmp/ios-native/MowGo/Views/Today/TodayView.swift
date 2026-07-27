//
//  TodayView.swift
//  MowGo
//
//  Today's jobs with date navigation, rain delay, and haptic feedback.
//

import SwiftUI

struct TodayView: View {
    @EnvironmentObject var store: DataStore

    static func todayString() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    @State private var showingRainConfirm = false
    @State private var showingAddJob = false
    @State private var selectedDate = Date()
    @State private var operationError: String?

    private static let dateFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }()

    private var dateString: String { Self.dateFmt.string(from: selectedDate) }

    private var todayJobs: [Job] {
        store.jobs.filter { $0.scheduledDate == dateString }
    }

    private var scheduledCount: Int {
        todayJobs.filter { $0.status == .scheduled }.count
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "111827").ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(Color(hex: "16a34a"))
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            dateHeader
                            statsBar
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
                                        JobCardView(job: job) {
                                            Task {
                                                do { try await store.toggleJobStatus(job) }
                                                catch { operationError = error.localizedDescription }
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
                            .foregroundColor(Color(hex: "16a34a"))
                    }
                }
            }
            .alert("Move \(scheduledCount) jobs to tomorrow?", isPresented: $showingRainConfirm) {
                Button("Yes, rain delay", role: .destructive) {
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                    Task {
                        do { try await store.rainDelay(for: dateString) }
                        catch { operationError = error.localizedDescription }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("All scheduled jobs for today will be rescheduled.")
            }
            .sheet(isPresented: $showingAddJob) {
                NewJobFormView(date: dateString)
            }
        }
    }

    // MARK: - Subviews

    private var dateHeader: some View {
        VStack(spacing: 4) {
            Text(selectedDate.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.title3.weight(.semibold)).foregroundColor(.white)
                .dynamicTypeSize(...DynamicTypeSize.accessibility2)
            HStack(spacing: 16) {
                Button { shiftDate(-1) } label: {
                    Image(systemName: "chevron.left").foregroundColor(Color(hex: "9ca3af"))
                }
                Button("Today") { selectedDate = Date() }
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 12).padding(.vertical, 4)
                    .background(isToday ? Color(hex: "16a34a") : Color(hex: "374151"))
                    .foregroundColor(.white).cornerRadius(8)
                Button { shiftDate(1) } label: {
                    Image(systemName: "chevron.right").foregroundColor(Color(hex: "9ca3af"))
                }
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
            .background(Color(hex: "1e3a5f")).foregroundColor(.white).cornerRadius(12)
        }
        .padding(.horizontal, 16).padding(.bottom, 12)
        .disabled(scheduledCount == 0).opacity(scheduledCount == 0 ? 0.5 : 1)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "leaf").font(.system(size: 40)).foregroundColor(Color(hex: "374151"))
            Text("No jobs scheduled").font(.headline).foregroundColor(.white)
            Text("Tap + to add your first job").font(.subheadline).foregroundColor(Color(hex: "6b7280"))
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
