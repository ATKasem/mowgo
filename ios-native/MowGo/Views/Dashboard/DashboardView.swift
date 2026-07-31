//
//  DashboardView.swift
//  MowGo
//
//  Owner dashboard with 4 stat cards. Crew see limited view.
//

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @Binding var selectedTab: Int

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = Calendar(identifier: .gregorian); return f
    }()

    private static let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter(); f.numberStyle = .currency; f.currencySymbol = "$"; return f
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

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if isOwner {
                    // Owner — 4 cards
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 12) {
                        DashboardCard(
                            icon: "dollarsign.circle.fill",
                            color: .green,
                            value: formatCurrency(todayRevenue),
                            label: "Revenue Today",
                            sub: todayJobs.isEmpty ? "No jobs today" : "\(todayDone.count)/\(todayJobs.count) jobs done"
                        )
                        .onTapGesture { selectedTab = 1 }
                        DashboardCard(
                            icon: "doc.text.fill",
                            color: .orange,
                            value: formatCurrency(outstanding),
                            label: "Outstanding",
                            sub: "Unpaid invoices"
                        )
                        .onTapGesture { selectedTab = 3 }
                        DashboardCard(
                            icon: "checkmark.circle.fill",
                            color: .purple,
                            value: "\(weeklyJobs.count)",
                            label: "Jobs This Week",
                            sub: "\(formatCurrency(weeklyRevenue)) revenue"
                        )
                        .onTapGesture { selectedTab = 1 }
                        DashboardCard(
                            icon: "person.2.fill",
                            color: .blue,
                            value: "\(activeClients)",
                            label: "Active Clients",
                            sub: "\(recurringClients) recurring"
                        )
                        .onTapGesture { selectedTab = 2 }
                    }
                } else {
                    // Crew — 2 cards, no revenue
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 12) {
                        DashboardCard(
                            icon: "checkmark.circle.fill",
                            color: .green,
                            value: "\(weeklyJobs.count)",
                            label: "Jobs This Week",
                            sub: "\(weeklyDone.count) done"
                        )
                        .onTapGesture { selectedTab = 1 }
                        DashboardCard(
                            icon: "person.2.fill",
                            color: .blue,
                            value: "\(activeClients)",
                            label: "Active Clients",
                            sub: nil
                        )
                        .onTapGesture { selectedTab = 2 }
                    }
                }
            }
            .padding(16)
        }
        .background(MowGoTheme.themed(colorScheme).background)
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
    let label: String
    let sub: String?

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
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }
}
