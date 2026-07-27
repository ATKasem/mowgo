//
//  HomeView.swift
//  MowGo
//
//  Dashboard with stats, weekly calendar, quick actions.
//

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @State private var showNewJob = false
    @State private var showNewClient = false

    private var theme: MowGoTheme { MowGoTheme(colorScheme) }

    private var scheduledCount: Int { store.jobs.filter { $0.status == .scheduled }.count }
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
                            greetingSection
                            statsGrid

                            if let err = store.error {
                                Text(err).font(.caption).foregroundColor(.red)
                                    .padding(.horizontal, 8)
                            }

                            weeklyCalendar
                            quickActions
                        }
                        .padding(16)
                    }
                }
            }
            .navigationTitle("MowGo")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showNewJob) {
                NewJobFormView(date: TodayView.todayString())
            }
            .sheet(isPresented: $showNewClient) {
                NewClientFormView()
            }
            .refreshable {
                await store.loadAll()
            }
        }
    }

    // MARK: - Sections

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
                        }
                        .frame(width: 44).padding(.vertical, 8)
                        .background(day.isToday ? MowGoTheme.deepGreen.opacity(0.2) : theme.surface)
                        .cornerRadius(10)
                    }
                }
            }
        }
        .padding(16).background(theme.surface).cornerRadius(16)
    }

    private var quickActions: some View {
        VStack(spacing: 8) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                showNewJob = true
            } label: {
                QuickActionRow(icon: "plus.circle", label: "New Job", color: "16a34a")
            }
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                showNewClient = true
            } label: {
                QuickActionRow(icon: "person.badge.plus", label: "Add Client", color: "3b82f6")
            }
            NavigationLink(destination: InvoicesView()) {
                QuickActionRow(icon: "doc.badge.plus", label: "View Invoices", color: "f59e0b")
            }
        }
    }

    // MARK: - Helpers

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 0..<12: return "morning"
        case 12..<17: return "afternoon"
        default: return "evening"
        }
    }

    private struct WeekDay: Hashable {
        let label: String; let day: Int; let isToday: Bool; let hasJobs: Bool
    }

    private var weekDays: [WeekDay] {
        let cal = Calendar.current; let now = Date()
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        return (-3...3).compactMap { offset in
            guard let d = cal.date(byAdding: .day, value: offset, to: now) else { return nil }
            return WeekDay(
                label: d.formatted(.dateTime.weekday(.abbreviated)),
                day: cal.component(.day, from: d),
                isToday: offset == 0,
                hasJobs: store.jobs.contains { $0.scheduledDate == fmt.string(from: d) }
            )
        }
    }
}
