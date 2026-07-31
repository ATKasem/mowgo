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

    private let dateFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(secondsFromGMT: 0); return f
    }()

    private let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter(); f.numberStyle = .currency; f.currencySymbol = "$"; return f
    }()

    private let ownerRole = "owner"

    // MARK: - Stats

    private var today: String {
        dateFormatter.string(from: Date())
    }

    private func localDate(_ offsetDays: Int) -> String {
        guard let d = Calendar.current.date(byAdding: .day, value: offsetDays, to: Date()) else {
            return today // fallback to today on overflow
        }
        return dateFormatter.string(from: d)
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
                        StatCard(
                            icon: "dollarsign.circle.fill",
                            color: .green,
                            value: formatCurrency(todayRevenue),
                            label: "Revenue Today",
                            sub: todayJobs.isEmpty ? "No jobs today" : "\(todayDone.count)/\(todayJobs.count) jobs done"
                        )
                        StatCard(
                            icon: "doc.text.fill",
                            color: .orange,
                            value: formatCurrency(outstanding),
                            label: "Outstanding",
                            sub: "Unpaid invoices"
                        )
                        StatCard(
                            icon: "checkmark.circle.fill",
                            color: .purple,
                            value: "\(weeklyJobs.count)",
                            label: "Jobs This Week",
                            sub: "\(formatCurrency(weeklyRevenue)) revenue"
                        )
                        StatCard(
                            icon: "person.2.fill",
                            color: .blue,
                            value: "\(activeClients)",
                            label: "Active Clients",
                            sub: "\(recurringClients) recurring"
                        )
                    }
                } else {
                    // Crew — 2 cards, no revenue
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 12) {
                        StatCard(
                            icon: "checkmark.circle.fill",
                            color: .green,
                            value: "\(weeklyJobs.count)",
                            label: "Jobs This Week",
                            sub: "\(weeklyDone.count) done"
                        )
                        StatCard(
                            icon: "person.2.fill",
                            color: .blue,
                            value: "\(activeClients)",
                            label: "Active Clients",
                            sub: nil
                        )
                    }
                }
            }
            .padding(16)
        }
        .background(MowGoTheme.themed(colorScheme).background)
    }

    // MARK: - Helpers

    private func formatCurrency(_ amount: Decimal) -> String {
        return currencyFormatter.string(from: amount as NSDecimalNumber) ?? "$0"
    }
}

// MARK: - Stat Card

private struct StatCard: View {
    let icon: String
    let color: Color
    let value: String
    let label: String
    let sub: String?

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
                .foregroundColor(.primary)

            Text(label)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)

            if let sub = sub {
                Text(sub)
                    .font(.caption)
                    .foregroundColor(.secondary.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }
}
