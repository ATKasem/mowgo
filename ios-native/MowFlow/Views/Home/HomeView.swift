//
//  HomeView.swift
//  MowFlow
//
//  Dashboard with stats, weekly calendar, quick actions.
//

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @State private var showNewJob = false
    @State private var showNewClient = false

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
                Color(hex: "111827").ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(Color(hex: "16a34a"))
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
            .navigationTitle("MowFlow")
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
                .font(.subheadline).foregroundColor(Color(hex: "9ca3af"))
            Text("Good \(greeting) 👋")
                .font(.title2.weight(.bold)).foregroundColor(.white)
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
            Text("This Week").font(.headline).foregroundColor(.white)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(weekDays, id: \.self) { day in
                        VStack(spacing: 4) {
                            Text(day.label).font(.caption2).foregroundColor(Color(hex: "9ca3af"))
                            Text("\(day.day)").font(.callout.weight(.semibold))
                                .foregroundColor(day.isToday ? .white : Color(hex: "d1d5db"))
                            Circle()
                                .fill(day.hasJobs ? Color(hex: "16a34a") : Color.clear)
                                .frame(width: 6, height: 6)
                        }
                        .frame(width: 44).padding(.vertical, 8)
                        .background(day.isToday ? Color(hex: "16a34a").opacity(0.2) : Color(hex: "1f2937"))
                        .cornerRadius(10)
                    }
                }
            }
        }
        .padding(16).background(Color(hex: "1f2937")).cornerRadius(16)
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
        fmt.calendar = Calendar(identifier: .gregorian)
        fmt.timeZone = TimeZone(secondsFromGMT: 0)!
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
